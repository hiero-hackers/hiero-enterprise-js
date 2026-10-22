import { describe, it, expect } from "vitest";
import { validateCallTarget } from "../../../../../src/services/contract/validation/index.js";

describe("validateCallTarget", () => {
    it.each([
        [{ functionName: "get" }],
        [{ rawFunctionParameters: new Uint8Array([0x01]) }],
    ])("accepts exactly one call target: %o", (options) => {
        expect(() => validateCallTarget("Test", options)).not.toThrow();
    });

    it.each([[{}], [{ functionName: "" }]])(
        "throws when no call target is set: %o",
        (options) => {
            expect(() => validateCallTarget("Test", options)).toThrow(
                /requires either functionName or rawFunctionParameters/,
            );
        },
    );

    it("throws when both call targets are set", () => {
        expect(() =>
            validateCallTarget("Test", {
                functionName: "get",
                rawFunctionParameters: new Uint8Array([0x01]),
            }),
        ).toThrow(/accepts functionName or rawFunctionParameters, not both/);
    });

    it("names the caller in the error context", () => {
        expect(() => validateCallTarget("Test", {})).toThrow(
            expect.objectContaining({ code: "INPUT_INVALID", context: "Test" }),
        );
    });
});
