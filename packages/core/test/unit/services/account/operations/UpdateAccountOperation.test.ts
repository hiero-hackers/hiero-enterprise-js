import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountUpdateTransaction,
    PrivateKey,
    ScheduleId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { HieroErrorCodes } from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

const THIRTY_DAYS = 2_592_000;

describe("UpdateAccountOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as AccountUpdateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("updateAccount", () => {
        it("sets only the account ID when no optional field is given", async () => {
            await service.updateAccount({ accountId: "0.0.1234" });

            const tx = sentTx();
            const defaults = new AccountUpdateTransaction();
            expect(tx).toBeInstanceOf(AccountUpdateTransaction);
            expect(tx.accountId?.toString()).toBe("0.0.1234");
            expect(tx.key).toBe(defaults.key);
            expect(tx.expirationTime).toBe(defaults.expirationTime);
            expect(tx.receiverSignatureRequired).toBe(
                defaults.receiverSignatureRequired,
            );
            expect(tx.accountMemo).toBe(defaults.accountMemo);
            expect(tx.maxAutomaticTokenAssociations).toBe(
                defaults.maxAutomaticTokenAssociations,
            );
            expect(tx.stakedAccountId).toBe(defaults.stakedAccountId);
            expect(tx.stakedNodeId).toBe(defaults.stakedNodeId);
            expect(tx.autoRenewPeriod).toBe(defaults.autoRenewPeriod);
            expect(tx.declineStakingRewards).toBe(
                defaults.declineStakingRewards,
            );
        });

        it("sets every optional field when provided", async () => {
            const newKey = PrivateKey.generateED25519();
            const expirationTime = new Date(Date.now() + 86_400_000);

            await service.updateAccount({
                accountId: "0.0.1234",
                key: newKey.publicKey,
                additionalSigners: [newKey],
                expirationTime,
                receiverSignatureRequired: true,
                memo: "updated memo",
                maxAutomaticTokenAssociations: 7,
                stakedNodeId: 3,
                autoRenewPeriod: THIRTY_DAYS,
                declineStakingReward: true,
            });

            const tx = sentTx();
            expect(tx.key?.toString()).toBe(newKey.publicKey.toString());
            expect(tx.expirationTime?.toDate().getTime()).toBe(
                expirationTime.getTime(),
            );
            expect(tx.receiverSignatureRequired).toBe(true);
            expect(tx.accountMemo).toBe("updated memo");
            expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(7);
            expect(tx.stakedNodeId?.toNumber()).toBe(3);
            expect(tx.autoRenewPeriod?.seconds.toNumber()).toBe(THIRTY_DAYS);
            expect(tx.declineStakingRewards).toBe(true);
        });

        it("sets stakedAccountId when provided", async () => {
            await service.updateAccount({
                accountId: "0.0.1234",
                stakedAccountId: "0.0.800",
            });

            expect(sentTx().stakedAccountId?.toString()).toBe("0.0.800");
        });

        it("forwards base TransactionOptions to the executor", async () => {
            await service.updateAccount({
                accountId: "0.0.1234",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(AccountUpdateTransaction),
                expect.objectContaining({
                    transactionMemo: "base memo",
                    transactionValidDuration: 90,
                }),
                expect.objectContaining({
                    type: "AccountUpdate",
                    serviceName: "AccountService",
                    methodName: "updateAccount",
                }),
            );
        });

        it.each([
            [
                "a key rotation without signers",
                { key: PrivateKey.generateED25519().publicKey },
                /old and new key to sign/,
            ],
            [
                "an expirationTime in the past",
                { expirationTime: new Date(Date.now() - 1000) },
                /expirationTime must be in the future/,
            ],
            [
                "both stakedAccountId and stakedNodeId",
                { stakedAccountId: "0.0.800", stakedNodeId: 3 },
                /mutually exclusive/,
            ],
            [
                "a missing accountId",
                { accountId: undefined as unknown as string },
                /accountId is required/,
            ],
            [
                "a memo over 100 bytes",
                { memo: "x".repeat(101) },
                /memo exceeds 100 bytes/,
            ],
            [
                "an autoRenewPeriod under 30 days",
                { autoRenewPeriod: THIRTY_DAYS - 1 },
                /autoRenewPeriod must be between/,
            ],
        ])("rejects %s before sending", async (_, fields, message) => {
            await expect(
                service.updateAccount({ accountId: "0.0.1234", ...fields }),
            ).rejects.toMatchObject({
                name: "HieroError",
                code: HieroErrorCodes.InputInvalid,
                message: expect.stringMatching(message),
            });
            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleUpdateAccount", () => {
        it("schedules the built transaction with the schedule options", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleUpdateAccount(
                { accountId: "0.0.1234", memo: "scheduled memo" },
                { scheduleMemo: "pending approval" },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(AccountUpdateTransaction);
            expect((tx as AccountUpdateTransaction).accountId?.toString()).toBe(
                "0.0.1234",
            );
            expect((tx as AccountUpdateTransaction).accountMemo).toBe(
                "scheduled memo",
            );
            expect(scheduleOptions).toEqual({
                scheduleMemo: "pending approval",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });

        it("rejects invalid options before scheduling", async () => {
            const scheduleRun = vi.spyOn(
                TransactionExecutor.prototype,
                "scheduleRun",
            );

            await expect(
                service.scheduleUpdateAccount({
                    accountId: "0.0.1234",
                    memo: "x".repeat(101),
                }),
            ).rejects.toMatchObject({ code: HieroErrorCodes.InputInvalid });
            expect(scheduleRun).not.toHaveBeenCalled();
        });
    });
});
