import { validationError } from "../../../errors/index.js";
import type { TopicCreateOperationOptions } from "../operations/index.js";

/**
 * Validates `TopicCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Most of the topic-create surface is fully optional, so this validator
 * intentionally enforces only the cross-field invariant the network
 * itself rejects late: when an `adminKey` is set, an `autoRenewAccountId`
 * is required (the network returns `AUTORENEW_ACCOUNT_REQUIRED`
 * otherwise). All other constraints (memo length, auto-renew period
 * bounds, key validity) are left to the SDK / network so we don't drift.
 */
export class TopicCreateValidator {
    /**
     * Validate the caller-provided options prior to building or
     * submitting the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TopicCreateOperationOptions): void {
        if (options.adminKey != null && options.autoRenewAccountId == null) {
            throw validationError(
                "TopicCreateValidator",
                "autoRenewAccountId is required when an adminKey is set.",
            );
        }
    }
}
