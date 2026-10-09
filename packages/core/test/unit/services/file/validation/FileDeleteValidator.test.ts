import { describe, it, expect } from "vitest";
import { FileDeleteValidator } from "../../../../../src/services/file/validation/index.js";
import type { FileDeleteOperationOptions } from "../../../../../src/services/file/operations/index.js";

describe("FileDeleteValidator", () => {
    const validator = new FileDeleteValidator();

    it("accepts a valid fileId", () => {
        expect(() => validator.validate({ fileId: "0.0.555" })).not.toThrow();
    });

    it("rejects when fileId is missing", () => {
        expect(() =>
            validator.validate({} as unknown as FileDeleteOperationOptions),
        ).toThrow(/fileId is required/);
        expect(() =>
            validator.validate({} as unknown as FileDeleteOperationOptions),
        ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
    });

    it("rejects an empty-string fileId", () => {
        expect(() => validator.validate({ fileId: "   " })).toThrow(
            /fileId cannot be empty/,
        );
    });
});
