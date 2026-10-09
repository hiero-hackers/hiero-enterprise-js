import { describe, it, expect } from "vitest";
import { TopicMessageSubmitValidator } from "../../../../../src/services/topic/validation/index.js";
import type { TopicMessageSubmitOperationOptions } from "../../../../../src/services/topic/operations/index.js";

describe("TopicMessageSubmitValidator", () => {
    const validator = new TopicMessageSubmitValidator();

    const baseOptions: TopicMessageSubmitOperationOptions = {
        topicId: "0.0.12345",
        message: "hello world",
    };

    describe("topicId", () => {
        it("passes with a valid topicId and message", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when topicId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicId: null as unknown as string,
                }),
            ).toThrow(/topicId is required/);
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when topicId is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicId: undefined as unknown as string,
                }),
            ).toThrow(/topicId is required/);
        });

        it("throws when topicId is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicId: "" }),
            ).toThrow(/topicId cannot be empty/);
        });

        it("throws when topicId is whitespace only", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicId: "   " }),
            ).toThrow(/topicId cannot be empty/);
        });
    });

    describe("message", () => {
        it("accepts a non-empty string message", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    message: "non-empty",
                }),
            ).not.toThrow();
        });

        it("accepts a non-empty Uint8Array message", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    message: new Uint8Array([1, 2, 3]),
                }),
            ).not.toThrow();
        });

        it("throws when message is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    message: null as unknown as string,
                }),
            ).toThrow(/message is required/);
        });

        it("throws when message is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    message: undefined as unknown as string,
                }),
            ).toThrow(/message is required/);
        });

        it("throws when message is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, message: "" }),
            ).toThrow(/message cannot be empty/);
        });

        it("throws when message is an empty Uint8Array", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    message: new Uint8Array(),
                }),
            ).toThrow(/message cannot be empty/);
        });
    });

    describe("maxChunks", () => {
        it("accepts a positive integer", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: 10 }),
            ).not.toThrow();
        });

        it("ignores undefined", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: undefined }),
            ).not.toThrow();
        });

        it("throws on zero", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: 0 }),
            ).toThrow(/maxChunks must be a positive integer/);
        });

        it("throws on a negative value", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: -3 }),
            ).toThrow(/maxChunks must be a positive integer/);
        });

        it("throws on a non-integer", () => {
            expect(() =>
                validator.validate({ ...baseOptions, maxChunks: 1.5 }),
            ).toThrow(/maxChunks must be a positive integer/);
        });
    });

    describe("chunkSize", () => {
        it("accepts a positive integer", () => {
            expect(() =>
                validator.validate({ ...baseOptions, chunkSize: 512 }),
            ).not.toThrow();
        });

        it("ignores undefined", () => {
            expect(() =>
                validator.validate({ ...baseOptions, chunkSize: undefined }),
            ).not.toThrow();
        });

        it("throws on zero", () => {
            expect(() =>
                validator.validate({ ...baseOptions, chunkSize: 0 }),
            ).toThrow(/chunkSize must be a positive integer/);
        });

        it("throws on a negative value", () => {
            expect(() =>
                validator.validate({ ...baseOptions, chunkSize: -100 }),
            ).toThrow(/chunkSize must be a positive integer/);
        });

        it("throws on a non-integer", () => {
            expect(() =>
                validator.validate({ ...baseOptions, chunkSize: 64.25 }),
            ).toThrow(/chunkSize must be a positive integer/);
        });
    });
});
