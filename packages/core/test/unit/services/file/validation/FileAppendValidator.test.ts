import { describe, it, expect } from "vitest";
import { FileAppendValidator } from "../../../../../src/services/file/validation/index.js";
import type { FileAppendOperationOptions } from "../../../../../src/services/file/operations/index.js";

describe("FileAppendValidator", () => {
    const validator = new FileAppendValidator();

    it("accepts fileId + contents", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: "chunk",
            }),
        ).not.toThrow();
    });

    it("accepts optional chunk-tuning fields when positive integers", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: new Uint8Array([1, 2, 3]),
                maxChunks: 30,
                chunkSize: 2048,
                chunkInterval: 10,
            }),
        ).not.toThrow();
    });

    it("rejects when fileId is missing", () => {
        expect(() =>
            validator.validate({
                contents: "x",
            } as unknown as FileAppendOperationOptions),
        ).toThrow(/fileId is required/);
        expect(() =>
            validator.validate({
                contents: "x",
            } as unknown as FileAppendOperationOptions),
        ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
    });

    it("rejects an empty-string fileId", () => {
        expect(() =>
            validator.validate({
                fileId: "   ",
                contents: "x",
            }),
        ).toThrow(/fileId cannot be empty/);
    });

    it("rejects when contents is missing", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
            } as unknown as FileAppendOperationOptions),
        ).toThrow(/contents is required/);
    });

    it("rejects a non-integer maxChunks", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: "x",
                maxChunks: 2.5,
            }),
        ).toThrow(/maxChunks must be a positive integer/);
    });

    it("rejects a zero or negative maxChunks", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: "x",
                maxChunks: 0,
            }),
        ).toThrow(/maxChunks must be a positive integer/);
    });

    it("rejects a non-integer chunkSize", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: "x",
                chunkSize: 1024.5,
            }),
        ).toThrow(/chunkSize must be a positive integer/);
    });

    it("rejects a negative chunkSize", () => {
        expect(() =>
            validator.validate({
                fileId: "0.0.555",
                contents: "x",
                chunkSize: -1,
            }),
        ).toThrow(/chunkSize must be a positive integer/);
    });
});
