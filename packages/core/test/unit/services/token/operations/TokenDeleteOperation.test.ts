import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenDeleteTransaction } from "@hiero-ledger/sdk";
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

describe("TokenDeleteOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenDeleteTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("submits a deletion with tokenId", async () => {
        await service.deleteToken({ tokenId: "0.0.500" });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenDeleteTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
    });

    it("sends the TokenDelete event", async () => {
        await service.deleteToken({
            tokenId: "0.0.500",
            transactionMemo: "delete memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenDeleteTransaction),
            expect.objectContaining({ transactionMemo: "delete memo" }),
            expect.objectContaining({
                type: "TokenDelete",
                serviceName: "TokenService",
                methodName: "deleteToken",
            }),
        );
    });

    it("throws when tokenId is missing", async () => {
        await expect(
            service.deleteToken({
                tokenId: undefined as unknown as string,
            }),
        ).rejects.toThrow(/tokenId is required/);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when tokenId is empty", async () => {
        await expect(service.deleteToken({ tokenId: "" })).rejects.toThrow(
            /tokenId cannot be empty/,
        );
        expect(run).not.toHaveBeenCalled();
    });
});
