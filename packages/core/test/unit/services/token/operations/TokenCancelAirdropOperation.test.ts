import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    NftId,
    PendingAirdropId,
    TokenCancelAirdropTransaction,
    TokenId,
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

describe("TokenCancelAirdropOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenCancelAirdropTransaction;

    const fungiblePending = new PendingAirdropId({
        senderId: AccountId.fromString("0.0.700"),
        receiverId: AccountId.fromString("0.0.800"),
        tokenId: TokenId.fromString("0.0.500"),
    });

    const nftPending = new PendingAirdropId({
        senderId: AccountId.fromString("0.0.700"),
        receiverId: AccountId.fromString("0.0.800"),
        nftId: new NftId(TokenId.fromString("0.0.600"), 1),
    });

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("cancels a single fungible pending airdrop", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [fungiblePending],
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenCancelAirdropTransaction);
        expect(tx.pendingAirdropIds).toEqual([fungiblePending]);
    });

    it("cancels a single NFT pending airdrop", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [nftPending],
        });

        expect(sentTx().pendingAirdropIds).toEqual([nftPending]);
    });

    it("batches fungible and NFT pending airdrops in a single cancel transaction", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [fungiblePending, nftPending],
        });

        expect(run).toHaveBeenCalledTimes(1);
        expect(sentTx().pendingAirdropIds).toEqual([
            fungiblePending,
            nftPending,
        ]);
    });

    it("sends the TokenCancelAirdrop event", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [fungiblePending],
            transactionMemo: "cancel test",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenCancelAirdropTransaction),
            expect.objectContaining({ transactionMemo: "cancel test" }),
            expect.objectContaining({
                type: "TokenCancelAirdrop",
                serviceName: "TokenService",
                methodName: "cancelAirdrop",
            }),
        );
    });

    it("normalises and rethrows validation errors before building a transaction", async () => {
        await expect(
            service.cancelAirdrop({
                pendingAirdropIds: [],
            }),
        ).rejects.toThrow(/pendingAirdropIds must not be empty/);

        expect(run).not.toHaveBeenCalled();
    });

    it("rejects null entries inside pendingAirdropIds", async () => {
        await expect(
            service.cancelAirdrop({
                pendingAirdropIds: [
                    fungiblePending,
                    null as unknown as PendingAirdropId,
                ],
            }),
        ).rejects.toThrow(/pendingAirdropIds\[1\] is required/);

        expect(run).not.toHaveBeenCalled();
    });
});
