import { describe, it, expect } from "vitest";
import { TokenDeleteValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenDeleteOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenDeleteValidator", () => {
    const validator = new TokenDeleteValidator();

    const baseOptions: TokenDeleteOperationOptions = {
        tokenId: "0.0.500",
    };

    describe("tokenId", () => {
        it("passes with a valid tokenId", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validate({
                    tokenId: null as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
            expect(() =>
                validator.validate({
                    tokenId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when tokenId is undefined", () => {
            expect(() =>
                validator.validate({
                    tokenId: undefined as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when tokenId is an empty string", () => {
            expect(() => validator.validate({ tokenId: "" })).toThrow(
                /tokenId cannot be empty/,
            );
        });

        it("throws when tokenId is whitespace only", () => {
            expect(() => validator.validate({ tokenId: "   " })).toThrow(
                /tokenId cannot be empty/,
            );
        });
    });
});
