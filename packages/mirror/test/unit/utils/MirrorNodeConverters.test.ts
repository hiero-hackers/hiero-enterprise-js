import { describe, it, expect } from "vitest";
import {
    convertPage,
    convertAccountInfo,
    convertBalance,
    convertNft,
    convertTokenInfo,
    convertTopicMessage,
    convertTransactionInfo,
    convertExchangeRate,
    convertNetworkStake,
    convertTokenHolder,
    convertAccountTokenBalance,
    convertNetworkNode,
    convertKey,
} from "../../../src/utils/MirrorNodeConverters.js";

describe("convertKey", () => {
    it("carries the algorithm on a simple key", () => {
        expect(convertKey({ key: "abcd", _type: "ED25519" })).toEqual({
            key: "abcd",
            type: "ED25519",
        });
    });

    it("passes a ProtobufEncoded complex key through untouched", () => {
        // Threshold key / key list: `key` is protobuf, not a public key.
        const raw = { key: "0a05...", _type: "ProtobufEncoded" };
        expect(convertKey(raw)).toEqual({
            key: "0a05...",
            type: "ProtobufEncoded",
        });
    });

    it("returns undefined for an absent key", () => {
        expect(convertKey(null)).toBeUndefined();
        expect(convertKey(undefined)).toBeUndefined();
    });
});

describe("convertPage", () => {
    it("finds the data array under any key and preserves links", () => {
        const page = convertPage(
            { things: [1, 2], links: { next: "/n" } },
            (x: number) => x * 10,
        );
        expect(page.data).toEqual([10, 20]);
        expect(page.links.next).toBe("/n");
    });

    it("handles a missing array and missing links", () => {
        const page = convertPage({}, (x: number) => x);
        expect(page.data).toEqual([]);
        expect(page.links.next).toBeNull();
    });
});

describe("account converters", () => {
    it("converts a full account and defaults balance/deleted", () => {
        expect(convertAccountInfo({ account: "0.0.1" }).balance).toBe(0);
        expect(convertAccountInfo({ account: "0.0.1" }).deleted).toBe(false);
        const full = convertAccountInfo({
            account: "0.0.2",
            evm_address: "0xabc",
            alias: "HIQQ...",
            key: { key: "k", _type: "ED25519" },
            balance: { balance: 5, tokens: [] },
            deleted: true,
            staked_node_id: 3,
        });
        expect(full).toMatchObject({
            accountId: "0.0.2",
            evmAddress: "0xabc",
            alias: "HIQQ...",
            key: { key: "k", type: "ED25519" },
            balance: 5,
            deleted: true,
            stakedNodeId: 3,
        });
    });

    it("converts balances with token entries", () => {
        const balance = convertBalance("0.0.9", {
            account: "0.0.9",
            balance: {
                balance: 100,
                tokens: [{ token_id: "0.0.5", balance: 7, decimals: 2 }],
            },
        });
        expect(balance).toEqual({
            accountId: "0.0.9",
            hbars: "100",
            tokens: [{ tokenId: "0.0.5", balance: "7", decimals: 2 }],
        });
    });

    it("converts account token balances, defaulting decimals to 0", () => {
        expect(
            convertAccountTokenBalance({ token_id: "0.0.5", balance: 7 }),
        ).toEqual({ tokenId: "0.0.5", balance: "7", decimals: 0 });
    });
});

