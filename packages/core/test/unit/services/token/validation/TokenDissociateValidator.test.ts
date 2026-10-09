import { describe, it, expect } from "vitest";
import { TokenDissociateValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenDissociateOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenDissociateValidator", () => {
    const validator = new TokenDissociateValidator();

    const baseOptions: TokenDissociateOperationOptions = {
        accountId: "0.0.123",
        tokenIds: ["0.0.456"],
    };

    describe("accountId", () => {
        it("passes with valid accountId and tokenIds", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when accountId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    accountId: null as unknown as string,
                }),
            ).toThrow(/accountId is required/);
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    accountId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
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

    describe("tokenIds", () => {
        it("accepts multiple token ids", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenIds: ["0.0.456", "0.0.789"],
                }),
            ).not.toThrow();
        });

        it("throws when tokenIds is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenIds: null as unknown as string[],
                }),
            ).toThrow(/tokenIds is required/);
        });

        it("throws when tokenIds is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenIds: undefined as unknown as string[],
                }),
            ).toThrow(/tokenIds is required/);
        });

        it("throws when tokenIds is not an array", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenIds: "0.0.456" as unknown as string[],
                }),
            ).toThrow(/tokenIds must be an array/);
        });

        it("throws when tokenIds is an empty array", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenIds: [] }),
            ).toThrow(/tokenIds must contain at least one token id/);
        });

        it("throws when an entry is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenIds: [null as unknown as string],
                }),
            ).toThrow(/tokenIds entries cannot be null/);
        });

        it("throws when an entry is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenIds: ["   "] }),
            ).toThrow(/tokenIds entries cannot be empty/);
        });

        it("throws when a later entry is empty", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenIds: ["0.0.456", ""],
                }),
            ).toThrow(/tokenIds entries cannot be empty/);
        });
    });
});
