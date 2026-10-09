import { describe, it, expect } from "vitest";
import { TokenAssociateValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenAssociateOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenAssociateValidator", () => {
    const validator = new TokenAssociateValidator();

    const baseOptions: TokenAssociateOperationOptions = {
        accountId: "0.0.123",
        tokenId: "0.0.456",
    };

    describe("accountId", () => {
        it("passes with a valid accountId", () => {
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

    describe("tokenId", () => {
        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: null as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
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
});
