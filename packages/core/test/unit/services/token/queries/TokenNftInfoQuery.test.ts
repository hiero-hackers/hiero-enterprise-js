import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    LedgerId,
    NftId,
    Query,
    Timestamp,
    TokenId,
    TokenNftInfoQuery as SdkTokenNftInfoQuery,
    type TokenNftInfo,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data built from real SDK values, because
// TokenNftInfo has no public constructor.

function nftInfo(overrides: Partial<TokenNftInfo> = {}): TokenNftInfo {
    return {
        nftId: new NftId(TokenId.fromString("0.0.1234"), 7),
        accountId: AccountId.fromString("0.0.555"),
        creationTime: Timestamp.fromDate(new Date("2024-01-02T03:04:05.000Z")),
        metadata: new Uint8Array([1, 2, 3]),
        spenderId: AccountId.fromString("0.0.999"),
        ledgerId: LedgerId.TESTNET,
        ...overrides,
    } as TokenNftInfo;
}

describe("TokenNftInfoQuery (via TokenService)", () => {
    let service: TokenService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = (call = 0) =>
        execute.mock.contexts.at(call) as SdkTokenNftInfoQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue([nftInfo()]);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("fetches and projects the first NFT info entry to a plain object", async () => {
        const info = await service.getNftInfo("0.0.1234/7");

        expect(sentQuery()).toBeInstanceOf(SdkTokenNftInfoQuery);
        expect(sentQuery().nftId?.toString()).toBe("0.0.1234/7");
        expect(info).toEqual({
            nftId: "0.0.1234/7",
            tokenId: "0.0.1234",
            serial: "7",
            accountId: "0.0.555",
            creationTime: "2024-01-02T03:04:05.000Z",
            metadata: new Uint8Array([1, 2, 3]),
            spenderId: "0.0.999",
            ledgerId: "testnet",
        });
    });

    it("accepts an NftId instance", async () => {
        const nftId = new NftId(TokenId.fromString("0.0.4321"), 3);
        execute.mockResolvedValueOnce([
            nftInfo({ nftId, accountId: AccountId.fromString("0.0.700") }),
        ]);

        const info = await service.getNftInfo(nftId);

        expect(sentQuery().nftId?.toString()).toBe("0.0.4321/3");
        expect(info.nftId).toBe("0.0.4321/3");
        expect(info.tokenId).toBe("0.0.4321");
        expect(info.serial).toBe("3");
        expect(info.accountId).toBe("0.0.700");
    });

    it("returns null for optional fields when the SDK reports them as null", async () => {
        execute.mockResolvedValueOnce([
            nftInfo({ metadata: null, spenderId: null, ledgerId: null }),
        ]);

        const info = await service.getNftInfo("0.0.1234/7");

        expect(info.metadata).toBeNull();
        expect(info.spenderId).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("throws a NotFound HieroError when the SDK returns an empty list", async () => {
        execute.mockResolvedValueOnce([]);

        await expect(service.getNftInfo("0.0.1234/7")).rejects.toMatchObject({
            name: "HieroError",
            code: "NOT_FOUND",
            context: "TokenService.getNftInfo",
        });
    });

    it("normalises SDK errors with the TokenService.getNftInfo context", async () => {
        execute.mockRejectedValueOnce(new Error("network is down"));

        await expect(service.getNftInfo("0.0.1234/7")).rejects.toMatchObject({
            name: "HieroError",
            context: "TokenService.getNftInfo",
            message: "network is down",
        });
    });

    it("builds a new query for every call", async () => {
        await service.getNftInfo("0.0.1/1");
        await service.getNftInfo("0.0.2/2");

        expect(sentQuery(0)).not.toBe(sentQuery(1));
        expect(sentQuery(1).nftId?.toString()).toBe("0.0.2/2");
    });
});
