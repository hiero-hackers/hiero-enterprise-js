import { describe, it, expect } from "vitest";
import { AccountId, Long } from "@hiero-ledger/sdk";
import { MirrorContractCallValidator } from "../../../../../src/services/contract/validation/index.js";
import type { MirrorNodeContractQueryOptions } from "../../../../../src/services/contract/queries/index.js";

describe("MirrorContractCallValidator", () => {
    const validator = new MirrorContractCallValidator();

    const baseOptions: MirrorNodeContractQueryOptions = {
        contractId: "0.0.12345",
        functionName: "get",
    };

    it("accepts a named call", () => {
        expect(() => validator.validate(baseOptions)).not.toThrow();
    });

    it("throws when contractId is missing or empty", () => {
        expect(() =>
            validator.validate({ ...baseOptions, contractId: "" }),
        ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        expect(() =>
            validator.validate({
                functionName: "get",
            } as unknown as MirrorNodeContractQueryOptions),
        ).toThrow(/contractId is required/);
    });

    it("throws when the call target is missing", () => {
        expect(() => validator.validate({ contractId: "0.0.12345" })).toThrow(
            /requires either functionName or rawFunctionParameters/,
        );
    });

    describe("sender", () => {
        it("throws when both sender and senderEvmAddress are set", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    sender: AccountId.fromString("0.0.999"),
                    senderEvmAddress:
                        "0x1234567890abcdef1234567890abcdef12345678",
                }),
            ).toThrow(/accepts sender or senderEvmAddress, not both/);
        });

        it.each([
            "0x1234567890abcdef1234567890abcdef12345678",
            "1234567890ABCDEF1234567890ABCDEF12345678",
        ])("accepts senderEvmAddress %s", (senderEvmAddress) => {
            expect(() =>
                validator.validate({ ...baseOptions, senderEvmAddress }),
            ).not.toThrow();
        });

        it.each(["", "0x1234", "0xzz34567890abcdef1234567890abcdef12345678"])(
            "throws for senderEvmAddress %j",
            (senderEvmAddress) => {
                expect(() =>
                    validator.validate({ ...baseOptions, senderEvmAddress }),
                ).toThrow(/senderEvmAddress must be a 20-byte hex EVM address/);
            },
        );
    });

    describe("numeric options", () => {
        it("accepts zero value and gasPrice, a positive gasLimit, and Longs", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    value: 0,
                    gasPrice: Long.ZERO,
                    gasLimit: Long.fromNumber(50_000),
                }),
            ).not.toThrow();
        });

        it.each([
            ["value", -1, /value must be an integer of at least 0/],
            ["gasPrice", 1.5, /gasPrice must be an integer of at least 0/],
            ["gasLimit", 0, /gasLimit must be an integer of at least 1/],
            [
                "gasLimit",
                Long.fromNumber(-5),
                /gasLimit must be an integer of at least 1/,
            ],
        ])("throws for %s %s", (name, value, message) => {
            expect(() =>
                validator.validate({ ...baseOptions, [name]: value }),
            ).toThrow(message);
        });
    });
});
