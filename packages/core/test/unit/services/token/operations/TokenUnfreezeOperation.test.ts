import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrivateKey, TokenUnfreezeTransaction } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenUnfreezeOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenUnfreezeTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("unfreezes a token relationship on an account", async () => {
        await service.unfreezeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenUnfreezeTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.accountId?.toString()).toBe("0.0.700");
    });

    it("passes the options to the executor with the TokenUnfreeze event", async () => {
        const signer = PrivateKey.generateED25519();

        await service.unfreezeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            transactionMemo: "unfreeze memo",
            additionalSigners: [signer],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenUnfreezeTransaction),
            expect.objectContaining({
                transactionMemo: "unfreeze memo",
                additionalSigners: [signer],
            }),
            expect.objectContaining({
                type: "TokenUnfreeze",
                serviceName: "TokenService",
                methodName: "unfreezeToken",
            }),
        );
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.unfreezeToken({
                tokenId: "",
                accountId: "0.0.700",
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);

        expect(run).not.toHaveBeenCalled();
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.unfreezeToken({
                tokenId: "0.0.500",
                accountId: "",
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);

        expect(run).not.toHaveBeenCalled();
    });
});
