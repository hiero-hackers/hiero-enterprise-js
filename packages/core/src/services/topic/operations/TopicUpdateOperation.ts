import type {
    Key,
    Long,
    AccountId,
    CustomFixedFee,
    Timestamp,
    TopicId,
} from "@hiero-ledger/sdk";
import { TopicUpdateTransaction, KeyList } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TopicUpdateValidator } from "../validation/index.js";

/**
 * Canonical Hedera sentinel for clearing the auto-renew account on a
 * topic — `AccountID(0, 0, 0)`. The Java SDK uses the same value; the
 * JS SDK's `clearAutoRenewAccountId()` is buggy (sets the local field
 * to `null`, which protobuf drops as "absent" / no-op), so we route
 * around it via `setAutoRenewAccountId("0.0.0")`.
 */
const SENTINEL_CLEAR_AUTO_RENEW_ACCOUNT = "0.0.0";

/**
 * Low-level options for the `TopicUpdate` SDK transaction.
 *
 * Mirrors the surface of `TopicUpdateTransaction`. Callers usually go
 * through `TopicService.updateTopic`, which exposes the same shape.
 *
 * Most optional fields follow a three-state pattern:
 *
 *  - **omitted (undefined)** — leave the current network value unchanged
 *  - **`null`**               — clear the field on the network (only
 *                               supported on fields explicitly typed
 *                               `T | null`)
 *  - **a value**              — replace the current value with the
 *                               provided one
 *
 * Fields typed `T | undefined` (without `null`) are **not clearable** —
 * the SDK exposes no `clearX()` for them. The validator rejects `null`
 * on these fields (in JS callers without TypeScript guard rails) so the
 * caller's intent isn't silently dropped.
 *
 * At least one optional field must be provided alongside `topicId` —
 * a no-op update is rejected by the validator before any network call.
 *
 * **Signing rules (enforced by the network, not this validator):**
 *
 *  - If the topic has no `adminKey`, the only authorized update is to
 *    **extend `expirationTime`**. Every other change is rejected — this
 *    extension is the one update anyone can submit without an admin
 *    signature.
 *  - Otherwise the transaction must be signed by the topic's existing
 *    `adminKey`. Supply it via `additionalSigners` (or `externalSigners`)
 *    if the operator client isn't already that key.
 *  - Rotating the `adminKey` (replacing it with a new value, not
 *    clearing it) requires signatures from BOTH the **pre-update** and
 *    **post-update** admin keys — pass both via `additionalSigners`.
 *  - Switching to a new `autoRenewAccountId` (not just clearing it)
 *    requires that account's signature too.
 *
 * `TopicUpdate` is **not whitelisted for scheduling** on the network,
 * so no `schedule()` variant is exposed.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers.
 */
export interface TopicUpdateOperationOptions extends TransactionOptions {
    /** Topic to update. */
    topicId: string | TopicId;
    /** New topic-level memo (max 100 bytes). `null` clears the memo. */
    topicMemo?: string | null;
    /** Replace the admin key. `null` makes the topic immutable. */
    adminKey?: Key | null;
    /** Replace the submit key. `null` makes the topic public. */
    submitKey?: Key | null;
    /** Replace the fee-schedule key (HIP-991). `null` clears it. */
    feeScheduleKey?: Key | null;
    /** Replace the fee-exempt keys (HIP-991). `null` clears them. */
    feeExemptKeys?: Key[] | null;
    /** Replace the auto-renew account. `null` clears it. */
    autoRenewAccountId?: string | AccountId | null;
    /**
     * New auto-renew period, in seconds. **Not clearable** — passing
     * `null` is rejected by the validator. Omit to leave unchanged.
     */
    autoRenewPeriod?: Long | number;
    /** Replace the custom fees (HIP-991). `null` clears them. */
    customFees?: CustomFixedFee[] | null;
    /**
     * Extend the topic's expiration. **Not clearable** — passing `null`
     * is rejected by the validator. Omit to leave unchanged.
     */
    expirationTime?: Timestamp | Date;
}

export class TopicUpdateOperation extends BaseOperation<TopicUpdateOperationOptions> {
    protected readonly type = "TopicUpdate";
    protected readonly serviceName = "TopicService";
    protected readonly methodName = "updateTopic";
    protected readonly validator = new TopicUpdateValidator();

    /** Submit a `TopicUpdateTransaction`. */
    async execute(options: TopicUpdateOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TopicUpdateOperationOptions,
    ): TopicUpdateTransaction {
        const tx = new TopicUpdateTransaction().setTopicId(options.topicId);

        if (options.topicMemo === null) {
            // SDK `clearTopicMemo()` is a no-op on the network — use the
            // empty-string sentinel that the consensus node honours.
            tx.setTopicMemo("");
        } else if (options.topicMemo !== undefined) {
            tx.setTopicMemo(options.topicMemo);
        }

        if (options.adminKey === null) {
            tx.setAdminKey(new KeyList());
        } else if (options.adminKey !== undefined) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.submitKey === null) {
            tx.setSubmitKey(new KeyList());
        } else if (options.submitKey !== undefined) {
            tx.setSubmitKey(options.submitKey);
        }

        if (options.feeScheduleKey === null) {
            tx.setFeeScheduleKey(new KeyList());
        } else if (options.feeScheduleKey !== undefined) {
            tx.setFeeScheduleKey(options.feeScheduleKey);
        }

        if (options.feeExemptKeys === null) {
            // `clearFeeExemptKeys()` correctly emits an empty list — the
            // canonical sentinel for clearing this field.
            tx.clearFeeExemptKeys();
        } else if (options.feeExemptKeys !== undefined) {
            tx.setFeeExemptKeys(options.feeExemptKeys);
        }

        if (options.autoRenewAccountId === null) {
            tx.setAutoRenewAccountId(SENTINEL_CLEAR_AUTO_RENEW_ACCOUNT);
        } else if (options.autoRenewAccountId !== undefined) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.customFees === null) {
            // `clearCustomFees()` correctly emits an empty list — the
            // canonical sentinel for clearing this field.
            tx.clearCustomFees();
        } else if (options.customFees !== undefined) {
            tx.setCustomFees(options.customFees);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        return tx;
    }
}
