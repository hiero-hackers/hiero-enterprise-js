import { validationError } from "../../../errors/index.js";
import type { ScheduleSignOptions } from "../operations/ScheduleSignOperation.js";

/**
 * Validates caller-provided options before the ScheduleSignOperation builds
 * or submits any transaction.
 *
 * Separated from the operation so validation logic is independently testable
 * without requiring network interaction.
 */
export class ScheduleSignValidator {
    /**
     * Validate sign options before any SDK construction.
     *
     * @param options - The caller-provided sign options
     * @throws {HieroError} If validation fails
     */
    validate(options: ScheduleSignOptions): void {
        this.validateScheduleId(options);
    }

    private validateScheduleId(options: ScheduleSignOptions): void {
        if (
            typeof options.scheduleId === "string" &&
            options.scheduleId.trim() === ""
        ) {
            throw validationError(
                "ScheduleSignValidator",
                "scheduleId cannot be an empty string.",
            );
        }
    }
}
