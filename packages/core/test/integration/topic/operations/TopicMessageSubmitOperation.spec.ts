import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { TopicService } from "../../../../src/services/index.js";

describe("TopicMessageSubmitOperation", () => {
    let topicService: TopicService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        topicService = new TopicService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    it("submits a string message to a public topic and returns sequence/hash", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: submit string",
        });

        const result = await topicService.submitMessage({
            topicId,
            message: "hello from integration test",
        });

        expect(result.sequenceNumber).toBe(1);
        expect(result.runningHash!.byteLength).toBeGreaterThan(0);
        expect(result.transactionId).toMatch(/^0\.0\.\d+@\d+\.\d+$/);
    });

    it("submits a Uint8Array (raw bytes) message", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: submit bytes",
        });

        const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        const result = await topicService.submitMessage({
            topicId,
            message: payload,
        });

        expect(result.sequenceNumber).toBe(1);
        expect(result.runningHash!.byteLength).toBeGreaterThan(0);
    });

    it("requires the submitKey to sign for a private topic", async () => {
        const submitKey = PrivateKey.generateED25519();
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: private topic",
            submitKey: submitKey.publicKey,
            autoRenewAccountId: operatorId,
        });

        // Without the submitKey signing, the network rejects the submission.
        await expect(
            topicService.submitMessage({
                topicId,
                message: "should fail without submitKey",
            }),
        ).rejects.toThrow();

        // With the submitKey via additionalSigners, the submission succeeds.
        const result = await topicService.submitMessage({
            topicId,
            message: "authorised submission",
            additionalSigners: [submitKey],
        });

        expect(result.sequenceNumber).toBe(1);
    });

    it("auto-chunks a large multi-chunk message and returns the first chunk's metadata", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: multi-chunk",
        });

        // Build a payload comfortably larger than the 1024-byte default chunk
        // size to force the SDK to submit multiple chunks under one call.
        const largeMessage = "x".repeat(5_000);

        const result = await topicService.submitMessage({
            topicId,
            message: largeMessage,
        });

        // The receipt corresponds to the first chunk, so sequenceNumber === 1.
        expect(result.sequenceNumber).toBe(1);
        expect(result.runningHash!.byteLength).toBeGreaterThan(0);
    });

    it("rejects submission to a non-existent topic", async () => {
        await expect(
            topicService.submitMessage({
                topicId: "0.0.999999999",
                message: "no such topic",
            }),
        ).rejects.toThrow();
    });
});
