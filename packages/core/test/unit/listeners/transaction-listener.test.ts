import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    PrivateKey,
    Status,
    Transaction,
    TransactionId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../src/services/account/index.js";
import { HieroContext } from "../../../src/context/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";
import type {
    TransactionListener,
    TransactionEvent,
} from "../../../src/listeners/index.js";

// Uses a real HieroContext and builds real SDK transactions; only
// Transaction.execute, the network call, is stubbed.

const response = {
    transactionId: TransactionId.fromString("0.0.123@1234567890.000000000"),
    getReceipt: () =>
        Promise.resolve({
            status: Status.Success,
            accountId: AccountId.fromString("0.0.12345"),
        }),
};

describe("Transaction Listeners", () => {
    let context: HieroContext;
    let client: AccountService;
    let execute: ReturnType<typeof vi.spyOn>;
    const beforeEvents: TransactionEvent[] = [];
    const afterEvents: TransactionEvent[] = [];
    const testPubKey = PrivateKey.generateED25519().publicKey.toString();

    const listener: TransactionListener = {
        onBeforeTransaction: (event) => {
            beforeEvents.push(event);
        },
        onAfterTransaction: (event) => {
            afterEvents.push(event);
        },
    };

    beforeEach(() => {
        beforeEvents.length = 0;
        afterEvents.length = 0;

        execute = vi
            .spyOn(Transaction.prototype, "execute")
            .mockResolvedValue(response as never);
        context = new HieroContext({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
            operatorKeyType: OperatorKeyType.DER,
        });
        client = new AccountService(context);
    });

    afterEach(() => {
        context.close();
        vi.restoreAllMocks();
    });

    it("registers and calls listener on successful transaction", async () => {
        context.addTransactionListener(listener);
        await client.createAccount({ publicKey: testPubKey });

        expect(beforeEvents).toHaveLength(1);
        expect(beforeEvents[0].type).toBe("AccountCreate");
        expect(afterEvents).toHaveLength(1);
        expect(afterEvents[0].status).toBe("SUCCESS");
    });

    it("allows removing listeners", async () => {
        context.addTransactionListener(listener);
        context.removeTransactionListener(listener);

        await client.createAccount({ publicKey: testPubKey });

        expect(beforeEvents).toHaveLength(0);
        expect(afterEvents).toHaveLength(0);
    });

    it("handles failing transactions and captures errors", async () => {
        execute.mockRejectedValueOnce(new Error("TX_FAILED"));
        context.addTransactionListener(listener);

        await expect(
            client.createAccount({ publicKey: testPubKey }),
        ).rejects.toThrow();

        expect(beforeEvents).toHaveLength(1);
        expect(afterEvents).toHaveLength(1);
        expect(afterEvents[0].error).toBeDefined();
    });
});
