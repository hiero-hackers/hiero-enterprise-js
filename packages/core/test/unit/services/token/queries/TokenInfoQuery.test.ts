import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    LedgerId,
    Long,
    PrivateKey,
    Query,
    Timestamp,
    TokenId,
    TokenInfoQuery as SdkTokenInfoQuery,
    TokenSupplyType,
    TokenType,
    type TokenInfo,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data built from real SDK values, because TokenInfo
// has no public constructor.

const adminKey = PrivateKey.generateED25519().publicKey;
const supplyKey = PrivateKey.generateED25519().publicKey;

function tokenInfo(overrides: Partial<TokenInfo> = {}): TokenInfo {
    return {
        tokenId: TokenId.fromString("0.0.1234"),
        name: "Acme Coin",
        symbol: "ACME",
        decimals: 2,
        totalSupply: Long.fromNumber(1_000_000),
        treasuryAccountId: AccountId.fromString("0.0.555"),
        adminKey,
        kycKey: null,
        freezeKey: null,
        pauseKey: null,
        wipeKey: null,
        supplyKey,
        feeScheduleKey: null,
        metadataKey: null,
        defaultFreezeStatus: null,
        defaultKycStatus: null,
        pauseStatus: null,
        isDeleted: false,
        autoRenewAccountId: AccountId.fromString("0.0.555"),
        autoRenewPeriod: { seconds: Long.fromNumber(7_776_000) },
        expirationTime: Timestamp.fromDate(
            new Date("2099-01-02T03:04:05.000Z"),
        ),
        tokenMemo: "demo memo",
        customFees: [],
        tokenType: TokenType.FungibleCommon,
        supplyType: TokenSupplyType.Infinite,
        maxSupply: null,
        ledgerId: LedgerId.MAINNET,
        metadata: null,
        ...overrides,
    } as TokenInfo;
}

describe("TokenInfoQuery (via TokenService)", () => {
    let service: TokenService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = (call = 0) =>
        execute.mock.contexts.at(call) as SdkTokenInfoQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(tokenInfo());
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("queries the token and projects its info to a plain object", async () => {
        const info = await service.getTokenInfo("0.0.1234");

        expect(sentQuery()).toBeInstanceOf(SdkTokenInfoQuery);
        expect(sentQuery().tokenId?.toString()).toBe("0.0.1234");
        expect(info).toEqual({
            tokenId: "0.0.1234",
            name: "Acme Coin",
            symbol: "ACME",
            decimals: 2,
            totalSupply: "1000000",
            treasuryAccountId: "0.0.555",
            adminKey,
            kycKey: null,
            freezeKey: null,
            pauseKey: null,
            wipeKey: null,
            supplyKey,
            feeScheduleKey: null,
            metadataKey: null,
            defaultFreezeStatus: null,
            defaultKycStatus: null,
            pauseStatus: null,
            isDeleted: false,
            autoRenewAccountId: "0.0.555",
            autoRenewPeriod: 7_776_000,
            expirationTime: "2099-01-02T03:04:05.000Z",
            tokenMemo: "demo memo",
            customFees: [],
            tokenType: TokenType.FungibleCommon,
            supplyType: TokenSupplyType.Infinite,
            maxSupply: null,
            ledgerId: "mainnet",
            metadata: null,
        });
    });

    it("accepts a TokenId and stringifies maxSupply when set", async () => {
        const tokenId = TokenId.fromString("0.0.999");
        execute.mockResolvedValueOnce(
            tokenInfo({
                tokenId,
                supplyType: TokenSupplyType.Finite,
                maxSupply: Long.fromString("123456789"),
                tokenType: TokenType.NonFungibleUnique,
                decimals: 0,
                pauseStatus: true,
                isDeleted: true,
            }),
        );

        const info = await service.getTokenInfo(tokenId);

        expect(sentQuery().tokenId?.toString()).toBe("0.0.999");
        expect(info).toMatchObject({
            tokenId: "0.0.999",
            tokenType: TokenType.NonFungibleUnique,
            supplyType: TokenSupplyType.Finite,
            maxSupply: "123456789",
            decimals: 0,
            pauseStatus: true,
            isDeleted: true,
        });
    });

    it("returns null for optional fields the network leaves unset", async () => {
        execute.mockResolvedValueOnce(
            tokenInfo({
                treasuryAccountId: null,
                autoRenewAccountId: null,
                autoRenewPeriod: null,
                expirationTime: null,
                ledgerId: null,
            }),
        );

        const info = await service.getTokenInfo("0.0.1234");

        expect(info.treasuryAccountId).toBeNull();
        expect(info.autoRenewAccountId).toBeNull();
        expect(info.autoRenewPeriod).toBeNull();
        expect(info.expirationTime).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("applies QueryOptions to the query", async () => {
        await service.getTokenInfo("0.0.1234", { nodeAccountIds: ["0.0.3"] });

        expect(sentQuery().nodeAccountIds?.map((id) => id.toString())).toEqual([
            "0.0.3",
        ]);
    });

    it("normalises network errors with the TokenService.getTokenInfo context", async () => {
        execute.mockRejectedValueOnce(new Error("boom from network"));

        await expect(service.getTokenInfo("0.0.1234")).rejects.toMatchObject({
            name: "HieroError",
            context: "TokenService.getTokenInfo",
            message: "boom from network",
        });
    });

    it("builds a new query for every call", async () => {
        await service.getTokenInfo("0.0.1");
        await service.getTokenInfo("0.0.2");

        expect(sentQuery(0)).not.toBe(sentQuery(1));
        expect(sentQuery(1).tokenId?.toString()).toBe("0.0.2");
    });
});
