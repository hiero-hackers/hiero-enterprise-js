import { describe, it, expect } from "vitest";
import { TokenType, TokenSupplyType, Long } from "@hiero-ledger/sdk";
import BigNumber from "bignumber.js";
import { TokenCreateValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenCreateOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenCreateValidator", () => {
    const validator = new TokenCreateValidator();

    const baseOptions: TokenCreateOperationOptions = {
        tokenName: "Acme Coin",
        tokenSymbol: "ACME",
        treasuryAccountId: "0.0.555",
    };

    describe("tokenName", () => {
        it("passes with a valid name", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when tokenName is missing", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenName: undefined as unknown as string,
                }),
            ).toThrow(/tokenName is required/);
        });

        it("throws when tokenName is empty", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenName: "" }),
            ).toThrow(/tokenName is required/);
        });

        it("throws when tokenName exceeds 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenName: "a".repeat(101),
                }),
            ).toThrow(/tokenName exceeds 100 bytes/);
        });

        it("counts utf-8 bytes, not characters", () => {
            // Each emoji is 4 bytes; 26 emojis = 104 bytes
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenName: "🚀".repeat(26),
                }),
            ).toThrow(/tokenName exceeds 100 bytes/);
        });
    });

    describe("tokenSymbol", () => {
        it("throws when tokenSymbol is missing", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenSymbol: undefined as unknown as string,
                }),
            ).toThrow(/tokenSymbol is required/);
        });

        it("throws when tokenSymbol is empty", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenSymbol: "" }),
            ).toThrow(/tokenSymbol is required/);
        });

        it("throws when tokenSymbol exceeds 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenSymbol: "a".repeat(101),
                }),
            ).toThrow(/tokenSymbol exceeds 100 bytes/);
        });
    });

    describe("treasuryAccountId", () => {
        it("throws when treasuryAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    treasuryAccountId: undefined as unknown as string,
                }),
            ).toThrow(/treasuryAccountId is required/);
        });

        it("throws when treasuryAccountId is an empty string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    treasuryAccountId: "   ",
                }),
            ).toThrow(/treasuryAccountId cannot be empty/);
        });
    });

    describe("numeric ranges", () => {
        it("throws when decimals is negative", () => {
            expect(() =>
                validator.validate({ ...baseOptions, decimals: -1 }),
            ).toThrow(/decimals cannot be negative/);
        });

        it("throws when initialSupply is negative", () => {
            expect(() =>
                validator.validate({ ...baseOptions, initialSupply: -1 }),
            ).toThrow(/initialSupply cannot be negative/);
        });

        it("throws when maxSupply is negative", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxSupply: -1 }),
            ).toThrow(/maxSupply cannot be negative/);
        });

        it("allows zero decimals / initialSupply", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    decimals: 0,
                    initialSupply: 0,
                }),
            ).not.toThrow();
        });

        it("throws when initialSupply is negative bigint", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialSupply: -1n,
                }),
            ).toThrow(/initialSupply cannot be negative/);
        });

        it("throws when maxSupply is negative bigint", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxSupply: -1n,
                }),
            ).toThrow(/maxSupply cannot be negative/);
        });

        it("allows zero bigint values", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialSupply: 0n,
                    maxSupply: 0n,
                }),
            ).not.toThrow();
        });

        it("throws when initialSupply is a negative Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialSupply: Long.fromNumber(-1),
                }),
            ).toThrow(/initialSupply cannot be negative/);
        });

        it("throws when maxSupply is a negative Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxSupply: Long.fromNumber(-1),
                }),
            ).toThrow(/maxSupply cannot be negative/);
        });

        it("throws when initialSupply is a negative BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialSupply: new BigNumber(-1),
                }),
            ).toThrow(/initialSupply cannot be negative/);
        });

        it("throws when maxSupply is a negative BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxSupply: new BigNumber(-1),
                }),
            ).toThrow(/maxSupply cannot be negative/);
        });

        it("allows positive Long values", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialSupply: Long.fromNumber(100),
                    maxSupply: Long.fromNumber(1000),
                }),
            ).not.toThrow();
        });

        it("allows positive BigNumber values", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialSupply: new BigNumber(100),
                    maxSupply: new BigNumber(1000),
                }),
            ).not.toThrow();
        });
    });

    describe("tokenMemo", () => {
        it("allows memo under 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenMemo: "a".repeat(99),
                }),
            ).not.toThrow();
        });

        it("throws when memo exceeds 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenMemo: "a".repeat(101),
                }),
            ).toThrow(/tokenMemo exceeds 100 bytes/);
        });
    });

    describe("finite supply constraints", () => {
        it("throws when supplyType is Finite but maxSupply is missing", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Finite,
                }),
            ).toThrow(/supplyType Finite requires maxSupply/);
        });

        it("throws when supplyType is Finite and maxSupply is 0", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Finite,
                    maxSupply: 0,
                }),
            ).toThrow(/maxSupply must be greater than 0/);
        });

        it("throws when supplyType is Finite and maxSupply is 0n (bigint)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Finite,
                    maxSupply: 0n,
                }),
            ).toThrow(/maxSupply must be greater than 0/);
        });

        it("throws when supplyType is Finite and maxSupply is a zero Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Finite,
                    maxSupply: Long.ZERO,
                }),
            ).toThrow(/maxSupply must be greater than 0/);
        });

        it("throws when supplyType is Finite and maxSupply is a zero BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Finite,
                    maxSupply: new BigNumber(0),
                }),
            ).toThrow(/maxSupply must be greater than 0/);
        });

        it("passes with valid finite supply", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Finite,
                    maxSupply: 10_000,
                }),
            ).not.toThrow();
        });

        it("ignores maxSupply check when supplyType is Infinite", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    supplyType: TokenSupplyType.Infinite,
                }),
            ).not.toThrow();
        });
    });

    describe("non-fungible constraints", () => {
        const nftOptions: TokenCreateOperationOptions = {
            ...baseOptions,
            tokenType: TokenType.NonFungibleUnique,
            supplyKey: {
                _key: "supply",
            } as unknown as TokenCreateOperationOptions["supplyKey"],
        };

        it("passes when supplyKey is set and decimals/initialSupply are 0", () => {
            expect(() =>
                validator.validate({
                    ...nftOptions,
                    decimals: 0,
                    initialSupply: 0,
                }),
            ).not.toThrow();
        });

        it("passes when decimals/initialSupply are 0n (bigint)", () => {
            expect(() =>
                validator.validate({
                    ...nftOptions,
                    // Deliberately outside the declared type: the validator
                    // must accept/reject bad runtime values from untyped JS
                    // callers, so these tests feed it exactly those.
                    decimals: 0n as never,
                    initialSupply: 0n,
                }),
            ).not.toThrow();
        });

        it("throws when supplyKey is missing for NFTs", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenType: TokenType.NonFungibleUnique,
                }),
            ).toThrow(/Non-fungible tokens require a supplyKey/);
        });

        it("throws when decimals is non-zero for NFTs", () => {
            expect(() =>
                validator.validate({ ...nftOptions, decimals: 2 }),
            ).toThrow(/Non-fungible tokens must have decimals: 0/);
        });

        it("throws when initialSupply is non-zero for NFTs", () => {
            expect(() =>
                validator.validate({ ...nftOptions, initialSupply: 5 }),
            ).toThrow(/Non-fungible tokens must have initialSupply: 0/);
        });

        it("throws when initialSupply is non-zero bigint for NFTs", () => {
            expect(() =>
                validator.validate({ ...nftOptions, initialSupply: 1n }),
            ).toThrow(/Non-fungible tokens must have initialSupply: 0/);
        });

        it("throws when initialSupply is non-zero Long for NFTs", () => {
            expect(() =>
                validator.validate({
                    ...nftOptions,
                    initialSupply: Long.fromNumber(1),
                }),
            ).toThrow(/Non-fungible tokens must have initialSupply: 0/);
        });

        it("throws when decimals is non-zero BigNumber for NFTs", () => {
            expect(() =>
                validator.validate({
                    ...nftOptions,
                    decimals: new BigNumber(2) as never,
                }),
            ).toThrow(/Non-fungible tokens must have decimals: 0/);
        });

        it("passes with zero Long for decimals/initialSupply on NFTs", () => {
            expect(() =>
                validator.validate({
                    ...nftOptions,
                    decimals: Long.ZERO,
                    initialSupply: Long.ZERO,
                }),
            ).not.toThrow();
        });

        it("does not enforce NFT constraints for fungible tokens", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenType: TokenType.FungibleCommon,
                    decimals: 8,
                    initialSupply: 1_000_000,
                }),
            ).not.toThrow();
        });
    });
});
