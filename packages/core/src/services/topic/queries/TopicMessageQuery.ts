import type {
    SubscriptionHandle,
    TopicId,
    TopicMessage as SdkTopicMessage,
} from "@hiero-ledger/sdk";
import { TopicMessageQuery as SdkTopicMessageQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * A plain-object representation of a single message delivered through a
 * `TopicMessageQuery` subscription.
 *
 * Multi-chunk messages are reassembled by the SDK before being passed to
 * the listener — `contents` already contains the full payload. Per-chunk
 * detail is available on the underlying SDK `TopicMessage` if needed
 * (advanced callers can use `subscribeRaw`).
 */
export interface TopicMessageResult {
    /** Topic-scoped sequence number assigned by consensus. */
    sequenceNumber: string;
    /** ISO-8601 consensus timestamp of the (final chunk of the) message. */
    consensusTimestamp: string;
    /** Reassembled message payload. */
    contents: Uint8Array;
    /** Running hash of the topic after this message. */
    runningHash: Uint8Array;
    /**
     * Transaction ID of the first chunk's submit transaction, or `null`
     * for single-chunk messages on older SDK message envelopes.
     */
    initialTransactionId: string | null;
}

/**
 * Options for subscribing to topic messages via `TopicMessageQuery`.
 *
 * The subscription is a long-lived server-stream — it stays open until
 * `endTime` is reached, `limit` messages are delivered, or
 * `SubscriptionHandle.unsubscribe()` is called.
 */
export interface TopicMessageSubscribeOptions {
    /** Topic to subscribe to (required). */
    topicId: TopicId | string;
    /**
     * Earliest consensus timestamp to deliver. Pass a `Date`, an epoch
     * milliseconds number, or a `Timestamp`. Omit to start from the
     * topic's first message (`0.0`).
     */
    startTime?: Date | number;
    /**
     * Stop delivering messages with consensus timestamps at or after
     * this point and end the subscription. Omit for an open-ended
     * subscription.
     */
    endTime?: Date | number;
    /**
     * Stop the subscription after this many messages have been
     * delivered. Omit for unlimited.
     */
    limit?: number;
    /** Max retry attempts on transient stream errors. */
    maxAttempts?: number;
    /** Cap on exponential-backoff delay in milliseconds. */
    maxBackoff?: number;
    /**
     * Optional callback fired when the stream fails after retries or the
     * listener throws. Receives the error as a `HieroError`. Without it,
     * the error is reported as a `HIERO_SUBSCRIPTION_ERROR` process
     * warning.
     */
    errorHandler?: (message: SdkTopicMessage | null, error: Error) => void;
    /** Optional callback fired when the stream completes naturally. */
    completionHandler?: () => void;
}

/**
 * Subscribe to messages on a topic via the mirror-node consensus stream.
 *
 * Wraps the SDK's `TopicMessageQuery`. The listener receives
 * `TopicMessageResult` objects in consensus order; multi-chunk messages
 * are reassembled by the SDK before delivery. Returns a
 * `SubscriptionHandle` so callers can cancel the stream early.
 */
export class TopicMessageQuery {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Subscribe to topic messages.
     *
     * @param options - Subscription configuration (topic + time/limit filters)
     * @param listener - Invoked once per delivered message
     * @returns A `SubscriptionHandle`; call `.unsubscribe()` to stop the stream
     * @throws {HieroError} If subscription setup fails
     */
    subscribe(
        options: TopicMessageSubscribeOptions,
        listener: (message: TopicMessageResult) => void,
    ): SubscriptionHandle {
        try {
            const query = this.build(options);

            return query.subscribe(
                this.context.client,
                (message, error) => this.handleError(options, message, error),
                (sdkMessage) => listener(toResult(sdkMessage)),
            );
        } catch (error) {
            throw normalizeError(error, "TopicService.subscribeToMessages");
        }
    }

    /**
     * Subscribe and receive the raw SDK `TopicMessage` (including
     * per-chunk detail) instead of the projected `TopicMessageResult`.
     *
     * Use when you need `chunks[]`, the full `Timestamp` precision, or
     * the original `TransactionId` references.
     */
    subscribeRaw(
        options: TopicMessageSubscribeOptions,
        listener: (message: SdkTopicMessage) => void,
    ): SubscriptionHandle {
        try {
            const query = this.build(options);

            return query.subscribe(
                this.context.client,
                (message, error) => this.handleError(options, message, error),
                listener,
            );
        } catch (error) {
            throw normalizeError(error, "TopicService.subscribeToMessages");
        }
    }

    /** Pass the error to the caller's handler as a HieroError, or warn. */
    private handleError(
        options: TopicMessageSubscribeOptions,
        message: SdkTopicMessage | null,
        error: Error,
    ): void {
        const hieroError = normalizeError(
            error,
            "TopicService.subscribeToMessages",
        );
        if (options.errorHandler != null) {
            options.errorHandler(message, hieroError);
            return;
        }
        process.emitWarning(
            `Subscription to topic ${options.topicId.toString()} failed: ${hieroError.message}`,
            {
                type: "HieroSubscriptionWarning",
                code: "HIERO_SUBSCRIPTION_ERROR",
            },
        );
    }

    private build(options: TopicMessageSubscribeOptions): SdkTopicMessageQuery {
        const query = new SdkTopicMessageQuery().setTopicId(options.topicId);

        if (options.startTime != null) {
            query.setStartTime(options.startTime);
        }
        if (options.endTime != null) {
            query.setEndTime(options.endTime);
        }
        if (options.limit != null) {
            query.setLimit(options.limit);
        }
        if (options.maxAttempts != null) {
            query.setMaxAttempts(options.maxAttempts);
        }
        if (options.maxBackoff != null) {
            query.setMaxBackoff(options.maxBackoff);
        }
        if (options.completionHandler != null) {
            query.setCompletionHandler(options.completionHandler);
        }

        return query;
    }
}

function toResult(sdkMessage: SdkTopicMessage): TopicMessageResult {
    return {
        sequenceNumber: sdkMessage.sequenceNumber.toString(),
        consensusTimestamp: sdkMessage.consensusTimestamp
            .toDate()
            .toISOString(),
        contents: sdkMessage.contents,
        runningHash: sdkMessage.runningHash,
        initialTransactionId:
            sdkMessage.initialTransactionId?.toString() ?? null,
    };
}
