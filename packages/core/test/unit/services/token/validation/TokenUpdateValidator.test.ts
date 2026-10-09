import { describe, it, expect } from "vitest";
import { TokenKeyValidation } from "@hiero-ledger/sdk";
import { TokenUpdateValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenUpdateOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenUpdateValidator", () => {
    const validator = new TokenUpdateValidator();

    const baseOptions: TokenUpdateOperationOptions = {
        tokenId: "0.0.500",
    };

    describe("tokenId", () => {
        it("passes with a minimal valid update (only tokenId)", () => {
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
            expect(() => validator.validate({ tokenId: "   " })).toThrow(
                /tokenId cannot be empty/,
            );
        });
    });

    describe("tokenName", () => {
        it("allows a valid name", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenName: "Renamed Acme",
                }),
            ).not.toThrow();
        });

        it("throws when tokenName is empty", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenName: "" }),
            ).toThrow(/tokenName cannot be empty/);
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
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenName: "🚀".repeat(26),
                }),
            ).toThrow(/tokenName exceeds 100 bytes/);
        });
    });

    describe("tokenSymbol", () => {
        it("allows a valid symbol", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenSymbol: "ACME2",
                }),
            ).not.toThrow();
        });

        it("throws when tokenSymbol is empty", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenSymbol: "" }),
            ).toThrow(/tokenSymbol cannot be empty/);
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

    describe("tokenMemo", () => {
        it("allows memo under 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenMemo: "a".repeat(99),
                }),
            ).not.toThrow();
        });

        it("allows an empty memo (clears the existing memo)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenMemo: "" }),
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

    describe("treasuryAccountId", () => {
        it("allows a valid treasury", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    treasuryAccountId: "0.0.999",
                }),
            ).not.toThrow();
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

    describe("autoRenewAccountId", () => {
        it("allows a valid auto-renew account", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    autoRenewAccountId: "0.0.888",
                }),
            ).not.toThrow();
        });

        it("throws when autoRenewAccountId is an empty string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    autoRenewAccountId: "   ",
                }),
            ).toThrow(/autoRenewAccountId cannot be empty/);
        });
    });

    describe("multi-field updates", () => {
        it("accepts a complete update payload", () => {
            expect(() =>
                validator.validate({
                    tokenId: "0.0.500",
                    tokenName: "New Name",
                    tokenSymbol: "NEW",
                    tokenMemo: "updated memo",
                    treasuryAccountId: "0.0.999",
                    autoRenewAccountId: "0.0.888",
                    autoRenewPeriod: 7_776_000,
                    keyVerificationMode: TokenKeyValidation.FullValidation,
                }),
            ).not.toThrow();
        });
    });
});
