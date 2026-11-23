import { Status } from "@hiero-ledger/sdk";
import type { AccountId } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type {
    DeleteAccountOptions,
    ScheduleDeleteAccountOptions,
} from "../operations/DeleteAccountOperation.js";

/**
 * Validates caller-provided options before the DeleteAccountOperation builds
 * or submits any transaction.
 *
 * Separated from the operation so validation logic is independently testable
 * without requiring network interaction.
 */
export class DeleteAccountValidator {
    /**
     * Validate delete options before any SDK construction.
     *
     * @param options - The caller-provided delete options
     * @throws {HieroError} If validation fails
     */
    validate(options: ScheduleDeleteAccountOptions): void {
        this.validateAccountId(options.accountId, "accountId");
        if (options.transferAccountId != null) {
            this.validateAccountId(
                options.transferAccountId,
                "transferAccountId",
            );
        }
    }

    /**
     * Validate the account key needed to delete immediately. Scheduled
     * deletions collect the owner's signature later, so they skip it.
     *
     * @param options - The caller-provided delete options
     * @throws {HieroError} If `accountKey` is missing
     */
    validateAccountKey(options: DeleteAccountOptions): void {
        if (options.accountKey == null) {
            throw validationError(
                "DeleteAccountValidator",
                "accountKey is required.",
            );
        }
    }

    private validateAccountId(
        value: string | AccountId | null | undefined,
        paramName: string,
    ): void {
        if (value == null) {
            throw validationError(
                "DeleteAccountValidator",
                `${paramName} is required.`,
                Status.AccountIdDoesNotExist,
            );
        }

        if (typeof value === "string" && value.trim() === "") {
            throw validationError(
                "DeleteAccountValidator",
                `${paramName} cannot be an empty string.`,
            );
        }
    }
}
