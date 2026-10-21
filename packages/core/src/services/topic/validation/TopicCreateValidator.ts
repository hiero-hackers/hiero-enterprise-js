import type { TopicCreateOperationOptions } from "../operations/index.js";

/**
 * Validates `TopicCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Every topic-create field is optional, and the network checks the
 * constraints (memo length, auto-renew period bounds, keys, and that an
 * auto-renew account needs an admin key), so there is nothing to check
 * up front. Without an `autoRenewAccountId`, the SDK uses the payer.
 */
export class TopicCreateValidator {
    /**
     * Validate the caller-provided options prior to building or
     * submitting the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(_options: TopicCreateOperationOptions): void {}
}
