import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountId,
    NftId,
    PrivateKey,
    TokenId,
    TokenRejectFlow,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

interface MockFlow {
    setOwnerId: ReturnType<typeof vi.fn>;
    setTokenIds: ReturnType<typeof vi.fn>;
    setNftIds: ReturnType<typeof vi.fn>;
    freezeWith: ReturnType<typeof vi.fn>;
    sign: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
}

const mocks = await vi.hoisted(async () => {
    const { vi: viHoisted } = await import("vitest");

    const response = {
        transactionId: { toString: () => "0.0.123@1234567890.000000000" },
    };

    const flow: MockFlow = {
        setOwnerId: viHoisted.fn().mockReturnThis(),
        setTokenIds: viHoisted.fn().mockReturnThis(),
        setNftIds: viHoisted.fn().mockReturnThis(),
        freezeWith: viHoisted.fn().mockReturnThis(),
        sign: viHoisted.fn().mockReturnThis(),
        execute: viHoisted.fn().mockResolvedValue(response),
    };

    return { flow, response };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenRejectFlow: vi.fn(function () {
            return mocks.flow;
        }),
    };
});

describe("TokenRejectOperation (via TokenService.rejectTokensFlow)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Re-attach the fluent chain that clearAllMocks() wipes
        mocks.flow.setOwnerId.mockReturnThis();
        mocks.flow.setTokenIds.mockReturnThis();
        mocks.flow.setNftIds.mockReturnThis();
        mocks.flow.freezeWith.mockReturnThis();
        mocks.flow.sign.mockReturnThis();
        mocks.flow.execute.mockResolvedValue(mocks.response);

        context = createMockContext();
        service = new TokenService(context);
    });

    it("rejects fungible tokens through TokenRejectFlow", async () => {
        const tokenId = TokenId.fromString("0.0.500");

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: [tokenId],
        });

        expect(TokenRejectFlow).toHaveBeenCalledTimes(1);
        expect(mocks.flow.setOwnerId).toHaveBeenCalledWith(
            AccountId.fromString("0.0.700"),
        );
        expect(mocks.flow.setTokenIds).toHaveBeenCalledWith([tokenId]);
        expect(mocks.flow.setNftIds).not.toHaveBeenCalled();
        expect(mocks.flow.freezeWith).toHaveBeenCalledWith(context.client);
        expect(mocks.flow.execute).toHaveBeenCalledWith(context.client);
    });

    it("rejects NFT serials through TokenRejectFlow", async () => {
        const nftId = new NftId(TokenId.fromString("0.0.9999"), 3);

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            nftIds: [nftId],
        });

        expect(mocks.flow.setNftIds).toHaveBeenCalledWith([nftId]);
        expect(mocks.flow.setTokenIds).not.toHaveBeenCalled();
    });

    it("rejects fungible tokens and NFT serials in a single flow", async () => {
        const fungibleId = TokenId.fromString("0.0.1234");
        const nftId = new NftId(TokenId.fromString("0.0.9999"), 3);

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: [fungibleId],
            nftIds: [nftId],
        });

        expect(mocks.flow.setTokenIds).toHaveBeenCalledWith([fungibleId]);
        expect(mocks.flow.setNftIds).toHaveBeenCalledWith([nftId]);
    });

    it("accepts an AccountId instance for ownerId without conversion", async () => {
        const ownerId = AccountId.fromString("0.0.700");

        await service.rejectTokensFlow({
            ownerId,
            fungibleTokenIds: ["0.0.500"],
        });

        expect(mocks.flow.setOwnerId).toHaveBeenCalledWith(ownerId);
    });

    it("applies ownerKey via flow.sign() after freezing", async () => {
        const ownerKey = PrivateKey.generateED25519();

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
            ownerKey,
        });

        // Freeze must come before sign so the signature attaches to a stable hash.
        expect(mocks.flow.freezeWith).toHaveBeenCalledWith(context.client);
        expect(mocks.flow.sign).toHaveBeenCalledWith(ownerKey);

        const freezeOrder = mocks.flow.freezeWith.mock.invocationCallOrder[0];
        const signOrder = mocks.flow.sign.mock.invocationCallOrder[0];
        expect(freezeOrder).toBeLessThan(signOrder);
    });

    it("does not call sign() when ownerKey is omitted", async () => {
        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(mocks.flow.sign).not.toHaveBeenCalled();
    });

    it("emits before/after transaction events", async () => {
        const beforeSpy = vi.spyOn(context, "emitBeforeTransaction");
        const afterSpy = vi.spyOn(context, "emitAfterTransaction");

        await service.rejectTokensFlow({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(beforeSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "TokenRejectFlow",
                serviceName: "TokenService",
                methodName: "rejectTokensFlow",
            }),
        );
        expect(afterSpy).toHaveBeenCalledWith(
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
        mocks.flow.execute.mockRejectedValueOnce(failure);

        const afterSpy = vi.spyOn(context, "emitAfterTransaction");

        await expect(
            service.rejectTokensFlow({
                ownerId: "0.0.700",
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/network down/);

        expect(afterSpy).toHaveBeenCalledWith(
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
