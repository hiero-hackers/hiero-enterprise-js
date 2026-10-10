import { describe, it, expect } from "vitest";
import { PrivateKey, ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleCancelValidator } from "../../../../../src/services/schedule/validation/index.js";
import type { ScheduleCancelOptions } from "../../../../../src/services/schedule/operations/index.js";

describe("ScheduleCancelValidator", () => {
    const validator = new ScheduleCancelValidator();
    const adminKey = PrivateKey.generateED25519();

    const baseOptions: ScheduleCancelOptions = {
        scheduleId: "0.0.12345",
        adminKey,
    };

    describe("scheduleId", () => {
        it("passes with a valid scheduleId string and adminKey", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("passes with a ScheduleId instance", () => {
            expect(() =>
                validator.validate({
                    scheduleId: ScheduleId.fromString("0.0.12345"),
                    adminKey,
                }),
            ).not.toThrow();
        });

        it("throws when scheduleId is null", () => {
            expect(() =>
                validator.validate({
                    scheduleId: null as unknown as string,
                    adminKey,
                }),
            ).toThrow(/scheduleId is required/);
        });

        it("throws when scheduleId is undefined", () => {
            expect(() =>
                validator.validate({
                    scheduleId: undefined as unknown as string,
                    adminKey,
                }),
            ).toThrow(/scheduleId is required/);
        });

        it("throws when scheduleId is an empty string", () => {
            expect(() =>
                validator.validate({ scheduleId: "", adminKey }),
            ).toThrow(/scheduleId cannot be an empty string/);
        });

        it("throws when scheduleId is whitespace only", () => {
            expect(() =>
                validator.validate({ scheduleId: "   ", adminKey }),
            ).toThrow(/scheduleId cannot be an empty string/);
        });
    });

    describe("adminKey", () => {
        it("throws when adminKey is null", () => {
            expect(() =>
                validator.validate({
                    scheduleId: "0.0.12345",
                    adminKey: null as unknown as PrivateKey,
                }),
            ).toThrow(/adminKey is required/);
        });

        it("throws when adminKey is undefined", () => {
            expect(() =>
                validator.validate({
                    scheduleId: "0.0.12345",
                    adminKey: undefined as unknown as PrivateKey,
                }),
            ).toThrow(/adminKey is required/);
        });
    });
});
