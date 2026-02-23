import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { AccountClient } from "../src/services/account-client.js";
import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountBalanceQuery,
} from "@hashgraph/sdk";

// Mock the SDK
vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    // Returns "this" to allow method chaining
    const mockTx = {
        setKeyWithoutAlias: vi.fn().mockReturnThis(),
        setInitialBalance: vi.fn().mockReturnThis(),
        setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
        setAccountMemo: vi.fn().mockReturnThis(),
        setAccountId: vi.fn().mockReturnThis(),
        setTransferAccountId: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: {
                    toString: () => "0.0.123@1234567890.000000000",
                },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    accountId: { toString: () => "0.0.999" },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890.000000000" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                accountId: { toString: () => "0.0.999" },
            }),
        }),
    };

    const mockQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            hbars: {
                toTinybars: () => ({ toNumber: () => 1000000 }),
            },
            tokens: null, // Simulate no tokens
        }),
    };

    return {
        ...actual,
        AccountCreateTransaction: vi.fn(() => mockTx),
        AccountDeleteTransaction: vi.fn(() => mockTx),
        AccountBalanceQuery: vi.fn(() => mockQuery),
    };
});

describe("AccountClient", () => {
    let context: HieroContext;
    let client: AccountClient;

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208", // Dummy ED25519 DER
        });
        client = new AccountClient(context);
    });

    describe("createAccount", () => {
        it("creates an account with default options", async () => {
            const account = await client.createAccount();

            // Check response mapping
            expect(account.accountId).toBe("0.0.999");
            expect(account.publicKey).toBeDefined();
            expect(account.privateKey).toBeDefined();
            expect(account.evmAddress).toBeDefined();

            // Check SDK transaction
            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setInitialBalance).toHaveBeenCalled();
            expect(mockInstance.setKeyWithoutAlias).toHaveBeenCalled();
            expect(mockInstance.execute).toHaveBeenCalledWith(context.client);
            expect(
                mockInstance.setMaxAutomaticTokenAssociations,
            ).not.toHaveBeenCalled();
            expect(mockInstance.setAccountMemo).not.toHaveBeenCalled();
        });

        it("creates an account with custom options", async () => {
            await client.createAccount({
                initialBalance: 5,
                maxAutomaticTokenAssociations: 10,
                memo: "test memo",
            });

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(
                mockInstance.setMaxAutomaticTokenAssociations,
            ).toHaveBeenCalledWith(10);
            expect(mockInstance.setAccountMemo).toHaveBeenCalledWith(
                "test memo",
            );
            expect(mockInstance.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("deleteAccount", () => {
        it("deletes an account transferring to operator by default", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
            await client.deleteAccount("0.0.999", dummyKey);

            const mockInstance = vi.mocked(AccountDeleteTransaction).mock
                .results[0].value;
            expect(mockInstance.setAccountId).toHaveBeenCalledWith("0.0.999");
            expect(mockInstance.setTransferAccountId).toHaveBeenCalledWith(
                "0.0.2",
            ); // Operator
            expect(mockInstance.freezeWith).toHaveBeenCalledWith(
                context.client,
            );
            expect(mockInstance.sign).toHaveBeenCalled();
        });

        it("deletes an account and transfers to custom account", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
            await client.deleteAccount("0.0.999", dummyKey, "0.0.456");

            const mockInstance = vi.mocked(AccountDeleteTransaction).mock
                .results[0].value;
            expect(mockInstance.setTransferAccountId).toHaveBeenCalledWith(
                "0.0.456",
            );
        });
    });

    describe("getAccountBalance", () => {
        it("fetches the account balance", async () => {
            const balance = await client.getAccountBalance("0.0.999");

            expect(balance.accountId).toBe("0.0.999");
            expect(balance.hbars).toBe(1000000);
            expect(balance.tokens).toEqual([]); // Mock returns null tokens

            const mockInstance =
                vi.mocked(AccountBalanceQuery).mock.results[0].value;
            expect(mockInstance.setAccountId).toHaveBeenCalledWith("0.0.999");
            expect(mockInstance.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("getOperatorAccountBalance", () => {
        it("fetches the operator balance", async () => {
            const balance = await client.getOperatorAccountBalance();

            expect(balance.accountId).toBe("0.0.2"); // Operator ID

            const mockInstance =
                vi.mocked(AccountBalanceQuery).mock.results[0].value;
            expect(mockInstance.setAccountId).toHaveBeenCalledWith("0.0.2");
        });
    });
});
