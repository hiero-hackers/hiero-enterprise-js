// SPDX-License-Identifier: Apache-2.0
// ESM consumer: copied into a throwaway "type": "module" project that has
// the packed tarballs installed, then run there. See run.mjs.
import { HieroContext, TopicService } from "@hiero-hackers/enterprise-core";
import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountRepository,
    MirrorNodeClient,
} from "@hiero-hackers/enterprise-mirror";

const label = `ESM on Node ${process.versions.node}`;

async function core() {
    // Offline: generate a key (needs Web Crypto) and build a context.
    const offline = new HieroContext({
        network: "testnet",
        operatorId: "0.0.2",
        operatorKey: PrivateKey.generateED25519().toStringDer(),
        operatorKeyType: "der",
    });
    offline.close();
    console.log(`[${label}] core: HieroContext built`);

    if (!process.env.HIERO_OPERATOR_ID) {
        if (process.env.PACKED_REQUIRE_NETWORK) {
            throw new Error("HIERO_OPERATOR_ID is not set");
        }

        console.log(`[${label}] core: no HIERO_OPERATOR_ID, nothing sent`);

        return;
    }

    const context = new HieroContext();
    try {
        const topics = new TopicService(context);
        const { topicId } = await topics.createTopic({ topicMemo: label });
        const { sequenceNumber } = await topics.submitMessage({
            topicId: topicId.toString(),
            message: `hello from ${label}`,
        });
        console.log(
            `[${label}] core: message ${sequenceNumber} on topic ${topicId}`,
        );
    } finally {
        context.close();
    }
}

async function mirror() {
    const url =
        process.env.HIERO_MIRROR_NODE_URL ??
        "https://mainnet.mirrornode.hedera.com";
    const accounts = new AccountRepository(new MirrorNodeClient(url));
    const account = await accounts.findAccount("0.0.2");

    if (account.accountId !== "0.0.2") {
        throw new Error(`Expected account 0.0.2, got ${account.accountId}`);
    }

    console.log(`[${label}] mirror: account ${account.accountId} on ${url}`);
}

await core();
await mirror();
