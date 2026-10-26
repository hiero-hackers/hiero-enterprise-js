import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    PrivateKey,
    ScheduleId,
    TokenId,
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

describe("TransferNftOperation (via AccountService)", () => {
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

    // NFT transfers
    describe("transferNft", () => {
        it("adds an NFT transfer for the token serial", async () => {
            await service.transferNft("0.0.789", 7, "0.0.200", "0.0.100");

            const transfers = sentTx().nftTransfers.get("0.0.789");
            expect(transfers).toHaveLength(1);
            const [transfer] = transfers!;
            expect(transfer.serial.toNumber()).toBe(7);
            expect(transfer.sender.toString()).toBe("0.0.100");
            expect(transfer.recipient.toString()).toBe("0.0.200");
        });

        it("accepts a TokenId instance for tokenId", async () => {
            const tokenId = TokenId.fromString("0.0.789");
            await service.transferNft(tokenId, 1, "0.0.200", "0.0.100");

            expect(sentTx().nftTransfers.get("0.0.789")).toHaveLength(1);
        });

        it("forwards additionalSigners to the executor", async () => {
            const senderKey = PrivateKey.generateED25519();
            await service.transferNft("0.0.789", 1, "0.0.200", "0.0.100", {
                additionalSigners: [senderKey],
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TransferTransaction),
                expect.objectContaining({ additionalSigners: [senderKey] }),
                expect.objectContaining({ methodName: "transferNft" }),
            );
        });

        it("rejects when serial is zero", async () => {
            await expect(
                service.transferNft("0.0.789", 0, "0.0.200", "0.0.100"),
            ).rejects.toThrow(/serial must be positive/);
        });

        it("rejects when serial is fractional", async () => {
            await expect(
                service.transferNft("0.0.789", 1.5, "0.0.200", "0.0.100"),
            ).rejects.toThrow(/serial must be a safe integer/);
        });

        it("rejects when sender equals receiver", async () => {
            await expect(
                service.transferNft("0.0.789", 1, "0.0.100", "0.0.100"),
            ).rejects.toThrow(/must be different/);
        });
    });

    describe("scheduleTransferNft", () => {
        it("returns the scheduleId and forwards schedule options", async () => {
            const result = await service.scheduleTransferNft(
                "0.0.789",
                1,
                "0.0.200",
                "0.0.100",
                { scheduleMemo: "nft handoff" },
            );

            expect(result.scheduleId.toString()).toBe("0.0.777");
            expect(scheduledTx().nftTransfers.get("0.0.789")).toHaveLength(1);
            expect(scheduleRun.mock.calls[0][3]).toMatchObject({
                scheduleMemo: "nft handoff",
            });
        });
    });
});
