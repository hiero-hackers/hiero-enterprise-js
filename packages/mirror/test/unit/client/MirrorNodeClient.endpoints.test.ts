import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { convertNft } from "../../../src/utils/MirrorNodeConverters.js";
import { jsonResponse } from "../../utils/http.js";

/**
 * Coverage for the endpoint methods not exercised by the feature-focused
 * suites: NFT lookups, tokens-by-account, topic messages, network reads,
 * fetchNextPage, and the 429/5xx retry path.
 */
describe("MirrorNodeClient remaining endpoints", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls.at(-1)?.[0]);

    it("queries NFTs by token id, by serial, and by account+token", async () => {
        const nft = {
            token_id: "0.0.5",
            serial_number: 1,
            account_id: "0.0.9",
            metadata: "",
            deleted: false,
        };
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                jsonResponse({ nfts: [nft], links: { next: null } }),
            )
            .mockResolvedValueOnce(jsonResponse(nft))
            .mockResolvedValueOnce(
                jsonResponse({ nfts: [nft], links: { next: null } }),
            );

        const byToken = await client.queryNftsByTokenId("0.0.5", { limit: 2 });
        expect(byToken.data).toHaveLength(1);

        const bySerial = await client.queryNftsByTokenIdAndSerial("0.0.5", 1);
        expect(bySerial.serialNumber).toBe(1);

        const byBoth = await client.queryNftsByAccountAndTokenId(
            "0.0.9",
            "0.0.5",
        );
        expect(url()).toBe(
            "https://x/api/v1/accounts/0.0.9/nfts?token.id=0.0.5",
        );
        expect(byBoth.data[0].accountId).toBe("0.0.9");
    });

    it("queries tokens by account and topic messages by id + sequence", async () => {
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                jsonResponse({
                    tokens: [
                        {
                            token_id: "0.0.5",
                            name: "T",
                            symbol: "T",
                            type: "FUNGIBLE_COMMON",
                            decimals: "2",
                            total_supply: "1",
                            max_supply: "0",
                            treasury_account_id: "0.0.2",
                            deleted: false,
                        },
                    ],
                    links: { next: null },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    messages: [
                        {
                            topic_id: "0.0.7",
                            sequence_number: 1,
                            message: "",
                            running_hash: "",
                            consensus_timestamp: "1.0",
                        },
                    ],
                    links: { next: null },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    topic_id: "0.0.7",
                    sequence_number: 2,
                    message: "",
                    running_hash: "",
                    consensus_timestamp: "2.0",
                }),
            );

        const tokens = await client.queryTokensByAccountId("0.0.9", {
            limit: 5,
        });
        expect(tokens.data[0].decimals).toBe(2);

        const messages = await client.queryTopicMessages("0.0.7", {
            order: "desc",
        });
        expect(messages.data[0].sequenceNumber).toBe("1");

        const bySequence = await client.queryTopicMessageBySequence("0.0.7", 2);
        expect(bySequence.sequenceNumber).toBe("2");
        expect(url()).toBe("https://x/api/v1/topics/0.0.7/messages/2");
    });

    it("queries exchange rates and network stake", async () => {
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                jsonResponse({
                    current_rate: {
                        cent_equivalent: 12,
                        hbar_equivalent: 1,
                        expiration_time: 1,
                    },
                    next_rate: {
                        cent_equivalent: 13,
                        hbar_equivalent: 1,
                        expiration_time: 2,
                    },
                    timestamp: "1700000000.000000000",
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    max_stake_rewarded: 1,
                    max_staking_reward_rate_per_hbar: 2,
                    max_total_reward: 3,
                    node_reward_fee_fraction: 0,
                    reserved_staking_rewards: 0,
                    reward_balance_threshold: 0,
                    stake_total: 9,
                    staking_period: null,
                    staking_period_duration: 1440,
                    staking_periods_stored: 365,
                    unreserved_staking_reward_balance: 0,
                }),
            );

        const rates = await client.queryExchangeRates();
        expect(rates.nextRate.centEquivalent).toBe(13);
        expect(rates.timestamp).toBe("1700000000.000000000");

        const stake = await client.queryNetworkStake();
        expect(stake.stakingPeriod).toBeNull();
    });

    it("fetchNextPage follows a raw pagination link", async () => {
        spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                nfts: [
                    {
                        token_id: "0.0.5",
                        serial_number: 9,
                        account_id: "0.0.9",
                        metadata: "",
                        deleted: false,
                    },
                ],
                links: { next: null },
            }),
        );
        const page = await client.fetchNextPage(
            "/api/v1/accounts/0.0.9/nfts?page=2",
            convertNft as (raw: unknown) => ReturnType<typeof convertNft>,
        );
        expect(url()).toBe("https://x/api/v1/accounts/0.0.9/nfts?page=2");
        expect(page.data[0].serialNumber).toBe(9);
    });

    it("retries 429 (honouring Retry-After) and 5xx before succeeding", async () => {
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 429,
                    headers: { "retry-after": "0" },
                }),
            )
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(
                jsonResponse({
                    account: "0.0.1",
                    balance: { balance: 1, tokens: [] },
                }),
            );

        const info = await client.queryAccount("0.0.1");
        expect(info.balance).toBe(1);
        expect(spy).toHaveBeenCalledTimes(3);
    });

    it("gives up after maxRetries and surfaces the HTTP error", async () => {
        const impatient = new MirrorNodeClient("https://x", { maxRetries: 1 });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(null, { status: 503, statusText: "Unavailable" }),
        );
        await expect(impatient.queryAccount("0.0.1")).rejects.toThrow(
            /Mirror node returned 503/,
        );
    });
});

describe("MirrorNodeClient edge branches", () => {
    afterEach(() => vi.restoreAllMocks());

    it("strips trailing slashes from the base URL", async () => {
        const client = new MirrorNodeClient("https://x///");
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                account: "0.0.1",
                balance: { balance: 1, tokens: [] },
            }),
        );
        await client.queryAccount("0.0.1");
        expect(String(spy.mock.calls[0][0])).toBe(
            "https://x/api/v1/accounts/0.0.1",
        );
    });

    it("honours an HTTP-date Retry-After and tolerates a garbage one", async () => {
        const client = new MirrorNodeClient("https://x");
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 429,
                    headers: {
                        "retry-after": new Date(Date.now() + 5).toUTCString(),
                    },
                }),
            )
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 429,
                    headers: { "retry-after": "not-a-date" },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    account: "0.0.1",
                    balance: { balance: 1, tokens: [] },
                }),
            );
        const info = await client.queryAccount("0.0.1");
        expect(info.accountId).toBe("0.0.1");
    });

    it("queryTransaction rejects when the transactions array is missing or empty", async () => {
        const client = new MirrorNodeClient("https://x");
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({ transactions: [] }),
        );
        await expect(client.queryTransaction("0.0.1-1-1")).rejects.toThrow(
            /Transaction not found/,
        );
    });
});
