import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { rawJsonResponse } from "../../utils/http.js";

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
        vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(() =>
                Promise.resolve(rawJsonResponse(rawText)),
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
        expect(balance.tinybars).toBe("31869085891081369");
        expect(balance.tokens[0].balance).toBe("75429753064560425");
    });

    it("preserves transfer legs above 2^53, including the negative debit", async () => {
        respond(
            '{"transactions":[{"transaction_id":"0.0.2@1700000000.000000000",' +
                '"name":"CRYPTOTRANSFER","result":"SUCCESS",' +
                '"consensus_timestamp":"1700000001.000000000",' +
                '"valid_start_timestamp":"1700000000.000000000",' +
                '"charged_tx_fee":10000002599702345,' +
                '"transfers":[{"account":"0.0.2","amount":-28912437152291031,"is_approval":false},' +
                '{"account":"0.0.98","amount":28912437152291031,"is_approval":false}],' +
                '"token_transfers":[],"nft_transfers":[],"staking_reward_transfers":[]}]}',
        );

        const tx = await client.queryTransaction("0.0.2@1700000000.000000000");
        expect(tx.transfers[0].amount).toBe("-28912437152291031");
        expect(tx.transfers[1].amount).toBe("28912437152291031");
        // The fee is quoted by the lossless parse at this magnitude too —
        // it must survive as an exact string, not a rounded number.
        expect(tx.chargedTxFee).toBe("10000002599702345");
    });

    it("survives validation and converts mainnet-scale stake figures exactly", async () => {
        // max_stake_rewarded is 18 digits on mainnet — quoted by the lossless
        // parse, so the schema validator must accept the string arm.
        respond(
            '{"max_stake_rewarded":650000000000000001,' +
                '"max_staking_reward_rate_per_hbar":17808,' +
                '"max_total_reward":25000000000000001,' +
                '"node_reward_fee_fraction":0,"reserved_staking_rewards":0,' +
                '"reward_balance_threshold":0,' +
                '"stake_total":14558081689000000001,' +
                '"staking_period":null,"staking_period_duration":1440,' +
                '"staking_periods_stored":365,"staking_reward_fee_fraction":0,' +
                '"staking_reward_rate":100000000000,' +
                '"staking_start_threshold":25000000000000000,' +
                '"unreserved_staking_reward_balance":15397556299937857}',
        );

        const stake = await client.queryNetworkStake();
        expect(stake.maxStakeRewarded).toBe("650000000000000001");
        expect(stake.stakeTotal).toBe("14558081689000000001");
        expect(stake.unreservedStakingRewardBalance).toBe("15397556299937857");
    });

    it("normalizes a 19-digit token expiry to seconds.nanoseconds exactly", async () => {
        respond(
            '{"token_id":"0.0.5","name":"T","symbol":"T","type":"FUNGIBLE_COMMON",' +
                '"decimals":"0","total_supply":"1","max_supply":"0",' +
                '"treasury_account_id":"0.0.2","deleted":false,' +
                '"expiry_timestamp":1632175380000000001}',
        );

        const token = await client.queryTokenById("0.0.5");
        expect(token.expirationTimestamp).toBe("1632175380.000000001");
    });

    it("preserves an owner-chosen hook id above 2^53 exactly", async () => {
        // Hook ids are user-chosen int64s, not counters — a whale-sized
        // id is legitimate data and must arrive digit-exact.
        respond(
            '{"hooks":[{"admin_key":null,"contract_id":"0.0.5001",' +
                '"created_timestamp":"1.0","deleted":false,' +
                '"extension_point":"ACCOUNT_ALLOWANCE_HOOK",' +
                '"hook_id":10000000000000001,"owner_id":"0.0.15",' +
                '"timestamp_range":{"from":"1.0","to":null},"type":"EVM"}],' +
                '"links":{"next":null}}',
        );

        const page = await client.queryHooks("0.0.15");
        expect(page.data[0].hookId).toBe("10000000000000001");
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
