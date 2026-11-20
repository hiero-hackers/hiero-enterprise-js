/**
 * Create Topic — provision a Hiero Consensus Service (HCS) topic.
 *
 * Topics are append-only, timestamped, consensus-ordered message logs.
 * Every submitted message receives a consensus timestamp and a
 * monotonically increasing sequence number; messages fold into a running
 * hash for tamper detection. Common uses include audit trails, pub/sub
 * event buses, document anchoring, IoT data streams, and chat feeds.
 *
 * Demonstrates the three common topic shapes exposed by `TopicService`:
 *
 *  - Public + immutable — no admin key, no submit key. Anyone may
 *    submit messages; nobody may update or delete the topic.
 *  - Public + mutable — admin key only. Anyone may submit; the admin
 *    key holder may later update or delete.
 *  - Private + mutable — admin key plus submit key. Only submit-key
 *    holders may publish messages; admin holder controls the topic.
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/topic/create-topic.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    HieroContext,
    TopicService,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

/**
 * Simplest possible topic: public (no submit key) and immutable
 * (no admin key). Anyone may submit messages to it; nobody can update
 * or delete it after creation.
 *
 * Use this for audit logs, document anchoring, or any append-only feed
 * that should outlive the creator.
 */
async function createPublicTopic(topicService: TopicService) {
    console.log("=== Create public, immutable topic ===\n");

    const { topicId } = await topicService.createTopic({
        topicMemo: "public audit log",
    });

    console.log("Topic ID:", topicId);
    console.log("  - anyone may submit messages");
    console.log("  - topic cannot be updated or deleted");
    console.log();

    return topicId;
}

/**
 * Public but mutable topic: admin key is set, submit key is not.
 * Anyone may publish messages; only the admin-key holder may later
 * change properties (memo, keys) or delete the topic.
 *
 * Note: when an `adminKey` is supplied, an `autoRenewAccountId` is
 * required and that account must sign the transaction.
 */
async function createPublicMutableTopic(
    topicService: TopicService,
    context: HieroContext,
) {
    console.log("=== Create public, mutable topic ===\n");

    const adminKey = PrivateKey.generateED25519();

    const { topicId } = await topicService.createTopic({
        topicMemo: "public mutable feed",
        adminKey: adminKey.publicKey,
        autoRenewAccountId: context.operatorAccountId,
        additionalSigners: [adminKey],
    });

    console.log("Topic ID:", topicId);
    console.log("  - anyone may submit messages");
    console.log("  - admin-key holder may update / delete");
    console.log();

    return { topicId, adminKey };
}

/**
 * Private topic: both admin and submit keys are set. Only signers
 * holding the submit key may publish messages; the admin-key holder
 * controls the topic lifecycle.
 *
 * Use this for permissioned event buses, internal command channels,
 * or any feed where unauthorized writers must be rejected on submit.
 */
async function createPrivateTopic(
    topicService: TopicService,
    context: HieroContext,
) {
    console.log("=== Create private, mutable topic ===\n");

    const adminKey = PrivateKey.generateED25519();
    const submitKey = PrivateKey.generateED25519();

    const { topicId } = await topicService.createTopic({
        topicMemo: "permissioned feed",
        adminKey: adminKey.publicKey,
        submitKey: submitKey.publicKey,
        autoRenewAccountId: context.operatorAccountId,
        additionalSigners: [adminKey],
    });

    console.log("Topic ID:", topicId);
    console.log("  - only submit-key holders may publish messages");
    console.log("  - admin-key holder may update / delete");
    console.log();

    return { topicId, adminKey, submitKey };
}

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());
    const topicService = new TopicService(context);
    try {
        await createPublicTopic(topicService);
        await createPublicMutableTopic(topicService, context);
        await createPrivateTopic(topicService, context);
        console.log("All topic-create scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("create-topic sample failed:", error);
    process.exitCode = 1;
});
