import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    Hbar,
    PrivateKey,
    ScheduleId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/MockContext.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

/** HBAR transfers of a transaction as account -> HBAR. */
const hbarTransfers = (tx: TransferTransaction) =>
    tx.hbarTransfersList.map((t) => [
        t.accountId.toString(),
        t.amount.toBigNumber().toNumber(),
    ]);

describe("TransferHbarOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;
    let scheduleRun: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TransferTransaction;

    /** The transaction handed to the executor to schedule. */
    const scheduledTx = () =>
        scheduleRun.mock.calls[0][0] as TransferTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // HBAR transfers
    describe("transferHbar", () => {
        it("returns the transaction id and status (#134)", async () => {
            const result = await service.transferHbar("0.0.200", 5, "0.0.100");

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
        });

        it("debits the sender and credits the receiver", async () => {
            await service.transferHbar("0.0.200", 5, "0.0.100");

            const tx = sentTx();
            expect(tx).toBeInstanceOf(TransferTransaction);
            expect(hbarTransfers(tx)).toEqual([
                ["0.0.100", -5],
                ["0.0.200", 5],
            ]);
        });

        it("accepts an Hbar amount", async () => {
            await service.transferHbar("0.0.200", new Hbar(7), "0.0.100");

            expect(hbarTransfers(sentTx())).toEqual([
                ["0.0.100", -7],
                ["0.0.200", 7],
            ]);
        });

        it("accepts AccountId instances for sender and receiver", async () => {
            const sender = AccountId.fromString("0.0.100");
            const receiver = AccountId.fromString("0.0.200");
            await service.transferHbar(receiver, 1, sender);

            expect(hbarTransfers(sentTx())).toEqual([
                ["0.0.100", -1],
                ["0.0.200", 1],
            ]);
        });

        it("forwards additionalSigners to the executor", async () => {
            const senderKey = PrivateKey.generateED25519();
            await service.transferHbar("0.0.200", 5, "0.0.100", {
                additionalSigners: [senderKey],
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TransferTransaction),
                expect.objectContaining({ additionalSigners: [senderKey] }),
                expect.objectContaining({
                    type: "CryptoTransfer",
                    methodName: "transferHbar",
                }),
            );
        });

        it("rejects when sender equals receiver", async () => {
            await expect(
                service.transferHbar("0.0.100", 5, "0.0.100"),
            ).rejects.toThrow(/must be different/);
            expect(run).not.toHaveBeenCalled();
        });

        it("rejects when amount is zero", async () => {
            await expect(
                service.transferHbar("0.0.200", 0, "0.0.100"),
            ).rejects.toThrow(/amount must be positive/);
        });

        it("rejects when amount is negative", async () => {
            await expect(
                service.transferHbar("0.0.200", -1, "0.0.100"),
            ).rejects.toThrow(/amount must be positive/);
        });
    });

    describe("scheduleTransferHbar", () => {
        it("schedules the transfer and returns the scheduleId", async () => {
            const result = await service.scheduleTransferHbar(
                "0.0.200",
                5,
                "0.0.100",
            );

            expect(scheduleRun).toHaveBeenCalledTimes(1);
            expect(hbarTransfers(scheduledTx())).toEqual([
                ["0.0.100", -5],
                ["0.0.200", 5],
            ]);
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });

        it("forwards schedule-specific options (payer, adminKey, memo)", async () => {
            const adminKey = PrivateKey.generateED25519();
            await service.scheduleTransferHbar("0.0.200", 5, "0.0.100", {
                payerAccountId: "0.0.999",
                adminKey,
                scheduleMemo: "rent",
            });

            expect(scheduleRun.mock.calls[0][3]).toEqual({
                payerAccountId: "0.0.999",
                adminKey,
                scheduleMemo: "rent",
            });
        });

        it("does not pass schedule options into the inner transaction", async () => {
            await service.scheduleTransferHbar("0.0.200", 5, "0.0.100", {
                payerAccountId: "0.0.999",
                scheduleMemo: "rent",
                maxTransactionFee: 3,
            });

            expect(scheduleRun.mock.calls[0][1]).toEqual({
                receiverAccountId: "0.0.200",
                amount: 5,
                senderAccountId: "0.0.100",
                maxTransactionFee: 3,
            });
            expect(scheduleRun.mock.calls[0][3]).toEqual({
                payerAccountId: "0.0.999",
                adminKey: undefined,
                scheduleMemo: "rent",
            });
        });
    });
});
