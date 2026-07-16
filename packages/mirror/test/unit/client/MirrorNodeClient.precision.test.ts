import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";

/**
 * #136 — value fidelity through the whole client pipeline, from raw wire
 * text to public objects.
 *
 * These tests MUST feed the client raw `Response` bodies (never objects that
 * went through `JSON.parse` in the test itself): the bug under test is that
 * `JSON.parse` rounds integers past 2^53 before any converter runs, so a
 * fixture built from a parsed object can never detect it. The sentinel
 * values are real top-10 mainnet balances from the issue, chosen because
 * they are NOT representable as IEEE-754 doubles.
 */
describe("MirrorNodeClient precision (#136)", () => {
    let client: MirrorNodeClient;

    beforeEach(() => {
        client = new MirrorNodeClient("https://testnet.mirrornode.hedera.com");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // A fresh Response per call — a body is single-read, and some tests
    // issue two requests against the same wire text.
    const respond = (rawText: string) =>
        vi.spyOn(globalThis, "fetch").mockImplementation(() =>
            Promise.resolve(
                new Response(rawText, {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        );

    it("preserves an account balance above 2^53 exactly", async () => {
        respond(
            '{"account":"0.0.10620677","balance":{"timestamp":"1700000000.000000000",' +
                '"balance":31869085891081369,"tokens":[' +
                '{"token_id":"0.0.7","balance":75429753064560425,"decimals":8}]},' +
                '"deleted":false}',
        );

        const info = await client.queryAccount("0.0.10620677");
        expect(info.balance).toBe("31869085891081369");
        expect(info.tokenBalances?.[0].balance).toBe("75429753064560425");

        const balance = await client.queryAccountBalance("0.0.10620677");
        expect(balance.hbars).toBe("31869085891081369");
        expect(balance.tokens[0].balance).toBe("75429753064560425");
    });

    it("preserves transfer legs above 2^53, including the negative debit", async () => {
        respond(
            '{"transactions":[{"transaction_id":"0.0.2@1700000000.000000000",' +
                '"name":"CRYPTOTRANSFER","result":"SUCCESS",' +
                '"consensus_timestamp":"1700000001.000000000",' +
                '"valid_start_timestamp":"1700000000.000000000",' +
                '"charged_tx_fee":184622,' +
                '"transfers":[{"account":"0.0.2","amount":-28912437152291031,"is_approval":false},' +
                '{"account":"0.0.98","amount":28912437152291031,"is_approval":false}],' +
                '"token_transfers":[],"nft_transfers":[],"staking_reward_transfers":[]}]}',
        );

        const tx = await client.queryTransaction("0.0.2@1700000000.000000000");
        expect(tx.transfers[0].amount).toBe("-28912437152291031");
        expect(tx.transfers[1].amount).toBe("28912437152291031");
    });

    it("keeps small values exactly as before", async () => {
        respond(
            '{"account":"0.0.98","balance":{"timestamp":null,"balance":424242,' +
                '"tokens":[]},"deleted":false}',
        );

        const info = await client.queryAccount("0.0.98");
        expect(info.balance).toBe("424242");
    });
});
