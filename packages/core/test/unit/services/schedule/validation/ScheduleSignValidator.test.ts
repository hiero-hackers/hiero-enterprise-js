import { describe, it, expect } from "vitest";
import { ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleSignValidator } from "../../../../../src/services/schedule/validation/index.js";
import type { ScheduleSignOptions } from "../../../../../src/services/schedule/operations/index.js";

describe("ScheduleSignValidator", () => {
    const validator = new ScheduleSignValidator();

    const baseOptions: ScheduleSignOptions = {
        scheduleId: "0.0.12345",
    };

    describe("scheduleId", () => {
        it("passes with a valid scheduleId string", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("passes with a ScheduleId instance", () => {
            expect(() =>
                validator.validate({
                    scheduleId: ScheduleId.fromString("0.0.12345"),
                }),
            ).not.toThrow();
        });

        it("throws when scheduleId is null", () => {
            expect(() =>
                validator.validate({
                    scheduleId: null as unknown as string,
                }),
            ).toThrow(/scheduleId is required/);
        });

        it("throws when scheduleId is undefined", () => {
            expect(() =>
                validator.validate({
                    scheduleId: undefined as unknown as string,
                }),
            ).toThrow(/scheduleId is required/);
        });

        it("throws when scheduleId is an empty string", () => {
            expect(() => validator.validate({ scheduleId: "" })).toThrow(
                /scheduleId cannot be an empty string/,
            );
        });

        it("throws when scheduleId is whitespace only", () => {
            expect(() => validator.validate({ scheduleId: "   " })).toThrow(
                /scheduleId cannot be an empty string/,
            );
        });
    });
});
