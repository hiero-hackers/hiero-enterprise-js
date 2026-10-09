import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountCreateTransaction,
    AccountId,
    PrivateKey,
    ScheduleId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { AccountType } from "../../../../../src/types/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { accountId: AccountId.fromString("0.0.999") },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("CreateAccountOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as AccountCreateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createAccount", () => {
        it("creates an account with an ED25519 key (default keyType)", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            const account = await service.createAccount({ publicKey: pubKey });

            expect(account.accountId.toString()).toBe("0.0.999");
            expect(account.publicKey).toBe(pubKey);
            expect(account.evmAddress).toBeUndefined();

            const tx = sentTx();
            expect(tx).toBeInstanceOf(AccountCreateTransaction);
            expect(tx.key?.toString()).toBe(pubKey);
            expect(tx.alias).toBeNull();
            expect(tx.initialBalance?.toTinybars().toNumber()).toBe(0);
        });

        it("creates an ECDSA account with alias derived from the key", async () => {
            const publicKey = PrivateKey.generateECDSA().publicKey;
            const account = await service.createAccount({
                publicKey: publicKey.toString(),
                keyType: AccountType.ECDSA,
                alias: true,
                initialBalance: 5,
            });

            expect(account.evmAddress).toBe(publicKey.toEvmAddress());
            const tx = sentTx();
            expect(tx.key?.toString()).toBe(publicKey.toString());
            expect(tx.alias?.toString()).toBe(publicKey.toEvmAddress());
            expect(tx.initialBalance?.toBigNumber().toNumber()).toBe(5);
        });

        it("creates an account with a separate alias key (two-key pattern)", async () => {
            const primaryKey =
                PrivateKey.generateED25519().publicKey.toString();
            const aliasKey = PrivateKey.generateECDSA().publicKey;

            const account = await service.createAccount({
                publicKey: primaryKey,
                keyType: AccountType.ED25519,
                alias: { ecdsaPublicKey: aliasKey.toString() },
            });

            expect(account.evmAddress).toBe(aliasKey.toEvmAddress());
            const tx = sentTx();
            expect(tx.key?.toString()).toBe(primaryKey);
            expect(tx.alias?.toString()).toBe(aliasKey.toEvmAddress());
        });

        it("throws if alias: true is used with an ED25519 key", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();

            await expect(
                service.createAccount({
                    publicKey: pubKey,
                    keyType: AccountType.ED25519,
                    alias: true,
                }),
            ).rejects.toThrow(/requires keyType AccountType.ECDSA/);
            expect(run).not.toHaveBeenCalled();
        });

        it("sets all optional properties when provided", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                initialBalance: 10,
                receiverSignatureRequired: true,
                memo: "test memo",
                maxAutomaticTokenAssociations: 5,
                stakedNodeId: 3,
                declineStakingReward: true,
            });

            const tx = sentTx();
            expect(tx.initialBalance?.toBigNumber().toNumber()).toBe(10);
            expect(tx.receiverSignatureRequired).toBe(true);
            expect(tx.accountMemo).toBe("test memo");
            expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(5);
            expect(tx.stakedNodeId?.toNumber()).toBe(3);
            expect(tx.declineStakingRewards).toBe(true);
        });

        it("keeps the SDK defaults for omitted optional properties", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({ publicKey: pubKey });

            const tx = sentTx();
            const defaults = new AccountCreateTransaction();
            expect(tx.receiverSignatureRequired).toBe(
                defaults.receiverSignatureRequired,
            );
            expect(tx.accountMemo).toBe(defaults.accountMemo);
            expect(tx.maxAutomaticTokenAssociations).toEqual(
                defaults.maxAutomaticTokenAssociations,
            );
            expect(tx.stakedAccountId).toEqual(defaults.stakedAccountId);
            expect(tx.stakedNodeId).toEqual(defaults.stakedNodeId);
            expect(tx.declineStakingRewards).toBe(
                defaults.declineStakingRewards,
            );
        });

        it("sets stakedAccountId when provided", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                stakedAccountId: "0.0.800",
            });

            expect(sentTx().stakedAccountId?.toString()).toBe("0.0.800");
        });

        it("forwards base TransactionOptions to the executor", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(AccountCreateTransaction),
                expect.objectContaining({
                    transactionMemo: "base memo",
                    transactionValidDuration: 90,
                    regenerateTransactionId: false,
                }),
                expect.objectContaining({
                    type: "AccountCreate",
                    serviceName: "AccountService",
                    methodName: "createAccount",
                }),
            );
        });
    });

    describe("scheduleCreateAccount", () => {
        it("schedules the built transaction with the schedule options", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);
            const pubKey = PrivateKey.generateED25519().publicKey.toString();

            const result = await service.scheduleCreateAccount(
                { publicKey: pubKey },
                { scheduleMemo: "pending approval" },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(AccountCreateTransaction);
            expect((tx as AccountCreateTransaction).key?.toString()).toBe(
                pubKey,
            );
            expect(scheduleOptions).toEqual({
                scheduleMemo: "pending approval",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
