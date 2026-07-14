import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { jsonResponse } from "../../utils/http.js";

/**
 * The "parity pack": balances snapshot, airdrops, allowances, schedules,
 * topic info, network fees, and NFT provenance — URL exactness plus
 * response conversion for each.
 */
describe("MirrorNodeClient parity endpoints", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls.at(-1)?.[0]);
    const mockJson = (body: unknown) => {
        spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(jsonResponse(body));
    };

    describe("balances snapshot", () => {
        it("builds a historical threshold query and converts entries", async () => {
            mockJson({
                timestamp: "1652531199.999999999",
                balances: [
                    {
                        account: "0.0.2",
                        balance: 4_999_999,
                        tokens: [{ token_id: "0.0.5", balance: 7 }],
                    },
                    { account: "0.0.3", balance: 100 },
                ],
                links: { next: null },
            });
            const page = await client.queryBalances({
                balance: { gte: 100 },
                timestamp: "1652531199.999999999",
                limit: 100,
                order: "desc",
            });
            expect(url()).toBe(
                "https://x/api/v1/balances" +
                    "?account.balance=gte:100" +
                    "&timestamp=1652531199.999999999" +
                    "&limit=100&order=desc",
            );
            expect(page.data).toEqual([
                {
                    accountId: "0.0.2",
                    balance: 4_999_999,
                    tokens: [{ tokenId: "0.0.5", balance: 7 }],
                },
                { accountId: "0.0.3", balance: 100, tokens: [] },
            ]);
        });
    });

    describe("airdrops", () => {
        const airdrop = {
            amount: 10,
            receiver_id: "0.0.15",
            sender_id: "0.0.10",
            serial_number: null,
            timestamp: { from: "1.0", to: null },
            token_id: "0.0.99",
        };

        it("pending: filters by sender/token and converts", async () => {
            mockJson({ airdrops: [airdrop], links: { next: null } });
            const page = await client.queryPendingAirdrops("0.0.15", {
                senderId: "0.0.10",
                tokenId: "0.0.99",
                limit: 5,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.15/airdrops/pending" +
                    "?sender.id=0.0.10&token.id=0.0.99&limit=5",
            );
            expect(page.data[0]).toEqual({
                amount: 10,
                receiverId: "0.0.15",
                senderId: "0.0.10",
                serialNumber: null,
                tokenId: "0.0.99",
                timestamp: { from: "1.0", to: null },
            });
        });

        it("outstanding: filters by receiver and serial", async () => {
            mockJson({ airdrops: [], links: { next: null } });
            await client.queryOutstandingAirdrops("0.0.10", {
                receiverId: "0.0.15",
                serialNumber: 3,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.10/airdrops/outstanding" +
                    "?receiver.id=0.0.15&serialnumber=3",
            );
        });
    });

    describe("allowances", () => {
        it("crypto: filters by spender and converts", async () => {
            mockJson({
                allowances: [
                    {
                        amount: 75,
                        amount_granted: 100,
                        owner: "0.0.11",
                        spender: "0.0.15",
                        timestamp: { from: "1.0", to: null },
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryCryptoAllowances("0.0.11", {
                spenderId: "0.0.15",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.11/allowances/crypto?spender.id=0.0.15",
            );
            expect(page.data[0]).toEqual({
                amount: 75,
                amountGranted: 100,
                owner: "0.0.11",
                spender: "0.0.15",
                timestamp: { from: "1.0", to: null },
            });
        });

        it("tokens: adds token filter and tokenId field", async () => {
            mockJson({
                allowances: [
                    {
                        amount: 5,
                        amount_granted: 5,
                        owner: "0.0.11",
                        spender: "0.0.15",
                        timestamp: { from: "1.0", to: null },
                        token_id: "0.0.99",
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryTokenAllowances("0.0.11", {
                tokenId: "0.0.99",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.11/allowances/tokens?token.id=0.0.99",
            );
            expect(page.data[0].tokenId).toBe("0.0.99");
        });

        it("nfts: passes the boolean owner switch and converts", async () => {
            mockJson({
                allowances: [
                    {
                        approved_for_all: true,
                        owner: "0.0.11",
                        spender: "0.0.15",
                        timestamp: { from: "1.0", to: null },
                        token_id: "0.0.99",
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryNftAllowances("0.0.11", {
                owner: false,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts/0.0.11/allowances/nfts?owner=false",
            );
            expect(page.data[0].approvedForAll).toBe(true);
        });
    });

    describe("schedules", () => {
        const rawSchedule = {
            admin_key: { key: "adminkey" },
            consensus_timestamp: "1.0",
            creator_account_id: "0.0.11",
            deleted: false,
            executed_timestamp: null,
            expiration_time: "2.0",
            memo: "m",
            payer_account_id: "0.0.12",
            schedule_id: "0.0.777",
            signatures: [
                {
                    consensus_timestamp: "1.5",
                    public_key_prefix: "cHJl",
                    signature: "c2ln",
                    type: "ED25519",
                },
            ],
            transaction_body: "Kd6tvu8=",
            wait_for_expiry: true,
        };

        it("lists with creator/schedule.id filters", async () => {
            mockJson({ schedules: [rawSchedule], links: { next: null } });
            const page = await client.querySchedules({
                accountId: "0.0.11",
                scheduleId: { gt: "0.0.700" },
                order: "desc",
            });
            expect(url()).toBe(
                "https://x/api/v1/schedules" +
                    "?account.id=0.0.11&schedule.id=gt:0.0.700&order=desc",
            );
            expect(page.data[0].scheduleId).toBe("0.0.777");
        });

        it("fetches one schedule and converts every field", async () => {
            mockJson(rawSchedule);
            const schedule = await client.querySchedule("0.0.777");
            expect(url()).toBe("https://x/api/v1/schedules/0.0.777");
            expect(schedule).toEqual({
                adminKey: { key: "adminkey" },
                consensusTimestamp: "1.0",
                creatorAccountId: "0.0.11",
                deleted: false,
                executedTimestamp: null,
                expirationTime: "2.0",
                memo: "m",
                payerAccountId: "0.0.12",
                scheduleId: "0.0.777",
                signatures: [
                    {
                        consensusTimestamp: "1.5",
                        publicKeyPrefix: "cHJl",
                        signature: "c2ln",
                        type: "ED25519",
                    },
                ],
                transactionBody: "Kd6tvu8=",
                waitForExpiry: true,
            });
        });

        it("rejects a schedule payload without schedule_id", async () => {
            mockJson({ memo: "nope" });
            await expect(client.querySchedule("0.0.777")).rejects.toThrow(
                /schema mismatch/,
            );
        });
    });

    describe("topic info", () => {
        it("converts a full topic incl. HIP-991 fees", async () => {
            mockJson({
                admin_key: { key: "ak", _type: "ED25519" },
                auto_renew_account: "0.0.2",
                auto_renew_period: 7776000,
                created_timestamp: "1.0",
                custom_fees: {
                    created_timestamp: "0.5",
                    fixed_fees: [
                        {
                            amount: 100,
                            collector_account_id: "0.0.9",
                            denominating_token_id: null,
                        },
                    ],
                },
                deleted: false,
                fee_exempt_key_list: [{ key: "fk", _type: "ECDSA_SECP256K1" }],
                fee_schedule_key: { key: "fsk", _type: "ED25519" },
                memo: "topic memo",
                submit_key: { key: "sk", _type: "ED25519" },
                topic_id: "0.0.7",
            });
            const topic = await client.queryTopic("0.0.7");
            expect(url()).toBe("https://x/api/v1/topics/0.0.7");
            expect(topic).toEqual({
                adminKey: { key: "ak", type: "ED25519" },
                autoRenewAccount: "0.0.2",
                autoRenewPeriod: 7776000,
                createdTimestamp: "1.0",
                deleted: false,
                feeExemptKeyList: [{ key: "fk", type: "ECDSA_SECP256K1" }],
                feeScheduleKey: { key: "fsk", type: "ED25519" },
                customFeesCreatedTimestamp: "0.5",
                fixedFees: [
                    {
                        amount: 100,
                        collectorAccountId: "0.0.9",
                        denominatingTokenId: null,
                    },
                ],
                memo: "topic memo",
                submitKey: { key: "sk", type: "ED25519" },
                topicId: "0.0.7",
            });
        });

        it("handles a minimal public topic", async () => {
            mockJson({
                auto_renew_account: null,
                auto_renew_period: null,
                created_timestamp: null,
                deleted: null,
                memo: "",
                topic_id: "0.0.7",
            });
            const topic = await client.queryTopic("0.0.7");
            expect(topic.submitKey).toBeUndefined();
            expect(topic.fixedFees).toBeUndefined();
        });
    });

    describe("network fees", () => {
        it("fetches and converts the fee schedule", async () => {
            mockJson({
                fees: [
                    { gas: 852000, transaction_type: "ContractCall" },
                    { gas: 2131000, transaction_type: "ContractCreate" },
                ],
                timestamp: "1.0",
            });
            const fees = await client.queryNetworkFees();
            expect(url()).toBe("https://x/api/v1/network/fees");
            expect(fees.fees).toEqual([
                { gas: 852000, transactionType: "ContractCall" },
                { gas: 2131000, transactionType: "ContractCreate" },
            ]);
        });

        it("rejects a payload without a fees array", async () => {
            mockJson({ timestamp: "1.0" });
            await expect(client.queryNetworkFees()).rejects.toThrow(
                /expected fees array/,
            );
        });
    });

    describe("NFT provenance", () => {
        it("fetches a serial's history with a time window", async () => {
            mockJson({
                transactions: [
                    {
                        consensus_timestamp: "2.0",
                        is_approval: false,
                        nonce: 0,
                        receiver_account_id: "0.0.11",
                        sender_account_id: null,
                        transaction_id: "0.0.19789-1618591023-997420021",
                        type: "TOKENMINT",
                    },
                ],
                links: { next: null },
            });
            const page = await client.queryNftTransactions("0.0.99", 1, {
                timestamp: { gte: "1.0" },
                limit: 10,
            });
            expect(url()).toBe(
                "https://x/api/v1/tokens/0.0.99/nfts/1/transactions" +
                    "?timestamp=gte:1.0&limit=10",
            );
            expect(page.data[0]).toEqual({
                consensusTimestamp: "2.0",
                isApproval: false,
                nonce: 0,
                receiverAccountId: "0.0.11",
                senderAccountId: null,
                transactionId: "0.0.19789-1618591023-997420021",
                type: "TOKENMINT",
            });
        });
    });
});
