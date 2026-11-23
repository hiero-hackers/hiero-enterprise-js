import { describe, it, expect } from "vitest";
import { TopicDeleteValidator } from "../../../../../src/services/topic/validation/index.js";
import type { TopicDeleteOperationOptions } from "../../../../../src/services/topic/operations/index.js";

describe("TopicDeleteValidator", () => {
    const validator = new TopicDeleteValidator();

    const baseOptions: TopicDeleteOperationOptions = {
        topicId: "0.0.12345",
    };

    describe("topicId", () => {
        it("passes with a valid topicId", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when topicId is null", () => {
            expect(() =>
                validator.validate({
                    topicId: null as unknown as string,
                }),
            ).toThrow(/topicId is required/);
            expect(() =>
                validator.validate({
                    topicId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when topicId is undefined", () => {
            expect(() =>
                validator.validate({
                    topicId: undefined as unknown as string,
                }),
            ).toThrow(/topicId is required/);
        });

        it("throws when topicId is an empty string", () => {
            expect(() => validator.validate({ topicId: "" })).toThrow(
                /topicId cannot be empty/,
            );
        });

        it("throws when topicId is whitespace only", () => {
            expect(() => validator.validate({ topicId: "   " })).toThrow(
                /topicId cannot be empty/,
            );
        });
    });

    describe("network status", () => {
        it("reports INVALID_TOPIC_ID for a missing topicId", () => {
            expect(() =>
                validator.validate({} as TopicDeleteOperationOptions),
            ).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    sdkStatus: "INVALID_TOPIC_ID",
                }),
            );
        });

        it("reports no status for an empty topicId, which the SDK can't parse", () => {
            expect(() => validator.validate({ topicId: "" })).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    sdkStatus: undefined,
                }),
            );
        });
    });
});
