import { describe, it, expect } from "vitest";
import {
    HieroError,
    HieroErrorCodes,
    normalizeError,
    validationError,
} from "../../../src/errors/index.js";

describe("HieroError", () => {
    it("creates an error with default values", () => {
        const error = new HieroError("test error");
        expect(error.message).toBe("test error");
        expect(error.code).toBe(HieroErrorCodes.Unknown);
        expect(error.name).toBe("HieroError");
        expect(error.context).toBeUndefined();
        expect(error.cause).toBeUndefined();
    });

    it("creates an error with custom options", () => {
        const cause = new Error("original");
        const error = new HieroError("wrapped", {
            code: HieroErrorCodes.ConfigInvalid,
            context: "doing something",
            cause,
        });
        expect(error.code).toBe(HieroErrorCodes.ConfigInvalid);
        expect(error.context).toBe("doing something");
        expect(error.cause).toBe(cause);
    });

    it("is instanceof Error", () => {
        const error = new HieroError("test");
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(HieroError);
    });

    it("stores transactionId when provided", () => {
        const error = new HieroError("tx failed", {
            code: HieroErrorCodes.SdkError,
            sdkStatus: "ACCOUNT_DELETED",
            transactionId: "0.0.2@1234567890.000",
        });
        expect(error.transactionId).toBe("0.0.2@1234567890.000");
        expect(error.sdkStatus).toBe("ACCOUNT_DELETED");
    });
});

describe("normalizeError", () => {
    it("returns HieroError as-is", () => {
        const original = new HieroError("original", {
            code: HieroErrorCodes.Unknown,
        });
        const result = normalizeError(original);
        expect(result).toBe(original);
    });

    it("wraps a standard Error", () => {
        const original = new Error("std error");
        const result = normalizeError(original, "in testing");
        expect(result).toBeInstanceOf(HieroError);
        expect(result.message).toBe("std error");
        expect(result.code).toBe(HieroErrorCodes.SdkError);
        expect(result.context).toBe("in testing");
        expect(result.cause).toBe(original);
    });

    it("wraps an SDK error with status using toString()", () => {
        const sdkError = Object.assign(new Error("sdk"), {
            status: { toString: () => "INSUFFICIENT_PAYER_BALANCE" },
        });
        const result = normalizeError(sdkError);
        expect(result.code).toBe(HieroErrorCodes.SdkError);
        expect(result.sdkStatus).toBe("INSUFFICIENT_PAYER_BALANCE");
    });

    it("extracts transactionId from ReceiptStatusError", () => {
        const sdkError = Object.assign(new Error("receipt"), {
            status: { toString: () => "ACCOUNT_DELETED" },
            transactionId: { toString: () => "0.0.2@123.456" },
        });
        const result = normalizeError(sdkError);
        expect(result.code).toBe(HieroErrorCodes.SdkError);
        expect(result.sdkStatus).toBe("ACCOUNT_DELETED");
        expect(result.transactionId).toBe("0.0.2@123.456");
    });

    it("wraps a string", () => {
        const result = normalizeError("oops");
        expect(result.message).toBe("oops");
        expect(result.code).toBe(HieroErrorCodes.Unknown);
    });

    it("wraps a number", () => {
        const result = normalizeError(42);
        expect(result.message).toBe("42");
    });
});

describe("validationError", () => {
    it("creates an INPUT_INVALID error with the validator as context", () => {
        const error = validationError("ScheduleSignValidator", "bad input");
        expect(error).toBeInstanceOf(HieroError);
        expect(error.message).toBe("bad input");
        expect(error.code).toBe(HieroErrorCodes.InputInvalid);
        expect(error.code).toBe("INPUT_INVALID");
        expect(error.context).toBe("ScheduleSignValidator");
        expect(error.cause).toBeUndefined();
    });
});
