import { normalizeError } from "../../../errors/index.js";
import type { ScheduleCancelOptions } from "../operations/ScheduleCancelOperation.js";

/**
 * Validates caller-provided options before the ScheduleCancelOperation builds
 * or submits any transaction.
 *
 * Separated from the operation so validation logic is independently testable
 * without requiring network interaction.
 */
export class ScheduleCancelValidator {
    /**
     * Validate cancel options before any SDK construction.
     *
     * @param options - The caller-provided cancel options
     * @throws {HieroError} If validation fails
     */
    validate(options: ScheduleCancelOptions): void {
        this.validateScheduleId(options);
        this.validateAdminKey(options);
    }

    private validateScheduleId(options: ScheduleCancelOptions): void {
        if (options.scheduleId == null) {
            throw normalizeError(
                new Error("scheduleId is required."),
                "ScheduleCancelValidator",
            );
        }

        if (
            typeof options.scheduleId === "string" &&
            options.scheduleId.trim() === ""
        ) {
            throw normalizeError(
                new Error("scheduleId cannot be an empty string."),
                "ScheduleCancelValidator",
            );
        }
    }

    private validateAdminKey(options: ScheduleCancelOptions): void {
        if (options.adminKey == null) {
            throw normalizeError(
                new Error("adminKey is required."),
                "ScheduleCancelValidator",
            );
        }
    }
}
