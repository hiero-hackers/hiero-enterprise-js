import { describe, it, expect } from "vitest";
import { AccountId, NftId, TokenId } from "@hiero-ledger/sdk";
import { TokenRejectValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenRejectOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenRejectValidator", () => {
    const validator = new TokenRejectValidator();

    const ownerId = AccountId.fromString("0.0.700");
    const fungibleId = TokenId.fromString("0.0.500");
    const nftId = new NftId(TokenId.fromString("0.0.600"), 1);

    const withFungible = (
        overrides: Partial<TokenRejectOperationOptions> = {},
    ): TokenRejectOperationOptions => ({
        ownerId,
        fungibleTokenIds: [fungibleId],
        ...overrides,
    });

    const withNft = (
        overrides: Partial<TokenRejectOperationOptions> = {},
    ): TokenRejectOperationOptions => ({
        ownerId,
        nftIds: [nftId],
        ...overrides,
    });

    describe("happy path", () => {
        it("passes with a single fungible token id", () => {
            expect(() => validator.validate(withFungible())).not.toThrow();
        });

        it("passes with a single NFT id", () => {
            expect(() => validator.validate(withNft())).not.toThrow();
        });

        it("passes with both fungible and NFT targets", () => {
            expect(() =>
                validator.validate({
                    ownerId,
                    fungibleTokenIds: [fungibleId],
                    nftIds: [nftId],
                }),
            ).not.toThrow();
        });

        it("passes with string ownerId and string fungible token ids", () => {
            expect(() =>
                validator.validate({
                    ownerId: "0.0.700",
                    fungibleTokenIds: ["0.0.500"],
                }),
            ).not.toThrow();
        });
    });

    describe("ownerId", () => {
        it("throws when ownerId is null", () => {
            expect(() =>
                validator.validate(
                    withFungible({
                        ownerId: null as unknown as string,
                    }),
                ),
            ).toThrow(/ownerId is required/);
        });

        it("throws when ownerId is undefined", () => {
            expect(() =>
                validator.validate(
                    withFungible({
                        ownerId: undefined as unknown as string,
                    }),
                ),
            ).toThrow(/ownerId is required/);
        });

        it("throws when ownerId is an empty string", () => {
            expect(() =>
                validator.validate(withFungible({ ownerId: "" })),
            ).toThrow(/ownerId cannot be empty/);
        });

        it("throws when ownerId is whitespace only", () => {
            expect(() =>
                validator.validate(withFungible({ ownerId: "   " })),
            ).toThrow(/ownerId cannot be empty/);
        });
    });

    describe("fungibleTokenIds", () => {
        it("throws when fungibleTokenIds is not an array", () => {
            expect(() =>
                validator.validate(
                    withFungible({
                        fungibleTokenIds: "0.0.500" as unknown as TokenId[],
                    }),
                ),
            ).toThrow(/fungibleTokenIds must be an array/);
        });

        it("throws when fungibleTokenIds contains a null entry", () => {
            expect(() =>
                validator.validate(
                    withFungible({
                        fungibleTokenIds: [null as unknown as TokenId],
                    }),
                ),
            ).toThrow(/fungibleTokenIds entries cannot be null/);
        });

        it("throws when fungibleTokenIds contains an undefined entry", () => {
            expect(() =>
                validator.validate(
                    withFungible({
                        fungibleTokenIds: [undefined as unknown as TokenId],
                    }),
                ),
            ).toThrow(/fungibleTokenIds entries cannot be null/);
        });

        it("throws when fungibleTokenIds contains an empty string", () => {
            expect(() =>
                validator.validate(withFungible({ fungibleTokenIds: [""] })),
            ).toThrow(/fungibleTokenIds entries cannot be empty/);
        });

        it("throws when fungibleTokenIds contains a whitespace-only string", () => {
            expect(() =>
                validator.validate(withFungible({ fungibleTokenIds: ["   "] })),
            ).toThrow(/fungibleTokenIds entries cannot be empty/);
        });
    });

    describe("nftIds", () => {
        it("throws when nftIds is not an array", () => {
            expect(() =>
                validator.validate(
                    withNft({
                        nftIds: "nope" as unknown as NftId[],
                    }),
                ),
            ).toThrow(/nftIds must be an array/);
        });

        it("throws when nftIds contains a null entry", () => {
            expect(() =>
                validator.validate(
                    withNft({
                        nftIds: [null as unknown as NftId],
                    }),
                ),
            ).toThrow(/nftIds entries cannot be null/);
        });

        it("throws when nftIds contains an undefined entry", () => {
            expect(() =>
                validator.validate(
                    withNft({
                        nftIds: [undefined as unknown as NftId],
                    }),
                ),
            ).toThrow(/nftIds entries cannot be null/);
        });
    });

    describe("at least one target", () => {
        it("throws when neither fungibleTokenIds nor nftIds is supplied", () => {
            expect(() => validator.validate({ ownerId })).toThrow(
                /at least one fungibleTokenId or nftId/,
            );
        });

        it("throws when both fungibleTokenIds and nftIds are empty arrays", () => {
            expect(() =>
                validator.validate({
                    ownerId,
                    fungibleTokenIds: [],
                    nftIds: [],
                }),
            ).toThrow(/at least one fungibleTokenId or nftId/);
        });

        it("throws when fungibleTokenIds is null and nftIds is omitted", () => {
            expect(() =>
                validator.validate({
                    ownerId,
                    fungibleTokenIds: null as unknown as TokenId[],
                }),
            ).toThrow(/at least one fungibleTokenId or nftId/);
        });
    });
});
