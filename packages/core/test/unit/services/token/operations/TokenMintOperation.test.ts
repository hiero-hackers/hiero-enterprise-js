import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    Long,
    PrivateKey,
    ScheduleId,
    TokenMintTransaction,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { totalSupply: Long.fromNumber(1000), serials: [] },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenMintOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenMintTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("mints fungible supply with amount", async () => {
        await service.mintToken({
            tokenId: "0.0.500",
            amount: 1_000,
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenMintTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.amount?.toNumber()).toBe(1_000);
        expect(tx.metadata).toEqual([]);
    });

    it("mints NFTs with metadata entries", async () => {
        const metadata = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];

        await service.mintToken({
            tokenId: "0.0.500",
            metadata,
        });

        const tx = sentTx();
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.metadata).toEqual(metadata);
        expect(tx.amount).toEqual(new TokenMintTransaction().amount);
    });

    it("refuses to fabricate totalSupply when the receipt lacks it", async () => {
        run.mockResolvedValueOnce({
            ...receipt,
            receipt: { totalSupply: null, serials: [] },
        } as never);

        await expect(
            service.mintToken({
                tokenId: "0.0.500",
                metadata: [new Uint8Array([1])],
            }),
        ).rejects.toThrow(/did not include totalSupply/);
    });

    it("returns the floor, plain-number serials, and total supply", async () => {
        run.mockResolvedValueOnce({
            ...receipt,
            receipt: {
                totalSupply: Long.fromNumber(1000),
                serials: [Long.fromNumber(7), Long.fromNumber(8)],
            },
        } as never);

        const result = await service.mintToken({
            tokenId: "0.0.500",
            metadata: [new Uint8Array([1])],
        });

        expect(result).toMatchObject({
            transactionId: receipt.transactionId,
            status: "SUCCESS",
            serials: [7, 8],
            totalSupply: "1000",
        });
    });

    it("passes the options to the executor with the TokenMint event", async () => {
        const signer = PrivateKey.generateED25519();

        await service.mintToken({
            tokenId: "0.0.500",
            amount: 5,
            transactionMemo: "mint memo",
            additionalSigners: [signer],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenMintTransaction),
            expect.objectContaining({
                transactionMemo: "mint memo",
                additionalSigners: [signer],
            }),
            expect.objectContaining({
                type: "TokenMint",
                serviceName: "TokenService",
                methodName: "mintToken",
            }),
        );
    });

    it("schedules the built mint with the schedule options", async () => {
        const scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);

        const result = await service.scheduleMintToken(
            {
                tokenId: "0.0.500",
                amount: 10,
            },
            { scheduleMemo: "pending approval" },
        );

        const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
        expect(tx).toBeInstanceOf(TokenMintTransaction);
        expect((tx as TokenMintTransaction).amount?.toNumber()).toBe(10);
        expect(scheduleOptions).toEqual({ scheduleMemo: "pending approval" });
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("throws when both amount and metadata are missing", async () => {
        await expect(
            service.mintToken({
                tokenId: "0.0.500",
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or metadata/i);
    });

    it("throws when both amount and metadata are provided", async () => {
        const metadata = [new Uint8Array([1, 2, 3])];

        await expect(
            service.mintToken({
                tokenId: "0.0.500",
                amount: 100,
                metadata,
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or metadata/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.mintToken({
                tokenId: "",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });
});
