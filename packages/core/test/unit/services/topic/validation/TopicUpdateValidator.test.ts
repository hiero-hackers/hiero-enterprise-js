import { describe, it, expect } from "vitest";
import { TopicUpdateValidator } from "../../../../../src/services/topic/validation/index.js";
import type { TopicUpdateOperationOptions } from "../../../../../src/services/topic/operations/index.js";

describe("TopicUpdateValidator", () => {
    const validator = new TopicUpdateValidator();

    // Every test below validates a single rule; we attach a benign
    // change (`topicMemo`) so the cross-cutting "at least one change"
    // rule is satisfied unless the test deliberately overrides it.
    const baseOptions: TopicUpdateOperationOptions = {
        topicId: "0.0.12345",
        topicMemo: "a valid memo",
    };

    describe("topicId", () => {
        it("accepts a string topic ID", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when topicId is missing", () => {
            expect(() =>
                validator.validate(
                    {} as unknown as TopicUpdateOperationOptions,
                ),
            ).toThrow(/topicId is required/);
            expect(() =>
                validator.validate(
                    {} as unknown as TopicUpdateOperationOptions,
                ),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
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

    describe("topicMemo", () => {
        it("accepts a memo at the 100-byte boundary", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicMemo: "x".repeat(100),
                }),
            ).not.toThrow();
        });

        it("accepts an empty-string memo", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicMemo: "" }),
            ).not.toThrow();
        });

        it("accepts a null memo (clears the memo)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicMemo: null }),
            ).not.toThrow();
        });

        it("throws when memo exceeds 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicMemo: "x".repeat(101),
                }),
            ).toThrow(/topicMemo exceeds 100 bytes/);
        });

        it("counts byte length using UTF-8 (multi-byte characters)", () => {
            // Each "あ" is 3 UTF-8 bytes — 34 × 3 = 102 > 100.
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicMemo: "あ".repeat(34),
                }),
            ).toThrow(/topicMemo exceeds 100 bytes/);
        });
    });

    describe("non-clearable fields", () => {
        // TypeScript blocks `null` on these fields at compile time, so
        // we deliberately cast through `unknown` to simulate a JS caller
        // (or `any`-typed data) slipping past the type guard.
        function withRawNull(
            field: "autoRenewPeriod" | "expirationTime",
        ): TopicUpdateOperationOptions {
            return {
                ...baseOptions,
                [field]: null,
            } as unknown as TopicUpdateOperationOptions;
        }

        it("rejects null on autoRenewPeriod (no clearAutoRenewPeriod SDK method)", () => {
            expect(() =>
                validator.validate(withRawNull("autoRenewPeriod")),
            ).toThrow(/autoRenewPeriod cannot be null .* no clear operation/);
        });

        it("rejects null on expirationTime (no clearExpirationTime SDK method)", () => {
            expect(() =>
                validator.validate(withRawNull("expirationTime")),
            ).toThrow(/expirationTime cannot be null .* no clear operation/);
        });

        it("accepts a numeric autoRenewPeriod", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    autoRenewPeriod: 7_776_000,
                }),
            ).not.toThrow();
        });

        it("accepts a Date expirationTime", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    expirationTime: new Date(Date.now() + 86400 * 1000),
                }),
            ).not.toThrow();
        });
    });

    describe("at-least-one-change", () => {
        it("rejects a call with only topicId", () => {
            expect(() => validator.validate({ topicId: "0.0.12345" })).toThrow(
                /updateTopic requires at least one field to change/,
            );
        });

        it("accepts a single clearable field set to its clear sentinel", () => {
            expect(() =>
                validator.validate({
                    topicId: "0.0.12345",
                    submitKey: null,
                }),
            ).not.toThrow();
        });

        it("accepts a single non-clearable field set to a value", () => {
            expect(() =>
                validator.validate({
                    topicId: "0.0.12345",
                    expirationTime: new Date(Date.now() + 86400 * 1000),
                }),
            ).not.toThrow();
        });
    });
});
