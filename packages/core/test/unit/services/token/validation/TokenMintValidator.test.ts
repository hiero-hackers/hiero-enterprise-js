import { describe, it, expect } from "vitest";
import { Long } from "@hiero-ledger/sdk";
import BigNumber from "bignumber.js";
import { TokenMintValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenMintOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenMintValidator", () => {
    const validator = new TokenMintValidator();

    const baseOptions: TokenMintOperationOptions = {
        tokenId: "0.0.500",
        amount: 1,
    };

    describe("tokenId", () => {
        it("passes with a valid string tokenId", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: null as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when tokenId is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: undefined as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when tokenId is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenId: "   " }),
            ).toThrow(/tokenId cannot be empty/);
        });
    });

    describe("amount / metadata mutual exclusivity", () => {
        it("throws when neither amount nor metadata is provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                }),
            ).toThrow(
                /requires either amount \(fungible\) or metadata \(NFT\)/i,
            );
        });

        it("throws when both amount and metadata are provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    amount: 5,
                    metadata: [new Uint8Array([1, 2, 3])],
                }),
            ).toThrow(
                /requires either amount \(fungible\) or metadata \(NFT\)/i,
            );
        });

        it("passes when only amount is provided", () => {
            expect(() =>
                validator.validate({ tokenId: "0.0.500", amount: 5 }),
            ).not.toThrow();
        });

        it("passes when only metadata is provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    metadata: [new Uint8Array([1, 2, 3])],
                }),
            ).not.toThrow();
        });
    });

    describe("amount validation", () => {
        it("throws when amount is a negative number", () => {
            expect(() =>
                validator.validate({ tokenId: "0.0.500", amount: -1 }),
            ).toThrow(/amount cannot be negative/);
        });

        it("throws when amount is a negative bigint", () => {
            expect(() =>
                validator.validate({ tokenId: "0.0.500", amount: -1n }),
            ).toThrow(/amount cannot be negative/);
        });

        it("throws when amount is a negative Long", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    amount: Long.fromNumber(-5),
                }),
            ).toThrow(/amount cannot be negative/);
        });

        it("throws when amount is a negative BigNumber", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    amount: new BigNumber(-10),
                }),
            ).toThrow(/amount cannot be negative/);
        });

        it("passes when amount is a positive Long", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    amount: Long.fromNumber(10),
                }),
            ).not.toThrow();
        });

        it("passes when amount is a positive BigNumber", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    amount: new BigNumber(10),
                }),
            ).not.toThrow();
        });

        it("passes when amount is a positive bigint", () => {
            expect(() =>
                validator.validate({ tokenId: "0.0.500", amount: 10n }),
            ).not.toThrow();
        });
    });

    describe("metadata validation", () => {
        it("throws when metadata is an empty array (with amount present)", () => {
            // Note: validateAmountOrMetadata only throws when BOTH are missing;
            // an empty metadata array combined with amount bypasses that check,
            // but validateMetadata still rejects an empty array.
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    amount: 1,
                    metadata: [],
                }),
            ).toThrow(/metadata cannot be an empty array/);
        });
    });
});
