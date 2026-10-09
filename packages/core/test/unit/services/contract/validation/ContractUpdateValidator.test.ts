import { describe, it, expect } from "vitest";
import { ContractUpdateValidator } from "../../../../../src/services/contract/validation/index.js";
import type { ContractUpdateOperationOptions } from "../../../../../src/services/contract/operations/index.js";

describe("ContractUpdateValidator", () => {
    const validator = new ContractUpdateValidator();

    const baseOptions: ContractUpdateOperationOptions = {
        contractId: "0.0.12345",
    };

    describe("contractId", () => {
        it("accepts a string contract ID", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when contractId is missing", () => {
            expect(() =>
                validator.validate(
                    {} as unknown as ContractUpdateOperationOptions,
                ),
            ).toThrow(/contractId is required/);
            expect(() =>
                validator.validate(
                    {} as unknown as ContractUpdateOperationOptions,
                ),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when contractId is an empty string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    contractId: "",
                }),
            ).toThrow(/contractId cannot be empty/);
        });

        it("throws when contractId is whitespace only", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    contractId: "   ",
                }),
            ).toThrow(/contractId cannot be empty/);
        });
    });

    describe("contractMemo", () => {
        it("accepts a memo at the 100-byte boundary", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    contractMemo: "x".repeat(100),
                }),
            ).not.toThrow();
        });

        it("throws when memo exceeds 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    contractMemo: "x".repeat(101),
                }),
            ).toThrow(/contractMemo exceeds 100 bytes/);
        });

        it("counts byte length using UTF-8 (multi-byte characters)", () => {
            // Each "あ" is 3 UTF-8 bytes — 34 × 3 = 102 > 100.
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    contractMemo: "あ".repeat(34),
                }),
            ).toThrow(/contractMemo exceeds 100 bytes/);
        });
    });

    describe("staking", () => {
        it("throws when both stakedAccountId and stakedNodeId are set", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    stakedAccountId: "0.0.123",
                    stakedNodeId: 0,
                }),
            ).toThrow(/stakedAccountId or stakedNodeId/);
        });

        it("accepts just stakedAccountId", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    stakedAccountId: "0.0.123",
                }),
            ).not.toThrow();
        });

        it("accepts just stakedNodeId", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    stakedNodeId: 0,
                }),
            ).not.toThrow();
        });
    });

    describe("maxAutomaticTokenAssociations", () => {
        it("accepts 0", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxAutomaticTokenAssociations: 0,
                }),
            ).not.toThrow();
        });

        it("accepts a positive integer", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxAutomaticTokenAssociations: 10,
                }),
            ).not.toThrow();
        });

        it("accepts -1 (unlimited, HIP-904)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxAutomaticTokenAssociations: -1,
                }),
            ).not.toThrow();
        });

        it("throws on non-integer values", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxAutomaticTokenAssociations: 1.5,
                }),
            ).toThrow(/must be an integer/);
        });

        it("throws on values less than -1", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    maxAutomaticTokenAssociations: -2,
                }),
            ).toThrow(/-1 \(unlimited\) or a non-negative integer/);
        });
    });
});