describe("token converters", () => {
    it("converts all three custom fee kinds", () => {
        const token = convertTokenInfo({
            token_id: "0.0.5",
            name: "T",
            symbol: "T",
            type: "NON_FUNGIBLE_UNIQUE",
            decimals: "0",
            total_supply: "1",
            max_supply: "0",
            treasury_account_id: "0.0.2",
            deleted: false,
            pause_status: "PAUSED",
            custom_fees: {
                fixed_fees: [
                    {
                        amount: 1,
                        collector_account_id: "0.0.3",
                        all_collectors_are_exempt: false,
                    },
                ],
                fractional_fees: [
                    {
                        // The mirror node nests the fraction under `amount`.
                        amount: { numerator: 1, denominator: 100 },
                        net_of_transfers: true,
                        collector_account_id: "0.0.3",
                        denominating_token_id: "0.0.5",
                        all_collectors_are_exempt: false,
                    },
                ],
                royalty_fees: [
                    {
                        amount: { numerator: 5, denominator: 100 },
                        fallback_fee: {
                            amount: 10,
                            denominating_token_id: "0.0.7",
                        },
                        collector_account_id: "0.0.3",
                        all_collectors_are_exempt: true,
                    },
                ],
            },
        });
        expect(token.type).toBe("NON_FUNGIBLE_UNIQUE");
        expect(token.paused).toBe(true);
        expect(token.customFees.map((fee) => fee.type)).toEqual([
            "fixed",
            "fractional",
            "royalty",
        ]);
        // The fraction values must survive the nested `amount` shape.
        expect(token.customFees[1]).toMatchObject({
            numerator: 1,
            denominator: 100,
            denominatingTokenId: "0.0.5",
        });
        expect(token.customFees[2]).toMatchObject({
            numerator: 5,
            denominator: 100,
        });
    });

    it("converts token holders, preserving optional decimals", () => {
        expect(
            convertTokenHolder({ account: "0.0.8", balance: 12, decimals: 6 }),
        ).toEqual({ accountId: "0.0.8", balance: "12", decimals: 6 });
    });
});

describe("misc converters", () => {
    it("converts NFTs", () => {
        expect(
            convertNft({
                token_id: "0.0.5",
                serial_number: 3,
                account_id: "0.0.9",
                metadata: "bQ==",
                deleted: false,
            }).serialNumber,
        ).toBe(3);
    });

    it("converts topic messages", () => {
        const message = convertTopicMessage({
            topic_id: "0.0.7",
            sequence_number: 42,
            message: "aGk=",
            running_hash: "rh",
            consensus_timestamp: "1.000000002",
        });
        expect(message.sequenceNumber).toBe("42");
        expect(message.message).toBe("aGk=");
    });

    it("converts transactions, decoding memo and flagging success", () => {
        const tx = convertTransactionInfo({
            transaction_id: "0.0.1-1-1",
            name: "CRYPTO TRANSFER",
            result: "SUCCESS",
            consensus_timestamp: "2.0",
            valid_start_timestamp: "1.0",
            charged_tx_fee: 5,
            memo_base64: "aGVsbG8=",
            transfers: [{ account: "0.0.1", amount: -5, is_approval: false }],
            token_transfers: [
                { token_id: "0.0.5", account: "0.0.1", amount: 2 },
            ],
            nft_transfers: [
                {
                    token_id: "0.0.5",
                    serial_number: 1,
                    sender_account_id: "0.0.1",
                    receiver_account_id: "0.0.2",
                },
            ],
            staking_reward_transfers: [{ account: "0.0.1", amount: 1 }],
        });
        expect(tx.successful).toBe(true);
        expect(tx.memo).toBe("hello");
        expect(tx.transfers).toHaveLength(1);
        expect(tx.tokenTransfers[0].tokenId).toBe("0.0.5");
        expect(tx.nftTransfers[0].serialNumber).toBe(1);
        expect(tx.stakingRewardTransfers[0].amount).toBe(1);
    });

    it("converts exchange rates and network stake", () => {
        expect(
            convertExchangeRate({
                cent_equivalent: 12,
                hbar_equivalent: 1,
                expiration_time: 99,
            }).centEquivalent,
        ).toBe(12);
        const stake = convertNetworkStake({
            max_stake_rewarded: 1,
            max_staking_reward_rate_per_hbar: 2,
            max_total_reward: 3,
            node_reward_fee_fraction: 0,
            reserved_staking_rewards: 0,
            reward_balance_threshold: 0,
            stake_total: 9,
            staking_period: { from: "1.0", to: "2.0" },
            staking_period_duration: 1440,
            staking_periods_stored: 365,
            unreserved_staking_reward_balance: 0,
        });
        expect(stake.stakeTotal).toBe(9);
        expect(stake.stakingPeriod).toEqual({ from: "1.0", to: "2.0" });
    });

    it("converts network nodes", () => {
        expect(
            convertNetworkNode({
                node_id: 1,
                node_account_id: "0.0.4",
                description: "d",
                stake: 5,
                min_stake: 1,
                max_stake: 9,
                stake_rewarded: 4,
                stake_not_rewarded: 1,
            }).nodeAccountId,
        ).toBe("0.0.4");
    });
});

