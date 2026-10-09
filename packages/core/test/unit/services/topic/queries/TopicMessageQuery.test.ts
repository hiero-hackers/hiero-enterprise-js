import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    Long,
    SubscriptionHandle,
    Timestamp,
    TopicId,
    TopicMessageQuery as SdkTopicMessageQuery,
    TransactionId,
    type TopicMessage,
} from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { TopicMessageQuery } from "../../../../../src/services/topic/queries/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK queries; only TopicMessageQuery.subscribe, which opens the
// mirror-node stream, is stubbed. Messages are plain data built from real
// SDK values, because TopicMessage has no public constructor.

function topicMessage(overrides: Partial<TopicMessage> = {}): TopicMessage {
    return {
        sequenceNumber: Long.fromNumber(7),
        consensusTimestamp: Timestamp.fromDate(
            new Date("2024-01-02T03:04:05.000Z"),
        ),
        contents: new Uint8Array([10, 20, 30]),
        runningHash: new Uint8Array([1, 2, 3]),
        initialTransactionId: TransactionId.fromString(
            "0.0.2@1700000000.123456789",
        ),
        chunks: [],
        ...overrides,
    } as TopicMessage;
}

describe("TopicMessageQuery (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;
    let handle: SubscriptionHandle;
    let subscribe: ReturnType<typeof vi.spyOn>;

    /** The query that was subscribed. */
    const sentQuery = (call = 0) =>
        subscribe.mock.contexts.at(call) as SdkTopicMessageQuery;
    /** The listener core handed to the SDK. */
    const sdkListener = () =>
        subscribe.mock.calls[0][2] as (message: TopicMessage) => void;

    beforeEach(() => {
        handle = new SubscriptionHandle();
        subscribe = vi
            .spyOn(SdkTopicMessageQuery.prototype, "subscribe")
            .mockReturnValue(handle);
        context = createMockContext();
        service = new TopicService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("subscribes to a topic and projects SDK messages to plain objects", () => {
        const listener = vi.fn();

        const result = service.subscribeToMessages(
            { topicId: "0.0.1234" },
            listener,
        );

        expect(result).toBe(handle);
        expect(sentQuery()).toBeInstanceOf(SdkTopicMessageQuery);
        expect(sentQuery().topicId?.toString()).toBe("0.0.1234");
        expect(subscribe).toHaveBeenCalledWith(
            context.client,
            null,
            expect.any(Function),
        );

        sdkListener()(topicMessage());

        expect(listener).toHaveBeenCalledWith({
            sequenceNumber: "7",
            consensusTimestamp: "2024-01-02T03:04:05.000Z",
            contents: new Uint8Array([10, 20, 30]),
            runningHash: new Uint8Array([1, 2, 3]),
            initialTransactionId: "0.0.2@1700000000.123456789",
        });
    });

    it("projects null initialTransactionId to null in the result", () => {
        const listener = vi.fn();
        service.subscribeToMessages({ topicId: "0.0.1" }, listener);

        sdkListener()(topicMessage({ initialTransactionId: null }));

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ initialTransactionId: null }),
        );
    });

    it("sets all optional filters on the SDK query", () => {
        // The SDK has no getter for the completion handler.
        const setCompletionHandler = vi.spyOn(
            SdkTopicMessageQuery.prototype,
            "setCompletionHandler",
        );
        const start = new Date("2024-01-01T00:00:00.000Z");
        const end = new Date("2024-12-31T00:00:00.000Z");
        const errorHandler = vi.fn();
        const completionHandler = vi.fn();

        service.subscribeToMessages(
            {
                topicId: TopicId.fromString("0.0.42"),
                startTime: start,
                endTime: end,
                limit: 5,
                maxAttempts: 3,
                maxBackoff: 8000,
                errorHandler,
                completionHandler,
            },
            () => {},
        );

        const query = sentQuery();
        expect(query.topicId?.toString()).toBe("0.0.42");
        expect(query.startTime?.toDate()).toEqual(start);
        expect(query.endTime?.toDate()).toEqual(end);
        expect(query.limit?.toNumber()).toBe(5);
        expect(query._maxAttempts).toBe(3);
        expect(query._maxBackoff).toBe(8000);
        expect(setCompletionHandler).toHaveBeenCalledWith(completionHandler);
        expect(subscribe).toHaveBeenCalledWith(
            context.client,
            errorHandler,
            expect.any(Function),
        );
    });

    it("keeps the SDK defaults when optional fields are omitted", () => {
        const setCompletionHandler = vi.spyOn(
            SdkTopicMessageQuery.prototype,
            "setCompletionHandler",
        );

        service.subscribeToMessages({ topicId: "0.0.1" }, () => {});

        const query = sentQuery();
        const defaults = new SdkTopicMessageQuery();
        expect(query.startTime).toEqual(defaults.startTime);
        expect(query.endTime).toEqual(defaults.endTime);
        expect(query.limit).toEqual(defaults.limit);
        expect(query._maxAttempts).toBe(defaults._maxAttempts);
        expect(query._maxBackoff).toBe(defaults._maxBackoff);
        expect(setCompletionHandler).not.toHaveBeenCalled();
    });

    it("normalises subscribe-time errors with the TopicService.subscribeToMessages context", () => {
        subscribe.mockImplementationOnce(() => {
            throw new Error("subscribe failed");
        });

        expect(() =>
            service.subscribeToMessages({ topicId: "0.0.1" }, () => {}),
        ).toThrow(
            expect.objectContaining({
                name: "HieroError",
                context: "TopicService.subscribeToMessages",
                message: "subscribe failed",
            }),
        );
    });

    it("builds a new query for every subscribe call", () => {
        service.subscribeToMessages({ topicId: "0.0.1" }, () => {});
        service.subscribeToMessages({ topicId: "0.0.2" }, () => {});

        expect(sentQuery(0)).not.toBe(sentQuery(1));
        expect(sentQuery(1).topicId?.toString()).toBe("0.0.2");
    });

    describe("subscribeRaw", () => {
        it("passes the raw SDK message straight to the listener", () => {
            const query = new TopicMessageQuery(context);
            const listener = vi.fn();

            const result = query.subscribeRaw(
                { topicId: "0.0.1234" },
                listener,
            );

            expect(result).toBe(handle);
            expect(sentQuery().topicId?.toString()).toBe("0.0.1234");
            expect(subscribe).toHaveBeenCalledWith(
                context.client,
                null,
                listener,
            );

            const message = topicMessage();
            sdkListener()(message);

            expect(listener).toHaveBeenCalledWith(message);
        });

        it("sets optional filters and uses the provided errorHandler", () => {
            const setCompletionHandler = vi.spyOn(
                SdkTopicMessageQuery.prototype,
                "setCompletionHandler",
            );
            const query = new TopicMessageQuery(context);
            const errorHandler = vi.fn();

            query.subscribeRaw(
                {
                    topicId: "0.0.1",
                    startTime: 1700000000000,
                    endTime: 1800000000000,
                    limit: 10,
                    maxAttempts: 4,
                    maxBackoff: 16000,
                    completionHandler: vi.fn(),
                    errorHandler,
                },
                () => {},
            );

            const sdkQuery = sentQuery();
            // The SDK reads a number as epoch seconds.
            expect(sdkQuery.startTime?.seconds.toNumber()).toBe(1700000000000);
            expect(sdkQuery.endTime?.seconds.toNumber()).toBe(1800000000000);
            expect(sdkQuery.limit?.toNumber()).toBe(10);
            expect(sdkQuery._maxAttempts).toBe(4);
            expect(sdkQuery._maxBackoff).toBe(16000);
            expect(setCompletionHandler).toHaveBeenCalled();
            expect(subscribe).toHaveBeenCalledWith(
                context.client,
                errorHandler,
                expect.any(Function),
            );
        });

        it("normalises subscribe-time errors with the TopicService.subscribeToMessages context", () => {
            subscribe.mockImplementationOnce(() => {
                throw new Error("raw subscribe failed");
            });

            const query = new TopicMessageQuery(context);

            expect(() =>
                query.subscribeRaw({ topicId: "0.0.1" }, () => {}),
            ).toThrow(
                expect.objectContaining({
                    name: "HieroError",
                    context: "TopicService.subscribeToMessages",
                    message: "raw subscribe failed",
                }),
            );
        });
    });
});
