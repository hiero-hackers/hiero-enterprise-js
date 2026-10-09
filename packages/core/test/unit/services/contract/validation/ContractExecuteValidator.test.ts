import BigNumber from "bignumber.js";
import { describe, it, expect } from "vitest";
import { Long, Hbar } from "@hiero-ledger/sdk";
import { ContractExecuteValidator } from "../../../../../src/services/contract/validation/index.js";
import type { ContractExecuteOperationOptions } from "../../../../../src/services/contract/operations/index.js";

describe("ContractExecuteValidator", () => {
    const validator = new ContractExecuteValidator();

    const baseOptions: ContractExecuteOperationOptions = {
        contractId: "0.0.12345",
        gas: 100_000,
        functionName: "set",
    };

    describe("contractId", () => {
        it("accepts a string contract ID", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when contractId is missing", () => {
            expect(() =>
                validator.validate({
                    gas: 100_000,
                    functionName: "set",
                } as unknown as ContractExecuteOperationOptions),
            ).toThrow(/contractId is required/);
            expect(() =>
                validator.validate({
                    gas: 100_000,
                    functionName: "set",
                } as unknown as ContractExecuteOperationOptions),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when contractId is an empty string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    contractId: "",
                }),
            ).toThrow(/contractId is required/);
        });
    });

    describe("gas", () => {
        it("throws when gas is missing", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    functionName: "set",
                } as unknown as ContractExecuteOperationOptions),
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

    describe("call target", () => {
        it("accepts functionName alone", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("accepts rawFunctionParameters alone", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    gas: 100_000,
                    rawFunctionParameters: new Uint8Array([
                        0x60, 0xfe, 0x47, 0xb1,
                    ]),
                }),
            ).not.toThrow();
        });

        it("throws when neither functionName nor rawFunctionParameters is provided", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    gas: 100_000,
                }),
            ).toThrow(/functionName or rawFunctionParameters/);
        });

        it("throws when both are provided", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    gas: 100_000,
                    functionName: "set",
                    rawFunctionParameters: new Uint8Array([0x60]),
                }),
            ).toThrow(/not both/);
        });

        it("treats empty-string functionName as missing", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    gas: 100_000,
                    functionName: "",
                }),
            ).toThrow(/functionName or rawFunctionParameters/);
        });

        it("throws when rawFunctionParameters is empty", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    gas: 100_000,
                    rawFunctionParameters: new Uint8Array([]),
                }),
            ).toThrow(/must not be empty/);
        });
    });

    describe("payableAmount", () => {
        it("accepts a missing payableAmount", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("accepts a non-negative number", () => {
            expect(() =>
                validator.validate({ ...baseOptions, payableAmount: 0 }),
            ).not.toThrow();
        });

        it("throws when payableAmount is a negative number", () => {
            expect(() =>
                validator.validate({ ...baseOptions, payableAmount: -1 }),
            ).toThrow(/payableAmount must not be negative/);
        });

        it("throws when payableAmount is a bigint", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: 5n as never,
                }),
            ).toThrow(/payableAmount must be .* not a bigint/);
        });

        it("throws when payableAmount is a negative Long", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: Long.fromNumber(-1),
                }),
            ).toThrow(/payableAmount must not be negative/);
        });

        it("throws when payableAmount is a negative Hbar", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: Hbar.fromTinybars(-1),
                }),
            ).toThrow(/payableAmount must not be negative/);
        });

        it("accepts a positive Hbar payableAmount", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: new Hbar(1),
                }),
            ).not.toThrow();
        });

        it("accepts a non-negative string payableAmount", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: "1.5",
                }),
            ).not.toThrow();
        });

        it("throws when payableAmount is a negative string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: "-1",
                }),
            ).toThrow(/payableAmount must not be negative/);
        });

        it("throws when payableAmount is a negative decimal string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: "  -0.5 ",
                }),
            ).toThrow(/payableAmount must not be negative/);
        });

        it("accepts a non-negative BigNumber payableAmount", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: new BigNumber(0),
                }),
            ).not.toThrow();
        });

        it("throws when payableAmount is a negative BigNumber", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    payableAmount: new BigNumber(-1),
                }),
            ).toThrow(/payableAmount must not be negative/);
        });
    });
});
