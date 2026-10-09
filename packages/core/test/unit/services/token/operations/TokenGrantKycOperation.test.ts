import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrivateKey, TokenGrantKycTransaction } from "@hiero-ledger/sdk";
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

describe("TokenGrantKycOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenGrantKycTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("grants KYC on a token relationship to an account", async () => {
        await service.grantKycToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenGrantKycTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.accountId?.toString()).toBe("0.0.700");
    });

    it("passes the options to the executor with the TokenGrantKyc event", async () => {
        const signer = PrivateKey.generateED25519();

        await service.grantKycToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            transactionMemo: "grant kyc memo",
            additionalSigners: [signer],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenGrantKycTransaction),
            expect.objectContaining({
                transactionMemo: "grant kyc memo",
                additionalSigners: [signer],
            }),
            expect.objectContaining({
                type: "TokenGrantKyc",
                serviceName: "TokenService",
                methodName: "grantKycToken",
            }),
        );
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.grantKycToken({
                tokenId: "",
                accountId: "0.0.700",
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);

        expect(run).not.toHaveBeenCalled();
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.grantKycToken({
                tokenId: "0.0.500",
                accountId: "",
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);

        expect(run).not.toHaveBeenCalled();
    });
});
