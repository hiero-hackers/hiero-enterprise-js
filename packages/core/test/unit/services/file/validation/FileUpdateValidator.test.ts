import { describe, it, expect } from "vitest";
import { FileUpdateValidator } from "../../../../../src/services/file/validation/index.js";
import type { FileUpdateOperationOptions } from "../../../../../src/services/file/operations/index.js";

describe("FileUpdateValidator", () => {
    const validator = new FileUpdateValidator();

    it("accepts a memo-only update", () => {
        expect(() =>
            validator.validate({ fileId: "0.0.555", fileMemo: "renamed" }),
        ).not.toThrow();
    });

    it("accepts a contents-only update", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: "new payload",
            }),
        ).not.toThrow();
    });

    it("accepts a keys-only update (including empty-list rotation)", () => {
        expect(() =>
            validator.validate({ fileId: "0.0.555", keys: [] }),
        ).not.toThrow();
    });

    it("accepts fileMemo: null (clear via empty-string sentinel)", () => {
        expect(() =>
            validator.validate({ fileId: "0.0.555", fileMemo: null }),
        ).not.toThrow();
    });

    it("rejects when fileId is missing", () => {
        expect(() =>
            validator.validate({
                fileMemo: "x",
            } as unknown as FileUpdateOperationOptions),
        ).toThrow(/fileId is required/);
        expect(() =>
            validator.validate({
                fileMemo: "x",
            } as unknown as FileUpdateOperationOptions),
        ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
    });

    it("rejects an empty-string fileId", () => {
        expect(() =>
            validator.validate({ fileId: "   ", fileMemo: "x" }),
        ).toThrow(/fileId cannot be empty/);
    });

    it("rejects expirationTime: null (not clearable)", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                expirationTime: null,
            } as unknown as FileUpdateOperationOptions),
        ).toThrow(/expirationTime cannot be null/);
    });

    it("rejects a no-op update (only fileId, no other field)", () => {
        expect(() => validator.validate({ fileId: "0.0.555" })).toThrow(
            /updateFile requires at least one field to change/,
        );
    });
});
