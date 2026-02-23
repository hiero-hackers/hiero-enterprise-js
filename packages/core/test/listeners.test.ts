import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import type {
    TransactionListener,
    TransactionEvent,
} from "../src/listeners/index.js";
import { AccountClient } from "../src/services/account-client.js";

// Mock the hashgraph SDK so we don't hit the real network
vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    // Create chainable mock transactions
    const mockTx = {
        setKeyWithoutAlias: vi.fn().mockReturnThis(),
        setInitialBalance: vi.fn().mockReturnThis(),
        setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
        setAccountMemo: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890.000000000" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                accountId: { toString: () => "0.0.12345" },
            }),
        }),
    };

    return {
        ...actual,
        AccountCreateTransaction: vi.fn(() => mockTx),
        // We only mock what we need for this specific test
    };
});

describe("Transaction Interceptors", () => {
    let context: HieroContext;
    let client: AccountClient;

    beforeEach(() => {
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208", // Dummy ED25519 DER
        });
        client = new AccountClient(context);
    });

    it("registers and calls listener on successful transaction", async () => {
        const events: TransactionEvent[] = [];
        const listener: TransactionListener = {
            onBeforeTransaction: (event) => {
                events.push({ ...event, type: event.type + "_BEFORE" });
            },
            onAfterTransaction: (event) => {
                events.push({ ...event, type: event.type + "_AFTER" });
            },
        };

        context.addTransactionListener(listener);

        await client.createAccount({ initialBalance: 100 });

        expect(events.length).toBe(2);

        // Check before event
        expect(events[0].type).toBe("AccountCreate_BEFORE");
        expect(events[0].serviceName).toBe("AccountClient");
        expect(events[0].methodName).toBe("createAccount");
        expect(events[0].transactionId).toBeUndefined();

        // Check after event
        expect(events[1].type).toBe("AccountCreate_AFTER");
        expect(events[1].serviceName).toBe("AccountClient");
        expect(events[1].methodName).toBe("createAccount");
        expect(events[1].transactionId).toBe("0.0.123@1234567890.000000000");
        expect(events[1].status).toBe("SUCCESS");
        expect(events[1].durationMs).toBeGreaterThanOrEqual(0);
        expect(events[1].error).toBeUndefined();
    });

    it("allows removing listeners", async () => {
        const listener: TransactionListener = {
            onBeforeTransaction: vi.fn(),
            onAfterTransaction: vi.fn(),
        };

        context.addTransactionListener(listener);
        context.removeTransactionListener(listener);

        await client.createAccount({ initialBalance: 100 });

        expect(listener.onBeforeTransaction).not.toHaveBeenCalled();
        expect(listener.onAfterTransaction).not.toHaveBeenCalled();
    });

    it("handles failing transactions and captures errors", async () => {
        // Redefine the mock to throw an error
        const mockError = new Error("NETWORK_ERROR");
        const failingTx = {
            setKeyWithoutAlias: vi.fn().mockReturnThis(),
            setInitialBalance: vi.fn().mockReturnThis(),
            execute: vi.fn().mockRejectedValue(mockError),
        };

        // We override the import for just this test
        const { AccountCreateTransaction } = await import("@hashgraph/sdk");
        vi.mocked(AccountCreateTransaction).mockImplementationOnce(
            () => failingTx as any,
        );

        const events: TransactionEvent[] = [];
        context.addTransactionListener({
            onAfterTransaction: (e) => {
                events.push(e);
            },
        });

        await expect(client.createAccount()).rejects.toThrow("NETWORK_ERROR");

        expect(events.length).toBe(1);
        expect(events[0].error).toBe(mockError);
        expect(events[0].status).toBeUndefined(); // Failure before receipt
    });
});
