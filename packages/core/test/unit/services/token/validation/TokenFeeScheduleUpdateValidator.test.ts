import { describe, it, expect } from "vitest";
import { CustomFixedFee } from "@hiero-ledger/sdk";
import { TokenFeeScheduleUpdateValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenFeeScheduleUpdateOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenFeeScheduleUpdateValidator", () => {
    const validator = new TokenFeeScheduleUpdateValidator();

    const baseOptions: TokenFeeScheduleUpdateOperationOptions = {
        tokenId: "0.0.500",
        customFees: [],
    };

    describe("tokenId", () => {
        it("passes with a valid tokenId and customFees", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("passes with a non-empty customFees array", () => {
            const fee = new CustomFixedFee()
                .setAmount(1)
                .setFeeCollectorAccountId("0.0.1001");
            expect(() =>
                validator.validate({ ...baseOptions, customFees: [fee] }),
            ).not.toThrow();
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
                validator.validate({ ...baseOptions, tokenId: "" }),
            ).toThrow(/tokenId cannot be empty/);
        });

        it("throws when tokenId is whitespace only", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenId: "   " }),
            ).toThrow(/tokenId cannot be empty/);
        });
    });

    describe("customFees", () => {
        it("throws when customFees is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    customFees: null as unknown as never,
                }),
            ).toThrow(/customFees is required/);
        });

        it("throws when customFees is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    customFees: undefined as unknown as never,
                }),
            ).toThrow(/customFees is required/);
        });

        it("throws when customFees is not an array", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    customFees: "not-an-array" as unknown as never,
                }),
            ).toThrow(/customFees must be an array/);
        });
    });
});
