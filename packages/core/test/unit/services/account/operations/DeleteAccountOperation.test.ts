import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountDeleteTransaction,
    PrivateKey,
    ScheduleId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("DeleteAccountOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as AccountDeleteTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("deleteAccount", () => {
        it("deletes an account and defaults the transfer target to the operator", async () => {
            await service.deleteAccount({
                accountId: "0.0.999",
                accountKey: PrivateKey.generateED25519(),
            });

            const tx = sentTx();
            expect(tx).toBeInstanceOf(AccountDeleteTransaction);
            expect(tx.accountId?.toString()).toBe("0.0.999");
            expect(tx.transferAccountId?.toString()).toBe("0.0.2");
        });

        it("deletes an account with a custom transfer target", async () => {
            await service.deleteAccount({
                accountId: "0.0.999",
                accountKey: PrivateKey.generateED25519(),
                transferAccountId: "0.0.555",
            });

            expect(sentTx().transferAccountId?.toString()).toBe("0.0.555");
        });

        it("adds accountKey as the first additional signer", async () => {
            const accountKey = PrivateKey.generateED25519();
            const extraKey = PrivateKey.generateED25519();

            await service.deleteAccount({
                accountId: "0.0.999",
                accountKey,
                additionalSigners: [extraKey],
            });

            const options = run.mock.calls[0][1] as {
                additionalSigners: PrivateKey[];
            };
            expect(options.additionalSigners).toEqual([accountKey, extraKey]);
        });
    });

    describe("scheduleDeleteAccount", () => {
        it("schedules deletion without requiring accountKey", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleDeleteAccount({
                accountId: "0.0.999",
            });

            const tx = scheduleRun.mock.calls[0][0] as AccountDeleteTransaction;
            expect(tx.accountId?.toString()).toBe("0.0.999");
            expect(tx.transferAccountId?.toString()).toBe("0.0.2");
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
