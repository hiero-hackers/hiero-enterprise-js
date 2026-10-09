import { describe, it, expect } from "vitest";
import { Hbar, Long } from "@hiero-ledger/sdk";
import BigNumber from "bignumber.js";
import { ContractCreateFlowValidator } from "../../../../../src/services/contract/validation/index.js";
import type { ContractCreateFlowOperationOptions } from "../../../../../src/services/contract/operations/index.js";

describe("ContractCreateFlowValidator", () => {
    const validator = new ContractCreateFlowValidator();

    const baseOptions: ContractCreateFlowOperationOptions = {
        bytecode: new Uint8Array([0x60, 0x80]),
        gas: 150_000,
    };

    describe("bytecode", () => {
        it("accepts a Uint8Array bytecode", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("accepts a hex-string bytecode", () => {
            expect(() =>
                validator.validate({ ...baseOptions, bytecode: "0x6080" }),
            ).not.toThrow();
        });

        it("throws when bytecode is missing", () => {
            expect(() =>
                validator.validate({
                    gas: 150_000,
                } as unknown as ContractCreateFlowOperationOptions),
            ).toThrow(/bytecode is required/);
            expect(() =>
                validator.validate({
                    gas: 150_000,
                } as unknown as ContractCreateFlowOperationOptions),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when bytecode is an empty Uint8Array", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    bytecode: new Uint8Array(),
                }),
            ).toThrow(/bytecode must not be empty/);
        });

        it("throws when bytecode is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, bytecode: "" }),
            ).toThrow(/bytecode must not be empty/);
        });
    });

    describe("gas", () => {
        it("throws when gas is missing", () => {
            expect(() =>
                validator.validate({
                    bytecode: new Uint8Array([0x60]),
                } as unknown as ContractCreateFlowOperationOptions),
            ).toThrow(/gas is required/);
        });

        it("throws when gas is zero", () => {
            expect(() =>
                validator.validate({ ...baseOptions, gas: 0 }),
            ).toThrow(/gas must be greater than zero/);
        });

        it("throws when gas is negative", () => {
            expect(() =>
                validator.validate({ ...baseOptions, gas: -1 }),
            ).toThrow(/gas must be greater than zero/);
        });

        it("accepts a positive Long gas value", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    gas: Long.fromNumber(150_000),
                }),
            ).not.toThrow();
        });

        it("throws when gas is a non-positive Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    gas: Long.fromNumber(0),
                }),
            ).toThrow(/gas must be greater than zero/);
        });
    });

    describe("initialBalance", () => {
        it("accepts a non-negative number", () => {
            expect(() =>
                validator.validate({ ...baseOptions, initialBalance: 0 }),
            ).not.toThrow();
        });

        it("throws on a negative number", () => {
            expect(() =>
                validator.validate({ ...baseOptions, initialBalance: -1 }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("throws on a negative string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, initialBalance: "-0.5" }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("throws on a negative Hbar", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: new Hbar(-1),
                }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("throws on a negative BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: new BigNumber(-1),
                }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("throws on a bigint", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: 5n as never,
                }),
            ).toThrow(/initialBalance must be .* not a bigint/);
        });

        it("throws on a negative Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: Long.fromNumber(-1),
                }),
            ).toThrow(/initialBalance must not be negative/);
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
    });

    describe("maxChunks", () => {
        it("accepts a positive integer", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: 5 }),
            ).not.toThrow();
        });

        it("throws on zero", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: 0 }),
            ).toThrow(/maxChunks must be a positive integer/);
        });

        it("throws on a non-integer", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: 1.5 }),
            ).toThrow(/maxChunks must be a positive integer/);
        });
    });
});
