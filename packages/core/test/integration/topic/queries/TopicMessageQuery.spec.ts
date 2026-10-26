import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv, wait } from "../../../utils/Env.js";
import { TopicService } from "../../../../src/services/index.js";
import type { SubscribedMessage } from "../../../../src/services/topic/index.js";

// The mirror node imports the
// record stream on a schedule, so subscriptions must be opened AFTER
// the topic-create record has been ingested and messages submitted
// AFTER the subscription is live.
const MIRROR_INGEST_MS = 5_000; // create → subscribe
const STREAM_ESTABLISH_MS = 2_000; // subscribe → first submit
// Delivery is polled, not fixed-slept: a freshly booted Solo mirror can
// lag well past any fixed window (observed >12s in CI), while a warm
// one delivers in ~1s. Poll returns as soon as the condition holds.
const DELIVERY_TIMEOUT_MS = 60_000;
// The vitest budget must exceed the delivery poll plus fixed setup
// waits, or a slow mirror kills the test blind with no diagnostics.
const TEST_TIMEOUT_MS = 120_000;
// Fixed window for NEGATIVE assertions only (proving a message does
// NOT arrive) — absence cannot be polled for.
const NO_DELIVERY_WINDOW_MS = 5_000;
// A freshly booted Solo mirror can NOT_FOUND a new topic long enough
// to exhaust the SDK's default retry budget, silently killing the
// stream. Give subscriptions a generous retry allowance in CI.
const SUBSCRIBE_MAX_ATTEMPTS = 20;

// Poll until `condition` holds, or until the delivery deadline. Stream
// errors are NOT treated as fatal: the SDK's retry machinery may recover
// from a transient gRPC blip and still deliver, so failing on the first
// errorHandler callback would make this flaky. Errors are collected and
// surfaced only if the poll ultimately times out — a silent hang is the
// one outcome this helper refuses to produce.
async function waitForDelivery(
    condition: () => boolean,
    diagnostics: () => string,
    streamErrors: Error[],
): Promise<void> {
    const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
    while (!condition() && Date.now() < deadline) {
        await wait(500);
    }
    if (!condition()) {
        const errorSummary =
            streamErrors.length > 0
                ? ` — stream errors observed while waiting: ${streamErrors
                      .map((e) => e.message)
                      .join("; ")}`
                : "";
        throw new Error(
            `timed out after ${DELIVERY_TIMEOUT_MS}ms waiting for delivery — ${diagnostics()}${errorSummary}`,
        );
    }
}

describe("TopicMessageQuery", () => {
    let topicService: TopicService;

    beforeAll(() => {
        topicService = new TopicService(setupIntegrationTestEnv());
    });

    it(
        "delivers a single submitted message to the listener",
        { timeout: TEST_TIMEOUT_MS },
        async () => {
            const { topicId } = await topicService.createTopic({
                topicMemo: "integration: subscribe single",
            });

            // Give the mirror importer time to see the new topic before
            // opening the subscription — otherwise it responds NOT_FOUND
            // and the SDK falls into its 250ms→8s backoff loop.
            await wait(MIRROR_INGEST_MS);

            const received: SubscribedMessage[] = [];
            const streamErrors: Error[] = [];
            const handle = topicService.subscribeToMessages(
                {
                    topicId,
                    limit: 1,
                    maxAttempts: SUBSCRIBE_MAX_ATTEMPTS,
                    errorHandler: (_msg, err) => {
                        streamErrors.push(err);
                        console.error(
                            `[TopicMessageQuery] subscribe error: ${err.message}`,
                        );
                    },
                },
                (msg) => {
                    received.push(msg);
                },
            );

            // Let the gRPC stream establish before pushing traffic through
            // the consensus node.
            await wait(STREAM_ESTABLISH_MS);

            await topicService.submitMessage({
                topicId,
                message: "hello subscribers",
            });

            // Wait for the mirror to publish the submitted message on the
            // open stream.
            await waitForDelivery(
                () => received.length >= 1,
                () => `received ${received.length}/1`,
                streamErrors,
            );
            handle.unsubscribe();

            expect(received).toHaveLength(1);
            const msg = received[0];
            expect(msg.sequenceNumber).toBe("1");
            expect(msg.consensusTimestamp).toMatch(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
            );
            expect(Buffer.from(msg.contents).toString("utf8")).toBe(
                "hello subscribers",
            );
            expect(msg.runningHash.byteLength).toBeGreaterThan(0);
        },
    );

    it(
        "delivers multiple messages in consensus order up to the limit",
        { timeout: TEST_TIMEOUT_MS },
        async () => {
            const { topicId } = await topicService.createTopic({
                topicMemo: "integration: subscribe ordered",
            });

            await wait(MIRROR_INGEST_MS);

            const received: SubscribedMessage[] = [];
            const streamErrors: Error[] = [];
            const handle = topicService.subscribeToMessages(
                {
                    topicId,
                    limit: 3,
                    maxAttempts: SUBSCRIBE_MAX_ATTEMPTS,
                    errorHandler: (_msg, err) => {
                        streamErrors.push(err);
                        console.error(
                            `[TopicMessageQuery] subscribe error: ${err.message}`,
                        );
                    },
                },
                (msg) => {
                    received.push(msg);
                },
            );

            await wait(STREAM_ESTABLISH_MS);

            await topicService.submitMessage({ topicId, message: "alpha" });
            await topicService.submitMessage({ topicId, message: "beta" });
            await topicService.submitMessage({ topicId, message: "gamma" });

            await waitForDelivery(
                () => received.length >= 3,
                () =>
                    `received ${received.length}/3: [${received
                        .map((m) => Buffer.from(m.contents).toString("utf8"))
                        .join(", ")}]`,
                streamErrors,
            );
            handle.unsubscribe();

            const payloads = received.map((m) =>
                Buffer.from(m.contents).toString("utf8"),
            );
            expect(payloads).toEqual(["alpha", "beta", "gamma"]);
            expect(received.map((m) => m.sequenceNumber)).toEqual([
                "1",
                "2",
                "3",
            ]);
        },
    );

    it(
        "unsubscribe stops further deliveries",
        { timeout: TEST_TIMEOUT_MS },
        async () => {
            const { topicId } = await topicService.createTopic({
                topicMemo: "integration: subscribe unsubscribe",
            });

            await wait(MIRROR_INGEST_MS);

            const received: SubscribedMessage[] = [];
            const streamErrors: Error[] = [];
            const handle = topicService.subscribeToMessages(
                {
                    topicId,
                    maxAttempts: SUBSCRIBE_MAX_ATTEMPTS,
                    errorHandler: (_msg, err) => {
                        streamErrors.push(err);
                        console.error(
                            `[TopicMessageQuery] subscribe error: ${err.message}`,
                        );
                    },
                },
                (msg) => {
                    received.push(msg);
                },
            );

            await wait(STREAM_ESTABLISH_MS);

            await topicService.submitMessage({ topicId, message: "one" });
            await waitForDelivery(
                () => received.length >= 1,
                () => `received ${received.length}/1`,
                streamErrors,
            );

            expect(received).toHaveLength(1);

            // Stop the stream, then submit another message — it must NOT
            // reach the (now-disposed) listener even after a generous
            // delivery window elapses.
            handle.unsubscribe();
            await topicService.submitMessage({ topicId, message: "two" });
            await wait(NO_DELIVERY_WINDOW_MS);

            expect(received).toHaveLength(1);
        },
    );
});
