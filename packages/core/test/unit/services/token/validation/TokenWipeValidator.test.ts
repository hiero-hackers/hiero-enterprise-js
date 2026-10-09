import { describe, it, expect } from "vitest";
import { Long } from "@hiero-ledger/sdk";
import BigNumber from "bignumber.js";
import { TokenWipeValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenWipeOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenWipeValidator", () => {
    const validator = new TokenWipeValidator();

    const baseOptions: TokenWipeOperationOptions = {
        tokenId: "0.0.500",
        accountId: "0.0.700",
        amount: 1,
    };

    describe("tokenId", () => {
        it("passes with a valid tokenId, accountId and amount", () => {
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

    describe("accountId", () => {
        it("throws when accountId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    accountId: null as unknown as string,
                }),
            ).toThrow(/accountId is required/);
        });

        it("throws when accountId is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    accountId: undefined as unknown as string,
                }),
            ).toThrow(/accountId is required/);
        });

        it("throws when accountId is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, accountId: "   " }),
            ).toThrow(/accountId cannot be empty/);
        });
    });

    describe("amount / serials mutual exclusivity", () => {
        it("throws when neither amount nor serials is provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                }),
            ).toThrow(
                /requires either amount \(fungible\) or serials \(NFT\)/i,
            );
        });

        it("throws when both amount and serials are provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    amount: 5,
                    serials: [1],
                }),
            ).toThrow(
                /requires either amount \(fungible\) or serials \(NFT\)/i,
            );
        });

        it("passes when only amount is provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    amount: 5,
                }),
            ).not.toThrow();
        });

        it("passes when only serials is provided", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [1, 2, 3],
                }),
            ).not.toThrow();
        });
    });

    describe("amount validation", () => {
        it("throws when amount is a negative number", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: -1 }),
            ).toThrow(/amount cannot be negative/);
        });

        it("throws when amount is a negative bigint", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: -1n }),
            ).toThrow(/amount cannot be negative/);
        });

        it("throws when amount is a negative Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: Long.fromNumber(-5),
                }),
            ).toThrow(/amount cannot be negative/);
        });

        it("throws when amount is a negative BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: new BigNumber(-10),
                }),
            ).toThrow(/amount cannot be negative/);
        });

        it("passes when amount is a positive Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: Long.fromNumber(10),
                }),
            ).not.toThrow();
        });

        it("passes when amount is a positive BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: new BigNumber(10),
                }),
            ).not.toThrow();
        });

        it("passes when amount is a positive bigint", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: 10n }),
            ).not.toThrow();
        });
    });

    describe("serials validation", () => {
        it("throws when serials is an empty array (with amount present)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: 1,
                    serials: [],
                }),
            ).toThrow(/serials cannot be an empty array/);
        });

        it("throws when serials is not an array", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: 1 as unknown as number[],
                }),
            ).toThrow(/serials must be an array/);
        });

        it("throws when a serial is null", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [null as unknown as number],
                }),
            ).toThrow(/serials entries cannot be null/);
        });

        it("throws when a serial is zero", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [0],
                }),
            ).toThrow(/serials entries must be positive integers/);
        });

        it("throws when a serial is negative", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [-1],
                }),
            ).toThrow(/serials entries must be positive integers/);
        });

        it("throws when a Long serial is non-positive", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [Long.fromNumber(0)],
                }),
            ).toThrow(/serials entries must be positive integers/);
        });

        it("throws when a serial is a string", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: ["1" as unknown as number],
                }),
            ).toThrow(/serials entries must be a number or Long/);
        });

        it("throws when a serial is a non-integer number", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [1.5],
                }),
            ).toThrow(/serials entries must be positive integers/);
        });

        it("throws when a serial is NaN", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [Number.NaN],
                }),
            ).toThrow(/serials entries must be positive integers/);
        });

        it("throws when a serial is Infinity", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [Number.POSITIVE_INFINITY],
                }),
            ).toThrow(/serials entries must be positive integers/);
        });

        it("passes with positive Long serials", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    accountId: "0.0.700",
                    serials: [Long.fromNumber(1), Long.fromNumber(2)],
                }),
            ).not.toThrow();
        });
    });
});
