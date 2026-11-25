import { ScheduleId, Status } from "@hiero-ledger/sdk";
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
        this.validateAdminKey(options);
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

        if (typeof options.scheduleId === "string") {
            try {
                ScheduleId.fromString(options.scheduleId);
            } catch {
                throw validationError(
                    "ScheduleCancelValidator",
                    `scheduleId "${options.scheduleId}" is not a valid schedule ID. Expected "<shard>.<realm>.<num>".`,
                );
            }
        }
    }

    private validateAdminKey(options: ScheduleCancelOptions): void {
        if (options.adminKey == null) {
            throw validationError(
                "ScheduleCancelValidator",
                "adminKey is required.",
                Status.InvalidSignature,
            );
        }
    }
}
