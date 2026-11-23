import type { CustomFixedFee, Key, TopicId } from "@hiero-ledger/sdk";
import { Status, TopicInfoQuery as SdkTopicInfoQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

const CONTEXT = "TopicService.getTopicInfo";

/**
 * A plain-object representation of a topic's current consensus-node
 * state.
 *
 * Maps the SDK's `TopicInfo` to JS-friendly types so callers are not
 * coupled to SDK primitives like `Long`, `Timestamp`, and `Duration`.
 *
 * Returned by `TopicService.getTopicInfo`.
 */
export interface TopicInfoResult {
    /** The topic entity ID (e.g., `"0.0.12345"`). */
    topicId: string;
    /** Short publicly visible memo. */
    topicMemo: string;
    /**
     * SHA-384 running hash of (previousRunningHash, topicId,
     * consensusTimestamp, sequenceNumber, message). Useful for verifying
     * message ordering and authenticity.
     */
    runningHash: Uint8Array;
    /**
     * Sequence number of the last message on the topic (starting at 1
     * for the first submitted message). Stringified to preserve
     * precision.
     */
    sequenceNumber: string;
    /** ISO-8601 timestamp at which the topic will expire, or `null`. */
    expirationTime: string | null;
    /** Admin key — required to update / delete the topic. `null` for immutable topics. */
    adminKey: Key | null;
    /** Submit key — required to submit messages. `null` for public topics. */
    submitKey: Key | null;
    /** Fee schedule key (HIP-991) — required to update custom fees. */
    feeScheduleKey: Key | null;
    /** Keys exempt from paying HIP-991 custom fees on submit. */
    feeExemptKeys: Key[] | null;
    /** Auto-renew period in seconds, or `null` if no auto-renew account. */
    autoRenewPeriod: number | null;
    /** Account charged for auto-renewal, or `null` if none. */
    autoRenewAccountId: string | null;
    /** Custom fees charged on each message submission (HIP-991, fixed only). */
    customFees: CustomFixedFee[] | null;
    /** Ledger this topic lives on (mainnet / testnet / previewnet), as a hex string. */
    ledgerId: string | null;
}

/**
 * Read-only consensus query for topic state.
 *
 * Wraps the SDK's `TopicInfoQuery` and projects the result to a plain
 * `TopicInfoResult` object decoupled from SDK primitives. Hits the
 * consensus nodes directly — returns the most current state with no
 * mirror-node propagation lag.
 */
export class TopicInfoQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    /**
     * Fetch the current state of a topic from the consensus nodes.
     *
     * @param topicId - The topic entity ID (e.g., `"0.0.12345"`)
     * @returns Plain-object topic info — never `null`; throws if the
     *          topic does not exist or the network rejects the query
     * @throws {HieroError} `INPUT_INVALID` if `topicId` is missing or empty
     */
    async execute(
        topicId: string | TopicId,
        options: QueryOptions = {},
    ): Promise<TopicInfoResult> {
        if (topicId == null) {
            throw validationError(
                CONTEXT,
                "topicId is required.",
                Status.InvalidTopicId,
            );
        }

        if (typeof topicId === "string" && topicId.trim().length === 0) {
            throw validationError(CONTEXT, "topicId cannot be empty.");
        }

        try {
            const query = new SdkTopicInfoQuery().setTopicId(topicId);
            const info = await this.executor.run(query, options, {
                type: "TopicInfoQuery",
                serviceName: "TopicService",
                methodName: "getTopicInfo",
                timestamp: new Date(),
            });
            return {
                topicId: info.topicId.toString(),
                topicMemo: info.topicMemo,
                runningHash: info.runningHash,
                sequenceNumber: info.sequenceNumber.toString(),
                expirationTime: info.expirationTime
                    ? info.expirationTime.toDate().toISOString()
                    : null,
                adminKey: info.adminKey,
                submitKey: info.submitKey,
                feeScheduleKey: info.feeScheduleKey,
                feeExemptKeys: info.feeExemptKeys,
                autoRenewPeriod:
                    info.autoRenewPeriod?.seconds.toNumber() ?? null,
                autoRenewAccountId: info.autoRenewAccountId?.toString() ?? null,
                customFees: info.customFees,
                ledgerId: info.ledgerId?.toString() ?? null,
            };
        } catch (error) {
            throw normalizeError(error, CONTEXT);
        }
    }
}
