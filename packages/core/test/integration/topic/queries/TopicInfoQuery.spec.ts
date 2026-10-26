import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { TopicService } from "../../../../src/services/index.js";

describe("TopicInfoQuery", () => {
    let topicService: TopicService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        topicService = new TopicService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    it("returns plain-object info for a freshly created public topic", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: info plain",
        });

        const info = await topicService.getTopicInfo(topicId);

        // All scalars are plain-JS, not SDK primitives.
        expect(info.topicId).toBe(topicId.toString());
        expect(info.topicMemo).toBe("integration: info plain");
        expect(typeof info.sequenceNumber).toBe("string");
        expect(info.sequenceNumber).toBe("0");
        expect(info.runningHash).toBeInstanceOf(Uint8Array);
        // Public, immutable topic — keys are null.
        expect(info.adminKey).toBeNull();
        expect(info.submitKey).toBeNull();
        expect(info.feeScheduleKey).toBeNull();
    });

    it("projects expirationTime to an ISO-8601 string and autoRenewPeriod to seconds", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: info expiration",
        });

        const info = await topicService.getTopicInfo(topicId);

        expect(info.expirationTime).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
        // Default auto-renew period is 90 days = 7_776_000 seconds.
        expect(info.autoRenewPeriod).toBe(7_776_000);
    });

    it("reflects the latest sequenceNumber after messages are submitted", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: info sequence",
        });

        await topicService.submitMessage({ topicId, message: "first" });
        await topicService.submitMessage({ topicId, message: "second" });
        await topicService.submitMessage({ topicId, message: "third" });

        const info = await topicService.getTopicInfo(topicId);
        expect(info.sequenceNumber).toBe("3");
    });

    it("exposes adminKey + autoRenewAccountId for a mutable topic", async () => {
        const adminKey = PrivateKey.generateED25519();

        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: info mutable",
            adminKey: adminKey.publicKey,
            autoRenewAccountId: operatorId,
            additionalSigners: [adminKey],
        });

        const info = await topicService.getTopicInfo(topicId);

        expect(info.adminKey).not.toBeNull();
        expect(info.autoRenewAccountId).toBe(operatorId);
    });

    it("throws when the topic does not exist", async () => {
        await expect(
            topicService.getTopicInfo("0.0.999999999"),
        ).rejects.toThrow();
    });
});
