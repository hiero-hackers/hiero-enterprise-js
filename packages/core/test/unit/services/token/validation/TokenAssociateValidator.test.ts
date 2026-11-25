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
            ).toThrow(/tokenId or tokenIds is required/);
        });

        it("throws when neither tokenId nor tokenIds is set", () => {
            expect(() => validator.validate({ accountId: "0.0.123" })).toThrow(
                /tokenId or tokenIds is required/,
            );
            expect(() => validator.validate({ accountId: "0.0.123" })).toThrow(
                expect.objectContaining({ code: "INPUT_INVALID" }),
            );
        });

        it("throws when tokenId is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenId: "   " }),
            ).toThrow(/tokenId cannot be empty/);
        });
    });

    describe("tokenIds", () => {
        const idsOptions: TokenAssociateOperationOptions = {
            accountId: "0.0.123",
            tokenIds: ["0.0.456", "0.0.789"],
        };

        it("accepts several token ids", () => {
            expect(() => validator.validate(idsOptions)).not.toThrow();
        });

        it("leaves an empty list to the network", () => {
            expect(() =>
                validator.validate({ ...idsOptions, tokenIds: [] }),
            ).not.toThrow();
        });

        it("leaves repeated ids to the network", () => {
            expect(() =>
                validator.validate({
                    ...idsOptions,
                    tokenIds: ["0.0.456", "0.0.456"],
                }),
            ).not.toThrow();
        });

        it("throws when both tokenId and tokenIds are set", () => {
            expect(() =>
                validator.validate({ ...idsOptions, tokenId: "0.0.456" }),
            ).toThrow(/either tokenId or tokenIds/);
            expect(() =>
                validator.validate({ ...idsOptions, tokenId: "0.0.456" }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when tokenIds is not an array", () => {
            expect(() =>
                validator.validate({
                    ...idsOptions,
                    tokenIds: "0.0.456" as unknown as string[],
                }),
            ).toThrow(/tokenIds must be an array/);
        });

        it("throws when an entry is null", () => {
            expect(() =>
                validator.validate({
                    ...idsOptions,
                    tokenIds: [null as unknown as string],
                }),
            ).toThrow(/tokenIds entries cannot be null/);
        });

        it("throws when an entry is an empty string", () => {
            expect(() =>
                validator.validate({
                    ...idsOptions,
                    tokenIds: ["0.0.456", " "],
                }),
            ).toThrow(/tokenIds entries cannot be empty/);
        });
    });
});
