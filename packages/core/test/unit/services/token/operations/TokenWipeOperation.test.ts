import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Long, PrivateKey, TokenWipeTransaction } from "@hiero-ledger/sdk";
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

describe("TokenWipeOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenWipeTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("wipes fungible supply from an account", async () => {
        await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            amount: 1_000,
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenWipeTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.accountId?.toString()).toBe("0.0.700");
        expect(tx.amount?.toNumber()).toBe(1_000);
        expect(tx.serials).toEqual(new TokenWipeTransaction().serials);
    });

    it("wipes NFT serials from an account", async () => {
        await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            serials: [1, 2, 3],
        });

        const tx = sentTx();
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.accountId?.toString()).toBe("0.0.700");
        expect(tx.serials?.map((serial) => serial.toNumber())).toEqual([
            1, 2, 3,
        ]);
        expect(tx.amount).toEqual(new TokenWipeTransaction().amount);
    });

    it("passes the options to the executor with the TokenWipe event", async () => {
        const signer = PrivateKey.generateED25519();

        await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            amount: 5,
            transactionMemo: "wipe memo",
            additionalSigners: [signer],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenWipeTransaction),
            expect.objectContaining({
                transactionMemo: "wipe memo",
                additionalSigners: [signer],
            }),
            expect.objectContaining({
                type: "TokenWipe",
                serviceName: "TokenService",
                methodName: "wipeToken",
            }),
        );
    });

    it("returns the transaction floor and the new total supply", async () => {
        const result = await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
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
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "0.0.700",
                amount: 10,
            }),
        ).rejects.toThrow(/TokenWipe receipt did not include totalSupply/);
    });

    it("throws when both amount and serials are missing", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "0.0.700",
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when both amount and serials are provided", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "0.0.700",
                amount: 100,
                serials: [1],
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.wipeToken({
                tokenId: "",
                accountId: "0.0.700",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "",
                amount: 1,
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
    });

    it("throws when accountId is missing", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: undefined as unknown as string,
                amount: 1,
            }),
        ).rejects.toThrow(/accountId is required/i);
    });
});
