import { describe, it, expect } from "vitest";
import { ContractDeleteValidator } from "../../../../../src/services/contract/validation/index.js";
import type { ContractDeleteOperationOptions } from "../../../../../src/services/contract/operations/index.js";

describe("ContractDeleteValidator", () => {
    const validator = new ContractDeleteValidator();

    const baseOptions: ContractDeleteOperationOptions = {
        contractId: "0.0.12345",
        transferAccountId: "0.0.2",
    };

    describe("contractId", () => {
        it("accepts a valid string contract ID", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when contractId is missing", () => {
            expect(() =>
                validator.validate({
                    transferAccountId: "0.0.2",
                } as unknown as ContractDeleteOperationOptions),
            ).toThrow(/contractId is required/);
            expect(() =>
                validator.validate({
                    transferAccountId: "0.0.2",
                } as unknown as ContractDeleteOperationOptions),
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

    describe("transfer target", () => {
        it("accepts a transferAccountId", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    transferAccountId: "0.0.2",
                }),
            ).not.toThrow();
        });

        it("accepts a transferContractId", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    transferContractId: "0.0.999",
                }),
            ).not.toThrow();
        });

        it("throws when neither transferAccountId nor transferContractId is set", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                }),
            ).toThrow(/transfer target is required/);
        });

        it("throws when both transferAccountId and transferContractId are set", () => {
            expect(() =>
                validator.validate({
                    contractId: "0.0.12345",
                    transferAccountId: "0.0.2",
                    transferContractId: "0.0.999",
                }),
            ).toThrow(/transferAccountId or transferContractId/);
        });
    });
});
