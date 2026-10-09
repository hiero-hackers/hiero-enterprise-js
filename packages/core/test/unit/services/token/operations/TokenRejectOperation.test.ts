import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    NftId,
    PrivateKey,
    TokenId,
    TokenRejectFlow,
    TransactionId,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds a real SDK TokenRejectFlow; only its execute(), which sends the
// reject and dissociate transactions, is stubbed.

const response = {
    transactionId: TransactionId.fromString("0.0.123@1234567890.000000000"),
};

describe("TokenRejectOperation (via TokenService.rejectTokensFlow)", () => {
    let context: IHieroContext;
    let service: TokenService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The flow that was executed. */
    const sentFlow = () => execute.mock.contexts[0] as TokenRejectFlow;

    beforeEach(() => {
        execute = vi
            .spyOn(TokenRejectFlow.prototype, "execute")
            .mockResolvedValue(response as never);
        context = createMockContext();
        service = new TokenService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("rejects fungible tokens through TokenRejectFlow", async () => {
        const tokenId = TokenId.fromString("0.0.500");

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: [tokenId],
        });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(context.client);
        const flow = sentFlow();
        expect(flow).toBeInstanceOf(TokenRejectFlow);
        expect(flow.ownerId).toEqual(AccountId.fromString("0.0.700"));
        expect(flow.tokenIds).toEqual([tokenId]);
        expect(flow.nftIds).toEqual([]);
    });

    it("rejects NFT serials through TokenRejectFlow", async () => {
        const nftId = new NftId(TokenId.fromString("0.0.9999"), 3);

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            nftIds: [nftId],
        });

        expect(sentFlow().nftIds).toEqual([nftId]);
        expect(sentFlow().tokenIds).toEqual([]);
    });

    it("rejects fungible tokens and NFT serials in a single flow", async () => {
        const fungibleId = TokenId.fromString("0.0.1234");
        const nftId = new NftId(TokenId.fromString("0.0.9999"), 3);

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: [fungibleId],
            nftIds: [nftId],
        });

        expect(sentFlow().tokenIds).toEqual([fungibleId]);
        expect(sentFlow().nftIds).toEqual([nftId]);
    });

    it("accepts an AccountId instance for ownerId without conversion", async () => {
        const ownerId = AccountId.fromString("0.0.700");

        await service.rejectTokensFlow({
            ownerId,
            fungibleTokenIds: ["0.0.500"],
        });

        expect(sentFlow().ownerId).toBe(ownerId);
    });

    it("applies ownerKey via flow.sign() after freezing", async () => {
        // The flow has no getters for its client or key, so spy on the calls.
        const freezeWith = vi.spyOn(TokenRejectFlow.prototype, "freezeWith");
        const sign = vi.spyOn(TokenRejectFlow.prototype, "sign");
        const ownerKey = PrivateKey.generateED25519();

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
            ownerKey,
        });

        // Freeze must come before sign so the signature attaches to a stable hash.
        expect(freezeWith).toHaveBeenCalledWith(context.client);
        expect(sign).toHaveBeenCalledWith(ownerKey);
        expect(freezeWith.mock.invocationCallOrder[0]).toBeLessThan(
            sign.mock.invocationCallOrder[0],
        );
    });

    it("does not call sign() when ownerKey is omitted", async () => {
        const sign = vi.spyOn(TokenRejectFlow.prototype, "sign");

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(sign).not.toHaveBeenCalled();
    });

    it("emits before/after transaction events", async () => {
        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "TokenRejectFlow",
                serviceName: "TokenService",
                methodName: "rejectTokensFlow",
            }),
        );
        expect(context.emitAfterTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "TokenRejectFlow",
                status: "SUCCESS",
                transactionId: "0.0.123@1234567890.000000000",
            }),
        );
    });

    it("emits the after-event once when emitting the success event fails", async () => {
        vi.mocked(context.emitAfterTransaction).mockRejectedValueOnce(
            new Error("listener bug"),
        );

        await service
            .rejectTokensFlow({
                ownerId: "0.0.700",
                fungibleTokenIds: ["0.0.500"],
            })
            .catch(() => undefined);

        expect(context.emitAfterTransaction).toHaveBeenCalledTimes(1);
    });

    it("emits the after-event with the error and rethrows when the flow fails", async () => {
        const failure = new Error("network down");
        execute.mockRejectedValueOnce(failure);

        await expect(
            service.rejectTokensFlow({
                ownerId: "0.0.700",
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/network down/);

        expect(context.emitAfterTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "TokenRejectFlow",
                error: failure,
            }),
        );
    });

    it("throws when ownerId is missing", async () => {
        await expect(
            service.rejectTokensFlow({
                ownerId: undefined as unknown as string,
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/ownerId is required/i);
    });

    it("throws when ownerId is empty", async () => {
        await expect(
            service.rejectTokensFlow({
                ownerId: "",
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/ownerId cannot be empty/i);
    });

    it("throws when neither fungibleTokenIds nor nftIds is supplied", async () => {
        await expect(
            service.rejectTokensFlow({
                ownerId: "0.0.700",
            }),
        ).rejects.toThrow(/at least one fungibleTokenId or nftId/i);
    });

    it("throws when both fungibleTokenIds and nftIds are empty arrays", async () => {
        await expect(
            service.rejectTokensFlow({
                ownerId: "0.0.700",
                fungibleTokenIds: [],
                nftIds: [],
            }),
        ).rejects.toThrow(/at least one fungibleTokenId or nftId/i);
    });

    it("throws when fungibleTokenIds contains an empty string", async () => {
        await expect(
            service.rejectTokensFlow({
                ownerId: "0.0.700",
                fungibleTokenIds: [""],
            }),
        ).rejects.toThrow(/fungibleTokenIds entries cannot be empty/i);
    });

    it("throws when nftIds contains a null entry", async () => {
        await expect(
            service.rejectTokensFlow({
                ownerId: "0.0.700",
                nftIds: [null as unknown as NftId],
            }),
        ).rejects.toThrow(/nftIds entries cannot be null/i);
    });
});
