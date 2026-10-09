import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrivateKey, TokenUnpauseTransaction } from "@hiero-ledger/sdk";
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

describe("TokenUnpauseOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenUnpauseTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("unpauses a token", async () => {
        await service.unpauseToken({ tokenId: "0.0.500" });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenUnpauseTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
    });

    it("passes the options to the executor with the TokenUnpause event", async () => {
        const signer = PrivateKey.generateED25519();

        await service.unpauseToken({
            tokenId: "0.0.500",
            transactionMemo: "unpause memo",
            additionalSigners: [signer],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenUnpauseTransaction),
            expect.objectContaining({
                transactionMemo: "unpause memo",
                additionalSigners: [signer],
            }),
            expect.objectContaining({
                type: "TokenUnpause",
                serviceName: "TokenService",
                methodName: "unpauseToken",
            }),
        );
    });

    it("throws when tokenId is missing", async () => {
        await expect(
            service.unpauseToken({
                tokenId: undefined as unknown as string,
            }),
        ).rejects.toThrow(/tokenId is required/);

        expect(run).not.toHaveBeenCalled();
    });

    it("throws when tokenId is empty", async () => {
        await expect(service.unpauseToken({ tokenId: "" })).rejects.toThrow(
            /tokenId cannot be empty/,
        );

        expect(run).not.toHaveBeenCalled();
    });
});
