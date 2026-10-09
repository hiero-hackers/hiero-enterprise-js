import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CustomFixedFee,
    TokenFeeScheduleUpdateTransaction,
} from "@hiero-ledger/sdk";
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

describe("TokenFeeScheduleUpdateOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () =>
        run.mock.calls[0][0] as TokenFeeScheduleUpdateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("updates a token's fee schedule with the supplied custom fees", async () => {
        const fee = new CustomFixedFee()
            .setAmount(1)
            .setFeeCollectorAccountId("0.0.1001");

        await service.updateTokenFeeSchedule({
            tokenId: "0.0.500",
            customFees: [fee],
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenFeeScheduleUpdateTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.customFees).toEqual([fee]);
    });

    it("clears all custom fees when an empty array is provided", async () => {
        await service.updateTokenFeeSchedule({
            tokenId: "0.0.500",
            customFees: [],
        });

        const tx = sentTx();
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.customFees).toEqual([]);
    });

    it("sends the TokenFeeScheduleUpdate event", async () => {
        await service.updateTokenFeeSchedule({
            tokenId: "0.0.500",
            customFees: [],
            transactionMemo: "fee schedule memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenFeeScheduleUpdateTransaction),
            expect.objectContaining({ transactionMemo: "fee schedule memo" }),
            expect.objectContaining({
                type: "TokenFeeScheduleUpdate",
                serviceName: "TokenService",
                methodName: "updateTokenFeeSchedule",
            }),
        );
    });

    it("throws when tokenId is missing", async () => {
        await expect(
            service.updateTokenFeeSchedule({
                tokenId: undefined as unknown as string,
                customFees: [],
            }),
        ).rejects.toThrow(/tokenId is required/);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.updateTokenFeeSchedule({
                tokenId: "",
                customFees: [],
            }),
        ).rejects.toThrow(/tokenId cannot be empty/);
    });

    it("throws when customFees is missing", async () => {
        await expect(
            service.updateTokenFeeSchedule({
                tokenId: "0.0.500",
                customFees: undefined as unknown as never,
            }),
        ).rejects.toThrow(/customFees is required/);
    });
});
