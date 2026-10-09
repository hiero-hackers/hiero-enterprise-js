import { validationError } from "../../../errors/index.js";
import type { TopicUpdateOperationOptions } from "../operations/index.js";

const MAX_TOPIC_MEMO_BYTES = 100;

/**
 * Validates `TopicUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * **What this validator enforces:**
 *  - `topicId` is present and non-empty.
 *  - A non-cleared `topicMemo` fits the network's 100-byte limit.
 *  - Non-clearable fields (`autoRenewPeriod`, `expirationTime`) reject
 *    `null` explicitly. TypeScript blocks this at compile time, but
 *    JavaScript callers and `any`-typed data can still slip a `null`
 *    through — without this check the SDK would silently ignore the
 *    field and the caller's intent would be lost.
 *  - The transaction changes at least one field — calling
 *    `updateTopic` with only `topicId` would burn network fees on a
 *    no-op, which is almost always a programmer mistake.
 *
 * **Signing rules we do _not_ enforce locally** (network-enforced via
 * `INVALID_SIGNATURE`):
 *  - If the topic has no `adminKey`, the only authorized update is to
 *    extend `expirationTime`. Every other change is rejected.
 *  - Otherwise the transaction must be signed by the existing
 *    `adminKey` — supply it via `additionalSigners` (or `externalSigners`)
 *    if the operator is not already that key.
 *  - Rotating the `adminKey` (replacing it with a new value, not
 *    clearing it) requires signatures from BOTH the pre-update and
 *    post-update admin keys.
 *  - Switching to a new `autoRenewAccountId` (not just clearing it)
 *    requires that account's signature.
 *
 * These rules depend on the topic's current network state and on the
 * operator's identity, neither of which the validator can see — so we
 * leave them to the network and document them on every entry point.
 */
export class TopicUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or
     * submitting the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TopicUpdateOperationOptions): void {
        this.validateTopicId(options);
        this.validateMemo(options);
        this.validateNonClearableFields(options);
        this.validateAtLeastOneChange(options);
    }

    private validateTopicId(options: TopicUpdateOperationOptions): void {
        if (options.topicId == null) {
            throw validationError(
                "TopicUpdateValidator",
                "topicId is required.",
            );
        }

        if (
            typeof options.topicId === "string" &&
            options.topicId.trim().length === 0
        ) {
            throw validationError(
                "TopicUpdateValidator",
                "topicId cannot be empty.",
            );
        }
    }

    private validateMemo(options: TopicUpdateOperationOptions): void {
        // `null` clears the memo on the network — no length check needed.
        if (options.topicMemo == null) return;

        const byteLength = Buffer.byteLength(options.topicMemo, "utf8");
        if (byteLength > MAX_TOPIC_MEMO_BYTES) {
            throw validationError(
                "TopicUpdateValidator",
                `topicMemo exceeds ${MAX_TOPIC_MEMO_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    /**
     * Reject `null` on fields the SDK has no `clearX()` for —
     * `autoRenewPeriod` and `expirationTime`. Without this guard a JS
     * caller passing `null` to one of these would have it silently
     * dropped by `build()` instead of triggering the clear they
     * expected.
     */
    private validateNonClearableFields(
        options: TopicUpdateOperationOptions,
    ): void {
        // Read with a deliberately wide cast — TypeScript blocks `null`
        // at compile time, but JS callers / `any` data can still pass it.
        const wide = options as {
            autoRenewPeriod?: unknown;
            expirationTime?: unknown;
        };

        if (wide.autoRenewPeriod === null) {
            throw validationError(
                "TopicUpdateValidator",
                "autoRenewPeriod cannot be null — this field has no clear operation. Omit it to leave unchanged.",
            );
        }

        if (wide.expirationTime === null) {
            throw validationError(
                "TopicUpdateValidator",
                "expirationTime cannot be null — this field has no clear operation. Omit it to leave unchanged.",
            );
        }
    }

    /**
     * Reject calls that wouldn't change anything on the network.
     *
     * A `TopicUpdate` with only `topicId` and no other field still
     * costs network fees but mutates nothing — it's almost always a
     * programmer bug (a field name typo, a missed conditional). Fail
     * loudly instead of silently burning HBAR.
     */
    private validateAtLeastOneChange(
        options: TopicUpdateOperationOptions,
    ): void {
        const hasChange =
            options.topicMemo !== undefined ||
            options.adminKey !== undefined ||
            options.submitKey !== undefined ||
            options.feeScheduleKey !== undefined ||
            options.feeExemptKeys !== undefined ||
            options.autoRenewAccountId !== undefined ||
            options.autoRenewPeriod !== undefined ||
            options.customFees !== undefined ||
            options.expirationTime !== undefined;

        if (!hasChange) {
            throw validationError(
                "TopicUpdateValidator",
                "updateTopic requires at least one field to change. Pass one of: topicMemo, adminKey, submitKey, feeScheduleKey, feeExemptKeys, autoRenewAccountId, autoRenewPeriod, customFees, expirationTime.",
            );
        }
    }
}
