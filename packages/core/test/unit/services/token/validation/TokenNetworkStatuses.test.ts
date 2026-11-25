import { describe, it, expect } from "vitest";
import { Long, Status, TokenType } from "@hiero-ledger/sdk";
import {
    TokenBurnValidator,
    TokenCancelAirdropValidator,
    TokenCreateValidator,
    TokenFreezeValidator,
    TokenMintValidator,
    TokenUpdateValidator,
} from "../../../../../src/services/token/validation/index.js";

const create = {
    tokenName: "Name",
    tokenSymbol: "SYM",
    treasuryAccountId: "0.0.2",
};

describe("token validators name the status the network would return", () => {
    it.each([
        [{ tokenName: "" }, Status.MissingTokenName],
        [{ tokenName: "a".repeat(101) }, Status.TokenNameTooLong],
        [{ tokenSymbol: "" }, Status.MissingTokenSymbol],
        [{ tokenSymbol: "a".repeat(101) }, Status.TokenSymbolTooLong],
        [{ decimals: -1 }, Status.InvalidTokenDecimals],
        [{ initialSupply: -1 }, Status.InvalidTokenInitialSupply],
        [{ maxSupply: -1 }, Status.InvalidTokenMaxSupply],
        [{ tokenMemo: "a".repeat(101) }, Status.MemoTooLong],
        [
            { tokenType: TokenType.NonFungibleUnique },
            Status.TokenHasNoSupplyKey,
        ],
    ])("create %j", (override, status) => {
        expect(() =>
            new TokenCreateValidator().validate({ ...create, ...override }),
        ).toThrow(expect.objectContaining({ sdkStatus: status.toString() }));
    });

    it("update with a name over 100 bytes", () => {
        expect(() =>
            new TokenUpdateValidator().validate({
                tokenId: "0.0.5",
                tokenName: "a".repeat(101),
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.TokenNameTooLong.toString(),
            }),
        );
    });

    it("a missing tokenId and accountId", () => {
        expect(() =>
            new TokenFreezeValidator().validate({
                tokenId: undefined as unknown as string,
                accountId: "0.0.5",
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.InvalidTokenId.toString(),
            }),
        );
        expect(() =>
            new TokenFreezeValidator().validate({
                tokenId: "0.0.5",
                accountId: undefined as unknown as string,
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.InvalidAccountId.toString(),
            }),
        );
    });

    it("a negative mint or burn amount", () => {
        expect(() =>
            new TokenMintValidator().validate({
                tokenId: "0.0.5",
                amount: Long.fromInt(-1),
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.InvalidTokenMintAmount.toString(),
            }),
        );
        expect(() =>
            new TokenBurnValidator().validate({
                tokenId: "0.0.5",
                amount: Long.fromInt(-1),
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.InvalidTokenBurnAmount.toString(),
            }),
        );
    });

    it("an empty pending airdrop list", () => {
        expect(() =>
            new TokenCancelAirdropValidator().validate({
                pendingAirdropIds: [],
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.EmptyPendingAirdropIdList.toString(),
            }),
        );
    });
});
