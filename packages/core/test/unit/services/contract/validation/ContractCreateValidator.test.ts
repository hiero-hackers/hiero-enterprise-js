import { describe, it, expect } from "vitest";
import { Long } from "@hiero-ledger/sdk";
import { ContractCreateValidator } from "../../../../../src/services/contract/validation/index.js";
import type { ContractCreateOperationOptions } from "../../../../../src/services/contract/operations/index.js";

describe("ContractCreateValidator", () => {
    const validator = new ContractCreateValidator();

    const baseOptions: ContractCreateOperationOptions = {
        bytecodeFileId: "0.0.555",
        gas: 100_000,
    };

    describe("bytecode source", () => {
        it("accepts a bytecodeFileId", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("accepts raw bytecode bytes", () => {
            expect(() =>
                validator.validate({
                    bytecode: new Uint8Array([0x60, 0x80]),
                    gas: 100_000,
                }),
            ).not.toThrow();
        });

        it("throws when neither source is provided", () => {
            expect(() =>
                validator.validate({
                    gas: 100_000,
                } as unknown as ContractCreateOperationOptions),
            ).toThrow(/bytecodeFileId or bytecode/);
        });

        it("throws when both sources are provided", () => {
            expect(() =>
                validator.validate({
                    bytecodeFileId: "0.0.555",
                    bytecode: new Uint8Array([0x60]),
                    gas: 100_000,
                }),
            ).toThrow(/not both/);
        });

        it("throws when bytecode is empty", () => {
            expect(() =>
                validator.validate({
                    bytecode: new Uint8Array([]),
                    gas: 100_000,
                }),
            ).toThrow(/must not be empty/);
        });
    });

    describe("gas", () => {
        it("throws when gas is missing", () => {
            expect(() =>
                validator.validate({
                    bytecodeFileId: "0.0.555",
                } as unknown as ContractCreateOperationOptions),
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

        it("throws when Long gas is zero", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    gas: Long.fromNumber(0),
                }),
            ).toThrow(/gas must be greater than zero/);
        });

        it("accepts positive Long gas", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    gas: Long.fromNumber(100_000),
                }),
            ).not.toThrow();
        });
    });

    describe("initialBalance", () => {
        it("throws when initialBalance is negative (number)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: -1,
                }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("throws when initialBalance is negative (bigint)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    // Deliberately outside the declared type: the validator
                    // must reject bad runtime values from untyped JS callers.
                    initialBalance: -1n as never,
                }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("throws when initialBalance is a negative Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: Long.fromNumber(-1),
                }),
            ).toThrow(/initialBalance must not be negative/);
        });

        it("accepts zero initialBalance", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    initialBalance: 0,
                }),
            ).not.toThrow();
        });
    });

    describe("contractMemo", () => {
        it("accepts an empty memo (omitted)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, contractMemo: "" }),
            ).not.toThrow();
        });

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
});
