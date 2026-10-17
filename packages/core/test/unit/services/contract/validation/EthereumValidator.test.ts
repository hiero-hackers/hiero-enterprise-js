import { describe, it, expect } from "vitest";
import { Hbar } from "@hiero-ledger/sdk";
import { EthereumValidator } from "../../../../../src/services/contract/validation/index.js";
import type { EthereumOperationOptions } from "../../../../../src/services/contract/operations/index.js";

describe("EthereumValidator", () => {
    const validator = new EthereumValidator();
    const bytes = Uint8Array.of(1, 2, 3);
    const validate = (options: Partial<EthereumOperationOptions>) =>
        validator.validate({
            ethereumData: bytes,
            ...options,
        } as EthereumOperationOptions);

    it("accepts bytes with the optional fields", () => {
        expect(() =>
            validate({
                callDataFileId: "0.0.5005",
                maxGasAllowance: 0,
            }),
        ).not.toThrow();
        expect(() => validate({ maxGasAllowance: new Hbar(1) })).not.toThrow();
    });

    it.each([
        [{ ethereumData: undefined }, /ethereumData is required/],
        [{ ethereumData: new Uint8Array() }, /must be non-empty bytes/],
        [{ ethereumData: "0x01" }, /must be non-empty bytes/],
        [{ callDataFileId: "abc" }, /callDataFileId "abc" is not a valid/],
        [{ maxGasAllowance: -1 }, /maxGasAllowance must be a non-negative/],
        [{ maxGasAllowance: NaN }, /maxGasAllowance must be a non-negative/],
        [
            { maxGasAllowance: new Hbar(-1) },
            /maxGasAllowance must be a non-negative/,
        ],
    ])("rejects %j", (options, message) => {
        expect(() =>
            validate(options as Partial<EthereumOperationOptions>),
        ).toThrow(message);
    });
});
