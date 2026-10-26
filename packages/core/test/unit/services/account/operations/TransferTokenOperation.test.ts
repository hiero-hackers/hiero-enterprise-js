import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TransferTransaction } from "@hiero-ledger/sdk";
import { AccountId, ScheduleId, TokenId } from "@hiero-ledger/sdk";
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

/** Token transfers of a transaction as token -> account -> amount. */
const tokenTransfers = (tx: TransferTransaction) =>
    JSON.parse(JSON.stringify(tx.tokenTransfers)) as Record<
        string,
        Record<string, string>
    >;

describe("TransferTokenOperation (via AccountService)", () => {
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

    // Fungible token transfers
    describe("transferToken", () => {
        it("adds token transfers without decimals by default", async () => {
            await service.transferToken("0.0.456", "0.0.200", 100, "0.0.100");

            const tx = sentTx();
            expect(tokenTransfers(tx)).toEqual({
                "0.0.456": { "0.0.100": "-100", "0.0.200": "100" },
            });
            expect(tx.tokenIdDecimals.get("0.0.456")).toBeNull();
        });

        it("adds token transfers with decimals when expectedDecimals is set", async () => {
            await service.transferToken("0.0.456", "0.0.200", 100, "0.0.100", {
                expectedDecimals: 6,
            });

            const tx = sentTx();
            expect(tokenTransfers(tx)).toEqual({
                "0.0.456": { "0.0.100": "-100", "0.0.200": "100" },
            });
            expect(tx.tokenIdDecimals.get("0.0.456")).toBe(6);
        });

        it("accepts TokenId and AccountId instances", async () => {
            const tokenId = TokenId.fromString("0.0.456");
            const sender = AccountId.fromString("0.0.100");
            const receiver = AccountId.fromString("0.0.200");

            await service.transferToken(tokenId, receiver, 50, sender);

            expect(tokenTransfers(sentTx())).toEqual({
                "0.0.456": { "0.0.100": "-50", "0.0.200": "50" },
            });
        });

        it("rejects non-integer amount", async () => {
            await expect(
                service.transferToken("0.0.456", "0.0.200", 1.5, "0.0.100"),
            ).rejects.toThrow(/amount must be a safe integer/);
        });

        it("rejects when sender equals receiver", async () => {
            await expect(
                service.transferToken("0.0.456", "0.0.100", 100, "0.0.100"),
            ).rejects.toThrow(/must be different/);
        });

        it("rejects when expectedDecimals is negative", async () => {
            await expect(
                service.transferToken("0.0.456", "0.0.200", 100, "0.0.100", {
                    expectedDecimals: -1,
                }),
            ).rejects.toThrow(/expectedDecimals cannot be negative/);
        });
    });

    describe("scheduleTransferToken", () => {
        it("returns the scheduleId and forwards schedule options", async () => {
            const result = await service.scheduleTransferToken(
                "0.0.456",
                "0.0.200",
                100,
                "0.0.100",
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "subscription",
                },
            );

            expect(result.scheduleId.toString()).toBe("0.0.777");
            expect(scheduleRun.mock.calls[0][3]).toMatchObject({
                payerAccountId: "0.0.999",
                scheduleMemo: "subscription",
            });
        });

        it("preserves expectedDecimals in the scheduled inner transaction", async () => {
            await service.scheduleTransferToken(
                "0.0.456",
                "0.0.200",
                100,
                "0.0.100",
                { expectedDecimals: 8 },
            );

            const tx = scheduledTx();
            expect(tokenTransfers(tx)).toEqual({
                "0.0.456": { "0.0.100": "-100", "0.0.200": "100" },
            });
            expect(tx.tokenIdDecimals.get("0.0.456")).toBe(8);
        });
    });
});
