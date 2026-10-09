import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Long, ScheduleId, TokenBurnTransaction } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { totalSupply: Long.fromNumber(1000) },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenBurnOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenBurnTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("burns fungible supply with amount", async () => {
        await service.burnToken({
            tokenId: "0.0.500",
            amount: 1_000,
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenBurnTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.amount?.toNumber()).toBe(1_000);
        expect(tx.serials).toEqual([]);
    });

    it("burns NFT serials", async () => {
        await service.burnToken({
            tokenId: "0.0.500",
            serials: [1, 2, 3],
        });

        const tx = sentTx();
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.serials.map(Number)).toEqual([1, 2, 3]);
        expect(tx.amount).toEqual(new TokenBurnTransaction().amount);
    });

    it("sends the TokenBurn event", async () => {
        await service.burnToken({
            tokenId: "0.0.500",
            amount: 5,
            transactionMemo: "burn memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenBurnTransaction),
            expect.objectContaining({ transactionMemo: "burn memo" }),
            expect.objectContaining({
                type: "TokenBurn",
                serviceName: "TokenService",
                methodName: "burnToken",
            }),
        );
    });

    it("schedules the built transaction with the schedule options", async () => {
        const scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);

        const result = await service.scheduleBurnToken(
            {
                tokenId: "0.0.500",
                amount: 10,
            },
            { scheduleMemo: "pending approval" },
        );

        const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
        expect((tx as TokenBurnTransaction).amount?.toNumber()).toBe(10);
        expect(scheduleOptions).toEqual({ scheduleMemo: "pending approval" });
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("returns the transaction floor and the new total supply", async () => {
        const result = await service.burnToken({
            tokenId: "0.0.500",
            amount: 10,
        });

        expect(result).toMatchObject({
            transactionId: receipt.transactionId,
            status: "SUCCESS",
            totalSupply: "1000",
        });
    });

    it("throws when the receipt is missing totalSupply", async () => {
        run.mockResolvedValueOnce({
            ...receipt,
            receipt: { totalSupply: null },
        } as never);

        await expect(
            service.burnToken({
                tokenId: "0.0.500",
                amount: 10,
            }),
        ).rejects.toThrow(/TokenBurn receipt did not include totalSupply/);
    });

    it("throws when both amount and serials are missing", async () => {
        await expect(
            service.burnToken({
                tokenId: "0.0.500",
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when both amount and serials are provided", async () => {
        await expect(
            service.burnToken({
                tokenId: "0.0.500",
                amount: 100,
                serials: [1],
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.burnToken({
                tokenId: "",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });
});
