import { Status } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
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
    }

    private validateScheduleId(options: ScheduleCancelOptions): void {
        if (options.scheduleId == null) {
            throw validationError(
                "ScheduleCancelValidator",
                "scheduleId is required.",
                Status.InvalidScheduleId,
            );
        }

        if (
            typeof options.scheduleId === "string" &&
            options.scheduleId.trim() === ""
        ) {
            throw validationError(
                "ScheduleCancelValidator",
                "scheduleId cannot be an empty string.",
            );
        }
    }
}
