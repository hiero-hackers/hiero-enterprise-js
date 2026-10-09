import type { Key, Long, AccountId, CustomFixedFee } from "@hiero-ledger/sdk";
import { TopicCreateTransaction } from "@hiero-ledger/sdk";
import { HieroError } from "../../../errors/HieroError.js";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TopicCreateValidator } from "../validation/index.js";

/**
 * Low-level options for the `TopicCreate` SDK transaction.
 *
 * Mirrors the surface of `TopicCreateTransaction`. Callers usually go
 * through `TopicService.createTopic`, which exposes the same shape
 * directly — there is no friendlier wrapper here because every field is
 * already opt-in.
 *
 * A topic is an ordered, immutable, timestamped append-only message log
 * with consensus guarantees:
 *
 *  - Every submitted message receives a consensus timestamp and a
 *    monotonically increasing sequence number.
 *  - Messages are folded into a running hash that downstream subscribers
 *    can verify for tamper detection.
 *  - When `submitKey` is set, only signers holding that key may submit
 *    messages (private topic). When omitted, the topic is public and
 *    anyone may submit.
 *  - `adminKey` is required to later update or delete the topic;
 *    topics created without one are immutable.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface TopicCreateOperationOptions extends TransactionOptions {
    /** Topic-level memo (max 100 bytes). */
    topicMemo?: string;
    /**
     * Admin key. Required to later update or delete the topic — without
     * it the topic is immutable.
     */
    adminKey?: Key;
    /**
     * Submit key. When set, only signers holding this key may submit
     * messages. When omitted, the topic is public.
     */
    submitKey?: Key;
    /**
     * Account charged for auto-renewal fees. Required when `adminKey`
     * is set (the network refuses an empty admin'd topic with no
     * renewal account). The account must sign the transaction — add its
     * key to `additionalSigners`.
     */
    autoRenewAccountId?: string | AccountId;
    /**
     * Auto-renew period for the topic, in seconds. Network bounds apply
     * (currently 6,999,999 – 8,000,001 s, ~81 – ~92 days).
     */
    autoRenewPeriod?: Long | number;
    /**
     * Fee schedule key (HIP-991). Holder may update `customFees` and
     * `feeExemptKeys` post-create.
     */
    feeScheduleKey?: Key;
    /**
     * Keys whose holders are exempt from `customFees` when submitting
     * messages (HIP-991).
     */
    feeExemptKeys?: Key[];
    /**
     * Custom fees charged on each message submission (HIP-991). Requires
     * `feeScheduleKey` for later updates.
     */
    customFees?: CustomFixedFee[];
}

export class TopicCreateOperation extends BaseOperation<TopicCreateOperationOptions> {
    protected readonly type = "TopicCreate";
    protected readonly serviceName = "TopicService";
    protected readonly methodName = "createTopic";
    protected readonly validator = new TopicCreateValidator();

    /** Submit a `TopicCreateTransaction` and return the new topic ID. */
    async execute(options: TopicCreateOperationOptions) {
        const results = await this.run(options);

        if (!results.receipt.topicId) {
            throw new HieroError(
                "Topic creation failed — no topicId returned in receipt.",
                {
                    code: "SDK_ERROR",
                    context: "TopicCreateOperation.execute",
                    sdkStatus: results.status,
                    transactionId: results.transactionId,
                },
            );
        }

        return {
            ...results,
            topicId: results.receipt.topicId,
        };
    }

    /** Schedule a `TopicCreateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TopicCreateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    /**
     * Construct the `TopicCreateTransaction` from the caller-provided
     * options. Only fields that were explicitly supplied are forwarded
     * so the SDK defaults remain in effect for omitted options.
     */
    protected build(
        options: TopicCreateOperationOptions,
    ): TopicCreateTransaction {
        const tx = new TopicCreateTransaction();

        if (options.topicMemo != null) {
            tx.setTopicMemo(options.topicMemo);
        }

        if (options.adminKey != null) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.submitKey != null) {
            tx.setSubmitKey(options.submitKey);
        }

        if (options.autoRenewAccountId != null) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.feeScheduleKey != null) {
            tx.setFeeScheduleKey(options.feeScheduleKey);
        }

        if (options.feeExemptKeys != null) {
            tx.setFeeExemptKeys(options.feeExemptKeys);
        }

        if (options.customFees != null) {
            tx.setCustomFees(options.customFees);
        }

        return tx;
    }
}
