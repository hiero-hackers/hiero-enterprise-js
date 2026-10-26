import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PrivateKey, TopicInfoQuery, type Client } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { TopicService } from "../../../../src/services/index.js";

/**
 * Integration tests for `TopicUpdateOperation`.
 *
 * Each test creates a fresh mutable topic so updates run in isolation —
 * no shared fixture, no cross-test contamination. Topic state is verified
 * via `TopicInfoQuery` against the consensus node (zero mirror-node lag).
 */
describe("TopicUpdateOperation", () => {
    let client: Client;
    let topicService: TopicService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        topicService = new TopicService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    /** Spin up a fresh mutable topic owned by `adminKey`. */
    async function createMutableTopic(
        adminKey: PrivateKey,
        topicMemo = "integration: pre-update",
    ): Promise<string> {
        const { topicId } = await topicService.createTopic({
            topicMemo,
            adminKey: adminKey.publicKey,
            autoRenewAccountId: operatorId,
            additionalSigners: [adminKey],
        });
        return topicId.toString();
    }

    let adminKey: PrivateKey;
    let topicId: string;

    beforeEach(async () => {
        adminKey = PrivateKey.generateED25519();
        topicId = await createMutableTopic(adminKey);
    });

    it("updates the topic memo", async () => {
        await topicService.updateTopic({
            topicId,
            topicMemo: "integration: updated memo",
            additionalSigners: [adminKey],
        });

        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);
        expect(info.topicMemo).toBe("integration: updated memo");
    });

    it("adds a submitKey to a previously-public topic", async () => {
        const submitKey = PrivateKey.generateED25519();

        await topicService.updateTopic({
            topicId,
            submitKey: submitKey.publicKey,
            additionalSigners: [adminKey],
        });

        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);
        expect(info.submitKey).not.toBeNull();
    });

    it("clears the submit key (null sentinel) to make the topic public again", async () => {
        // Add a submit key first.
        const submitKey = PrivateKey.generateED25519();
        await topicService.updateTopic({
            topicId,
            submitKey: submitKey.publicKey,
            additionalSigners: [adminKey],
        });

        // Now clear it.
        await topicService.updateTopic({
            topicId,
            submitKey: null,
            additionalSigners: [adminKey],
        });

        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);
        expect(info.submitKey).toBeNull();
    });

    it("rotates the admin key (both old and new keys sign)", async () => {
        const newAdminKey = PrivateKey.generateED25519();

        await topicService.updateTopic({
            topicId,
            adminKey: newAdminKey.publicKey,
            additionalSigners: [adminKey, newAdminKey],
        });

        const info = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);
        expect(info.adminKey).not.toBeNull();

        // The new admin key alone now suffices for subsequent updates.
        await topicService.updateTopic({
            topicId,
            topicMemo: "after rotation",
            additionalSigners: [newAdminKey],
        });

        const updated = await new TopicInfoQuery()
            .setTopicId(topicId)
            .execute(client);
        expect(updated.topicMemo).toBe("after rotation");
    });
});