describe("converter default branches", () => {
    it("handles a minimal token (no custom fees, fungible, unpaused)", () => {
        const token = convertTokenInfo({
            token_id: "0.0.5",
            name: "T",
            symbol: "T",
            type: "FUNGIBLE_COMMON",
            decimals: "2",
            total_supply: "1",
            max_supply: "0",
            treasury_account_id: "0.0.2",
            deleted: false,
        });
        expect(token.customFees).toEqual([]);
        expect(token.paused).toBe(false);
        expect(token.type).toBe("FUNGIBLE_COMMON");
    });

    it("handles fee lists with missing subsets and royalty without fallback", () => {
        const token = convertTokenInfo({
            token_id: "0.0.5",
            name: "T",
            symbol: "T",
            type: "FUNGIBLE_COMMON",
            decimals: "0",
            total_supply: "1",
            max_supply: "0",
            treasury_account_id: "0.0.2",
            deleted: false,
            custom_fees: {
                royalty_fees: [
                    {
                        amount: { numerator: 1, denominator: 10 },
                        collector_account_id: "0.0.3",
                        all_collectors_are_exempt: false,
                    },
                ],
            },
        });
        expect(token.customFees).toHaveLength(1);
        expect(
            (token.customFees[0] as { fallbackFee?: unknown }).fallbackFee,
        ).toBeUndefined();
    });

    it("tolerates fixture-revealed nulls the spec does not document", () => {
        const holder = convertTokenHolder({
            account: "0.0.9",
            balance: 1,
            decimals: null,
        });
        expect(holder.decimals).toBeUndefined();
    });

    it("normalizes the tokens-only numeric expiry_timestamp to a string", () => {
        const token = convertTokenInfo({
            token_id: "0.0.5",
            name: "T",
            symbol: "T",
            type: "FUNGIBLE_COMMON",
            decimals: "0",
            total_supply: "1",
            max_supply: "0",
            treasury_account_id: "0.0.2",
            deleted: false,
            expiry_timestamp: 1632175380000000000,
        });
        expect(token.expirationTimestamp).toBe("1632175380.000000000");
    });

    it("defaults allCollectorsAreExempt to false when the flag is absent", () => {
        const token = convertTokenInfo({
            token_id: "0.0.5",
            name: "T",
            symbol: "T",
            type: "FUNGIBLE_COMMON",
            decimals: "0",
            total_supply: "1",
            max_supply: "0",
            treasury_account_id: "0.0.2",
            deleted: false,
            custom_fees: {
                fixed_fees: [{ amount: 1, collector_account_id: "0.0.3" }],
                fractional_fees: [{ collector_account_id: "0.0.3" }],
                royalty_fees: [{ collector_account_id: "0.0.3" }],
            },
        });
        expect(token.customFees).toHaveLength(3);
        for (const fee of token.customFees) {
            expect(fee.allCollectorsAreExempt).toBe(false);
        }
    });

    it("handles a transaction with everything optional missing", () => {
        const tx = convertTransactionInfo({
            transaction_id: "0.0.1-1-1",
            result: "FAIL",
            consensus_timestamp: "2.0",
            valid_start_timestamp: "1.0",
            charged_tx_fee: 0,
        } as never);
        expect(tx.successful).toBe(false);
        expect(tx.type).toBe("");
        expect(tx.memo).toBeUndefined();
        expect(tx.transfers).toEqual([]);
        expect(tx.tokenTransfers).toEqual([]);
        expect(tx.nftTransfers).toEqual([]);
        expect(tx.stakingRewardTransfers).toEqual([]);
    });

    it("handles an account with no balance object", () => {
        const balance = convertBalance("0.0.9", { account: "0.0.9" });
        expect(balance.hbars).toBe("0");
        expect(balance.tokens).toEqual([]);
    });
});
