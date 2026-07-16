import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { jsonResponse } from "../../utils/http.js";

/**
 * The spec-completion batch: the staking-rewards endpoint, HIP-1313 fee
 * estimation (protobuf POST), and the parameter pack — URL exactness for
 * every newly expressible filter.
 */
describe("MirrorNodeClient spec-completion", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls.at(-1)?.[0]);
    const init = () =>
        spy.mock.calls.at(-1)?.[1] as {
            method?: string;
            headers?: Record<string, string>;
            body?: unknown;
        };
    const mockJson = (body: unknown) => {
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(jsonResponse(body));
    };

    describe("staking rewards", () => {
        it("lists an account's reward payments and converts", async () => {
            mockJson({
                rewards: [
                    {
                        account_id: "0.0.1000",
                        amount: 10,
                        timestamp: "1234567890.000000001",
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryStakingRewards("0.0.1000", {
                timestamp: { gte: "1.0" },
                limit: 5,
                order: "desc",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.1000/rewards" +
                    "?timestamp=gte:1.0&limit=5&order=desc",
            );
            expect(page.data[0]).toEqual({
                accountId: "0.0.1000",
                amount: "10",
                timestamp: "1234567890.000000001",
            });
        });
    });

    describe("fee estimation (protobuf POST)", () => {
        it("POSTs raw bytes and converts the breakdown", async () => {
            mockJson({
                high_volume_multiplier: 1,
                network: { multiplier: 10, subtotal: 500 },
                node: {
                    base: 100,
                    extras: [
                        {
                            charged: 2,
                            count: 3,
                            fee_per_unit: 1,
                            included: 1,
                            name: "signatures",
                            subtotal: 2,
                        },
                    ],
                },
                service: { base: 400, extras: [] },
                total: 1000,
            });
            const bytes = new Uint8Array([0x0a, 0x0b, 0x0c]);
            const estimate = await client.queryFeeEstimate(bytes, {
                mode: "STATE",
                highVolumeThrottle: 5000,
            });
            expect(url()).toBe(
                "https://x/api/v1/network/fees?mode=STATE&high_volume_throttle=5000",
            );
            expect(init().method).toBe("POST");
            expect(init().headers).toEqual({
                "content-type": "application/protobuf",
            });
            expect(init().body).toBe(bytes);
            expect(estimate).toEqual({
                highVolumeMultiplier: 1,
                network: { multiplier: 10, subtotal: 500 },
                node: {
                    base: 100,
                    extras: [
                        {
                            charged: 2,
                            count: 3,
                            feePerUnit: 1,
                            included: 1,
                            name: "signatures",
                            subtotal: 2,
                        },
                    ],
                },
                service: { base: 400, extras: [] },
                total: 1000,
            });
        });

        it("rejects an estimate payload without a total", async () => {
            mockJson({ network: {} });
            await expect(
                client.queryFeeEstimate(new Uint8Array([1])),
            ).rejects.toThrow(/schema mismatch/);
        });
    });

    describe("error detail extraction", () => {
        it("surfaces the mirror node's diagnostic message on HTTP errors", async () => {
            spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(
                    JSON.stringify({
                        _status: {
                            messages: [
                                {
                                    message: "Invalid parameter: timestamp",
                                    detail: "out of range",
                                },
                            ],
                        },
                    }),
                    { status: 400, statusText: "Bad Request" },
                ),
            );
            await expect(client.queryBlocks()).rejects.toThrow(
                "Mirror node returned 400: Bad Request — " +
                    "Invalid parameter: timestamp (out of range)",
            );
        });

        it("falls back to the status line when the body is not JSON", async () => {
            spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response("<html>oops</html>", {
                    status: 404,
                    statusText: "Not Found",
                }),
            );
            await expect(client.queryBlock(1)).rejects.toThrow(
                /Mirror node returned 404: Not Found$/,
            );
        });
    });

    describe("parameter pack", () => {
        beforeEach(() => mockJson({ items: [], links: { next: null } }));

        it("accounts: discrete ID list as repeated params", async () => {
            await client.queryAccounts({
                accountId: ["0.0.98", "0.0.800"],
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts?account.id=0.0.98&account.id=0.0.800",
            );
        });

        it("balances: ID list plus the snapshot timestamp on the page", async () => {
            mockJson({
                timestamp: "1652531199.999999999",
                balances: [],
                links: { next: null },
            });
            const page = await client.queryBalances({
                accountId: ["0.0.98", "0.0.800"],
            });
            expect(url()).toBe(
                "https://x/api/v1/balances?account.id=0.0.98&account.id=0.0.800",
            );
            expect(page.timestamp).toBe("1652531199.999999999");
        });

        it("token holders: snapshot timestamp on the page", async () => {
            mockJson({
                timestamp: "2.5",
                balances: [],
                links: { next: null },
            });
            const page = await client.queryTokenBalances("0.0.456858");
            expect(page.timestamp).toBe("2.5");
        });

        it("non-snapshot pages carry no timestamp", async () => {
            mockJson({ blocks: [], links: { next: null } });
            const page = await client.queryBlocks();
            expect(page.timestamp).toBeUndefined();
        });

        it("accounts: id range + public key", async () => {
            await client.queryAccounts({
                accountId: { gte: "0.0.1000" },
                publicKey: "abcd",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts" +
                    "?account.id=gte:0.0.1000&account.publickey=abcd",
            );
        });

        it("account lookup: skip the embedded transaction list", async () => {
            mockJson({ account: "0.0.98" });
            await client.queryAccount("0.0.98", {
                includeTransactions: false,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98?transactions=false",
            );
        });

        it("account tokens: token.id filter", async () => {
            await client.queryAccountTokens("0.0.98", {
                tokenId: "0.0.456858",
                limit: 2,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98/tokens" +
                    "?token.id=0.0.456858&limit=2",
            );
        });

        it("account NFTs: serial range + spender", async () => {
            await client.queryNftsByAccount("0.0.98", {
                tokenId: "0.0.99",
                serialNumber: { gte: 5 },
                spenderId: "0.0.15",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98/nfts" +
                    "?token.id=0.0.99&serialnumber=gte:5&spender.id=0.0.15",
            );
        });

        it("account+token NFT lookup delegates with merged options", async () => {
            await client.queryNftsByAccountAndTokenId("0.0.98", "0.0.99", {
                serialNumber: 7,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.98/nfts" +
                    "?token.id=0.0.99&serialnumber=7",
            );
        });

        it("collection NFTs: owner + serial", async () => {
            await client.queryNftsByTokenId("0.0.99", {
                accountId: "0.0.98",
                serialNumber: { lte: 10 },
            });
            expect(url()).toBe(
                "https://x/api/v1/tokens/0.0.99/nfts" +
                    "?account.id=0.0.98&serialnumber=lte:10",
            );
        });

        it("token search: name, type, id range, public key", async () => {
            await client.queryTokens({
                name: "USD",
                type: "FUNGIBLE_COMMON",
                tokenId: { gt: "0.0.1" },
                publicKey: "abcd",
                limit: 5,
            });
            expect(url()).toBe(
                "https://x/api/v1/tokens" +
                    "?name=USD&publickey=abcd&token.id=gt:0.0.1" +
                    "&type=FUNGIBLE_COMMON&limit=5",
            );
        });

        it("single token: historical timestamp", async () => {
            mockJson({ token_id: "0.0.456858" });
            await client.queryTokenById("0.0.456858", { timestamp: "1.0" });
            expect(url()).toBe(
                "https://x/api/v1/tokens/0.0.456858?timestamp=1.0",
            );
        });

        it("token holders: historical snapshot + account filters", async () => {
            await client.queryTokenBalances("0.0.456858", {
                accountId: "0.0.98",
                publicKey: "abcd",
                timestamp: "1.0",
            });
            expect(url()).toBe(
                "https://x/api/v1/tokens/0.0.456858/balances" +
                    "?account.id=0.0.98&account.publickey=abcd&timestamp=1.0",
            );
        });

        it("transactions: result and direction filters", async () => {
            await client.queryTransactions({
                result: "fail",
                type: "debit",
                limit: 3,
            });
            expect(url()).toBe(
                "https://x/api/v1/transactions?result=fail&type=debit&limit=3",
            );
        });

        it("single transaction: nonce + scheduled", async () => {
            mockJson({
                transactions: [
                    {
                        transaction_id: "0.0.1-1-1",
                        name: "CRYPTOTRANSFER",
                        result: "SUCCESS",
                        consensus_timestamp: "1.0",
                        valid_start_timestamp: "1.0",
                        charged_tx_fee: 1,
                        transfers: [],
                        token_transfers: [],
                        nft_transfers: [],
                        staking_reward_transfers: [],
                    },
                ],
            });
            await client.queryTransaction("0.0.1-1-1", {
                nonce: 1,
                scheduled: true,
            });
            expect(url()).toBe(
                "https://x/api/v1/transactions/0.0.1-1-1?nonce=1&scheduled=true",
            );
        });

        it("topic messages: sequence window + timestamp", async () => {
            await client.queryTopicMessages("0.0.7", {
                sequenceNumber: { gte: 100, lt: 200 },
                timestamp: { gte: "1.0" },
                order: "asc",
            });
            expect(url()).toBe(
                "https://x/api/v1/topics/0.0.7/messages" +
                    "?sequencenumber=gte:100&sequencenumber=lt:200" +
                    "&timestamp=gte:1.0&order=asc",
            );
        });

        it("network nodes: node.id + file.id", async () => {
            await client.queryNetworkNodes({ nodeId: 3, fileId: "0.0.102" });
            expect(url()).toBe(
                "https://x/api/v1/network/nodes?node.id=3&file.id=0.0.102",
            );
        });

        it("exchange rate: historical timestamp", async () => {
            mockJson({ current_rate: {}, next_rate: {} });
            await client.queryExchangeRates({ timestamp: "1.0" });
            expect(url()).toBe(
                "https://x/api/v1/network/exchangerate?timestamp=1.0",
            );
        });

        it("fee schedule: order", async () => {
            mockJson({ fees: [], timestamp: "1.0" });
            await client.queryNetworkFees({ order: "asc" });
            expect(url()).toBe("https://x/api/v1/network/fees?order=asc");
        });
    });
});
