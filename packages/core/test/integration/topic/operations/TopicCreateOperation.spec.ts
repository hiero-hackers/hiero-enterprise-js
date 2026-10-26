import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey, TopicInfoQuery, type Client } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { TopicService } from "../../../../src/services/index.js";

describe("TopicCreateOperation", () => {
    let client: Client;
    let topicService: TopicService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        topicService = new TopicService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    it("creates a public, immutable topic with a memo", async () => {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: public topic",
        });

        expect(topicId.toString()).toMatch(/^0\.0\.\d+$/);

        // Query consensus directly — no mirror-node propagation lag.
        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);

        expect(info.topicId.toString()).toBe(topicId.toString());
        expect(info.topicMemo).toBe("integration: public topic");
        // No admin key was supplied — topic is immutable.
        expect(info.adminKey).toBeNull();
        // No submit key — topic is public.
        expect(info.submitKey).toBeNull();
    });

    it("creates a mutable, private topic with admin + submit keys", async () => {
        const adminKey = PrivateKey.generateED25519();
        const submitKey = PrivateKey.generateED25519();

        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: private topic",
            adminKey: adminKey.publicKey,
            submitKey: submitKey.publicKey,
            autoRenewAccountId: operatorId,
            additionalSigners: [adminKey],
        });

        expect(topicId.toString()).toMatch(/^0\.0\.\d+$/);

        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);

        expect(info.topicId.toString()).toBe(topicId.toString());
        expect(info.topicMemo).toBe("integration: private topic");
        expect(info.adminKey).not.toBeNull();
        expect(info.submitKey).not.toBeNull();
        expect(info.autoRenewAccountId?.toString()).toBe(operatorId);
    });
});
