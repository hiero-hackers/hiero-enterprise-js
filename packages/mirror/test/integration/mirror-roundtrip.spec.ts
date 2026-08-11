import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    HieroContext,
    TokenService,
    TopicService,
} from "@hiero-hackers/enterprise-core";
import { MirrorNodeClient } from "../../src/client/MirrorNodeClient.js";
import { createMirrorRepositories } from "../../src/repositories/factory.js";
import type { MirrorRepositories } from "../../src/repositories/factory.js";

/**
 * True end-to-end round-trips against a real network + mirror node
 * (CI runs these on Solo): core writes an entity, the mirror repositories
 * read it back. This is the layer that catches mirror node response-shape
 * drift — when the Solo action pins a newer mirror node, these tests run
 * against its real responses.
 *
 * Requires operator credentials + HIERO_MIRROR_NODE_URL in the
 * environment; skipped entirely otherwise (e.g. local runs).
 */

const operatorId = process.env["HIERO_OPERATOR_ID"];
const mirrorUrl = process.env["HIERO_MIRROR_NODE_URL"];
const hasEnvironment = Boolean(
    operatorId && process.env["HIERO_OPERATOR_KEY"] && mirrorUrl,
);

/** Poll until `read` stops throwing — mirror ingestion takes seconds. */
async function eventually<T>(
    read: () => Promise<T>,
    label: string,
    timeoutMs = 90_000,
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            return await read();
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
    }
    throw new Error(`${label} not visible on mirror after ${timeoutMs}ms`, {
        cause: lastError,
    });
}

describe.skipIf(!hasEnvironment)("mirror round-trips [Integration]", () => {
    let context: HieroContext;
    let repositories: MirrorRepositories;

    beforeAll(() => {
        context = new HieroContext();
        repositories = createMirrorRepositories(
            new MirrorNodeClient(mirrorUrl as string),
        );
    });

    afterAll(() => context?.close());

    it("reads the operator account the network already knows", async () => {
        const account = await eventually(
            () =>
                repositories.accountRepository.findByAccountId(
                    operatorId as string,
                ),
            `account ${operatorId}`,
        );
        expect(account.accountId).toBe(operatorId);
        // `balance` is a decimal string (#136) — compare as BigInt, which is
        // exact at any magnitude.
        expect(BigInt(account.balance)).toBeGreaterThan(0n);
    });

    it("round-trips a topic: create + submit → messages", async () => {
        const topicService = new TopicService(context);
        const { topicId } = await topicService.createTopic({
            topicMemo: `mirror-roundtrip ${Date.now()}`,
        });
        await topicService.submitMessage({
            topicId,
            message: "hello from the integration suite",
        });

        // Scope: Solo's mirror node serves topic *messages* but not the
        // topic-info endpoint (`/topics/{id}`) or the message point-lookups
        // (`/topics/{id}/messages/{seq}`, `/topics/messages/{timestamp}`) —
        // those return 404 on Solo. Their response shapes are validated
        // against a full mirror by the mainnet example tours + the weekly
        // smoke workflow; here we round-trip the message-list read.
        const messages = await eventually(async () => {
            const page = await repositories.topicRepository.findByTopicId(
                topicId.toString(),
                { limit: 5 },
            );
            if (page.data.length === 0) throw new Error("no messages yet");
            return page;
        }, `messages on ${topicId}`);
        const first = messages.data[0];
        expect(first.topicId).toBe(topicId.toString());
        expect(Buffer.from(first.message, "base64").toString("utf8")).toContain(
            "hello from the integration suite",
        );
    });

    it("round-trips a token: create → metadata, name search, holders", async () => {
        const tokenService = new TokenService(context);
        const name = `Roundtrip${Date.now()}`;
        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: name,
            tokenSymbol: "RTT",
            decimals: 2,
            initialSupply: 100_000,
            treasuryAccountId: operatorId as string,
        });

        const token = await eventually(
            () => repositories.tokenRepository.findById(tokenId.toString()),
            `token ${tokenId}`,
        );
        expect(token.name).toBe(name);
        expect(token.symbol).toBe("RTT");
        expect(token.decimals).toBe(2);

        // Partial-name search finds it.
        const search = await eventually(async () => {
            const page = await repositories.tokenRepository.list({
                name,
                limit: 5,
            });
            if (page.data.length === 0) throw new Error("not indexed yet");
            return page;
        }, `token search "${name}"`);
        expect(search.data.map((entry) => entry.tokenId)).toContain(
            tokenId.toString(),
        );

        // The treasury shows up as a holder with the full supply.
        const holders = await eventually(async () => {
            const page = await repositories.tokenRepository.findHolders(
                tokenId.toString(),
                { limit: 5 },
            );
            if (page.data.length === 0) throw new Error("no holders yet");
            return page;
        }, `holders of ${tokenId}`);
        expect(holders.data[0].accountId).toBe(operatorId);
        expect(holders.data[0].balance).toBe("100000");
    });

    it("sees the operator's transactions with filters applied", async () => {
        const transactions = await eventually(async () => {
            const page = await repositories.transactionRepository.findByAccount(
                operatorId as string,
                { limit: 10, order: "desc", result: "success" },
            );
            if (page.data.length === 0) throw new Error("no transactions yet");
            return page;
        }, `transactions for ${operatorId}`);
        for (const transaction of transactions.data) {
            expect(transaction.successful).toBe(true);
        }
    });

    it("paginates a high-volume topic through the rate limiter", async () => {
        const topicService = new TopicService(context);
        const { topicId } = await topicService.createTopic({
            topicMemo: `volume ${Date.now()}`,
        });
        const MESSAGES = 25;
        // Fire sequentially to keep sequence numbers deterministic.
        for (let i = 1; i <= MESSAGES; i++) {
            await topicService.submitMessage({
                topicId,
                message: `message ${i}`,
            });
        }

        // Wait until the mirror has ingested everything, then drain it
        // page by page (limit 5 → 5 pages) through the rate limiter.
        const gated = createMirrorRepositories(
            new MirrorNodeClient(mirrorUrl as string, {
                maxConcurrent: 2,
                maxRequestsPerSecond: 10,
            }),
        );
        const all = await eventually(async () => {
            const { collectAll } =
                await import("../../src/utils/Pagination.js");
            const drained = await collectAll(
                await gated.topicRepository.findByTopicId(topicId.toString(), {
                    limit: 5,
                    order: "asc",
                }),
            );
            if (drained.length < MESSAGES)
                throw new Error(`only ${drained.length}/${MESSAGES} ingested`);
            return drained;
        }, `all ${MESSAGES} messages on ${topicId}`);

        expect(all).toHaveLength(MESSAGES);
        // Order and continuity: sequence numbers 1..N exactly once.
        expect(all.map((message) => Number(message.sequenceNumber))).toEqual(
            Array.from({ length: MESSAGES }, (_, i) => i + 1),
        );

        // Sequence-window filter agrees with the drained view.
        const window = await gated.topicRepository.findByTopicId(
            topicId.toString(),
            {
                sequenceNumber: { gte: 10, lte: 14 },
                order: "asc",
            },
        );
        expect(window.data.map((m) => Number(m.sequenceNumber))).toEqual([
            10, 11, 12, 13, 14,
        ]);
    });

    // Network-wide read-only endpoints (`/network/supply`, `/balances`) are
    // not write→read round-trips and are not served by Solo's mirror node
    // (single-node local network); their shapes are covered by the unit
    // tests and the mainnet example tours + weekly smoke workflow.
});
