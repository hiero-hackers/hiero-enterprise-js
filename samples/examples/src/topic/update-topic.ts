/**
 * Update Topic — modify the properties of an existing HCS topic.
 *
 * Topics created with an `adminKey` are mutable: the admin-key holder
 * may rename them, rotate their keys, change auto-renew settings, or
 * extend their expiration. Topics created without an admin key are
 * immutable — only `expirationTime` may be extended (by anyone).
 *
 * Demonstrates the three-state field convention used by `updateTopic`:
 *
 *  - omitted (undefined) — leave the field unchanged
 *  - `null`              — clear the field on the network
 *  - a value             — replace the existing value
 *
 * Run: pnpm tsx src/topic/update-topic.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { HieroContext, TopicService } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Provision a fresh mutable topic to operate on. Each scenario uses its
 * own short-lived topic so they don't interfere with each other.
 */
async function createMutableTopic(
    topicService: TopicService,
    context: HieroContext,
    topicMemo: string,
) {
    const adminKey = PrivateKey.generateED25519();
    const { topicId } = await topicService.createTopic({
        topicMemo,
        adminKey: adminKey.publicKey,
        autoRenewAccountId: context.operatorAccountId,
        additionalSigners: [adminKey],
    });
    return { topicId, adminKey };
}

/**
 * Step 1: rename a topic by replacing its memo.
 *
 * The admin key from the original `createTopic` call must sign the
 * update — pass it via `additionalSigners`.
 */
async function renameTopic(topicService: TopicService, context: HieroContext) {
    console.log("=== Rename topic memo ===\n");

    const { topicId, adminKey } = await createMutableTopic(
        topicService,
        context,
        "original memo",
    );

    await topicService.updateTopic({
        topicId,
        topicMemo: "renamed feed",
        additionalSigners: [adminKey],
    });

    console.log("Topic ID:", topicId);
    console.log("  - memo changed: 'original memo' → 'renamed feed'");
    console.log();
}

/**
 * Step 2: clear the submit key on a private topic, making it public.
 *
 * Passing `submitKey: null` invokes the SDK's `clearSubmitKey()` —
 * passing `undefined` (or omitting the field) would leave the existing
 * key in place.
 */
async function makeTopicPublic(
    topicService: TopicService,
    context: HieroContext,
) {
    console.log("=== Clear submit key (make topic public) ===\n");

    // Provision a private topic first.
    const adminKey = PrivateKey.generateED25519();
    const submitKey = PrivateKey.generateED25519();
    const { topicId } = await topicService.createTopic({
        topicMemo: "private feed",
        adminKey: adminKey.publicKey,
        submitKey: submitKey.publicKey,
        autoRenewAccountId: context.operatorAccountId,
        additionalSigners: [adminKey],
    });

    // Clear the submit key — null sentinel triggers clearSubmitKey().
    await topicService.updateTopic({
        topicId,
        submitKey: null,
        additionalSigners: [adminKey],
    });

    console.log("Topic ID:", topicId);
    console.log("  - submit key cleared — anyone may now publish messages");
    console.log();
}

/**
 * Step 3: rotate the admin key — both the OLD and NEW admin keys must
 * sign the transaction. Pass both via `additionalSigners`.
 *
 * After the rotation, only the new admin key is required for
 * subsequent updates.
 */
async function rotateAdminKey(
    topicService: TopicService,
    context: HieroContext,
) {
    console.log("=== Rotate admin key ===\n");

    const { topicId, adminKey: oldAdminKey } = await createMutableTopic(
        topicService,
        context,
        "key rotation demo",
    );
    const newAdminKey = PrivateKey.generateED25519();

    // Both the old AND new admin keys must sign an admin-key rotation.
    await topicService.updateTopic({
        topicId,
        adminKey: newAdminKey.publicKey,
        additionalSigners: [oldAdminKey, newAdminKey],
    });

    console.log("Topic ID:", topicId);
    console.log("  - admin key rotated");

    // Subsequent updates only need the new admin key.
    await topicService.updateTopic({
        topicId,
        topicMemo: "rotated successfully",
        additionalSigners: [newAdminKey],
    });

    console.log("  - subsequent update signed by new admin key only");
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const topicService = new TopicService(context);
    try {
        await renameTopic(topicService, context);
        await makeTopicPublic(topicService, context);
        await rotateAdminKey(topicService, context);
        console.log("All topic-update scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("update-topic sample failed:", error);
    process.exitCode = 1;
});
