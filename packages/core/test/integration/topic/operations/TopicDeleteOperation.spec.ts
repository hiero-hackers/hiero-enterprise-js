import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey, TopicInfoQuery, type Client } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { TopicService } from "../../../../src/services/index.js";

describe("TopicDeleteOperation", () => {
    let client: Client;
    let topicService: TopicService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        topicService = new TopicService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    async function createMutableTopic(adminKey: PrivateKey): Promise<string> {
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: pre-delete",
            adminKey: adminKey.publicKey,
            autoRenewAccountId: operatorId,
            additionalSigners: [adminKey],
        });
        return topicId.toString();
    }

    it("deletes a topic signed by the admin key", async () => {
        const adminKey = PrivateKey.generateED25519();
        const topicId = await createMutableTopic(adminKey);

        await topicService.deleteTopic({
            topicId,
            additionalSigners: [adminKey],
        });

        // After deletion, info queries against the topic fail.
        await expect(
            new TopicInfoQuery().setTopicId(topicId).execute(client),
        ).rejects.toThrow();
    });

    it("rejects deletion of a topic with no admin key (UNAUTHORIZED)", async () => {
        // Public, immutable topic — no admin key.
        const { topicId } = await topicService.createTopic({
            topicMemo: "integration: immutable",
        });

        await expect(topicService.deleteTopic({ topicId })).rejects.toThrow(
            /UNAUTHORIZED|Unauthorized/,
        );

        // Topic still exists.
        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);
        expect(info.topicMemo).toBe("integration: immutable");
    });

    it("rejects deletion of a non-existent topic", async () => {
        await expect(
            topicService.deleteTopic({ topicId: "0.0.999999999" }),
        ).rejects.toThrow();
    });
});
