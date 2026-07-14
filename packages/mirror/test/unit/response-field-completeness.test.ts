import { describe, it, expect } from "vitest";
import {
    convertAccountInfo,
    convertTransactionInfo,
    convertTokenInfo,
    convertNft,
    convertTopicMessage,
    convertTopicInfo,
    convertNetworkNode,
    convertNetworkStake,
    convertContractResult,
} from "../../src/utils/MirrorNodeConverters.js";

/**
 * Conversion coverage for the response-field completion: every field the
 * spec defines must survive the raw→public conversion — both when
 * populated and when null/absent (the branch the mirror takes for older
 * rows and native HAPI transactions).
 */
describe("response-field completeness", () => {
    it("carries the account staking/eth fields", () => {
        const account = convertAccountInfo({
            account: "0.0.98",
            decline_reward: true,
            ethereum_nonce: 5,
            pending_reward: 123,
            receiver_sig_required: false,
        });
        expect(account.declineReward).toBe(true);
        expect(account.ethereumNonce).toBe(5);
        expect(account.pendingReward).toBe(123);
        expect(account.receiverSigRequired).toBe(false);
    });

    const baseTransaction = {
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
    };

    it("carries the transaction identity/fee fields", () => {
        const transaction = convertTransactionInfo({
            ...baseTransaction,
            batch_key: { key: "bk" },
            bytes: null,
            entity_id: "0.0.7",
            high_volume: true,
            high_volume_pricing_multiplier: 2000,
            max_custom_fees: [
                {
                    account_id: "0.0.9",
                    amount: 100,
                    denominating_token_id: null,
                },
            ],
            max_fee: "100000000",
            node: "0.0.3",
            nonce: 2,
            parent_consensus_timestamp: "0.9",
            scheduled: true,
            transaction_hash: "aGFzaA==",
            valid_duration_seconds: "120",
        });
        expect(transaction.batchKey).toEqual({ key: "bk" });
        expect(transaction.bytes).toBeNull();
        expect(transaction.entityId).toBe("0.0.7");
        expect(transaction.highVolume).toBe(true);
        expect(transaction.highVolumePricingMultiplier).toBe(2000);
        expect(transaction.maxCustomFees).toEqual([
            { accountId: "0.0.9", amount: 100, denominatingTokenId: null },
        ]);
        expect(transaction.maxFee).toBe("100000000");
        expect(transaction.node).toBe("0.0.3");
        expect(transaction.nonce).toBe(2);
        expect(transaction.parentConsensusTimestamp).toBe("0.9");
        expect(transaction.scheduled).toBe(true);
        expect(transaction.transactionHash).toBe("aGFzaA==");
        expect(transaction.validDurationSeconds).toBe("120");
    });

    it("carries assessed custom fees and approval flags on transfer legs", () => {
        const transaction = convertTransactionInfo({
            ...baseTransaction,
            transfers: [{ account: "0.0.9", amount: 5, is_approval: true }],
            token_transfers: [
                {
                    token_id: "0.0.5",
                    account: "0.0.9",
                    amount: 5,
                    is_approval: true,
                },
            ],
            nft_transfers: [
                {
                    token_id: "0.0.6",
                    serial_number: 1,
                    sender_account_id: "0.0.9",
                    receiver_account_id: "0.0.10",
                    is_approval: true,
                },
            ],
            assessed_custom_fees: [
                {
                    amount: 7,
                    collector_account_id: "0.0.11",
                    effective_payer_account_ids: ["0.0.9"],
                    token_id: null,
                },
            ],
        });
        expect(transaction.tokenTransfers[0].isApproval).toBe(true);
        expect(transaction.nftTransfers[0].isApproval).toBe(true);
        expect(transaction.assessedCustomFees).toEqual([
            {
                amount: 7,
                collectorAccountId: "0.0.11",
                effectivePayerAccountIds: ["0.0.9"],
                tokenId: null,
            },
        ]);
    });

    it("preserves a null batch key", () => {
        const transaction = convertTransactionInfo({
            ...baseTransaction,
            batch_key: null,
        });
        expect(transaction.batchKey).toBeNull();
    });

    it("leaves an absent batch key undefined (distinct from null)", () => {
        // baseTransaction omits batch_key entirely.
        const transaction = convertTransactionInfo(baseTransaction);
        expect(transaction.batchKey).toBeUndefined();
    });

    it("carries the token supply/metadata fields", () => {
        const token = convertTokenInfo({
            token_id: "0.0.5",
            name: "T",
            symbol: "T",
            type: "FUNGIBLE_COMMON",
            decimals: "2",
            total_supply: "100",
            max_supply: "0",
            treasury_account_id: "0.0.2",
            deleted: false,
            auto_renew_account: "0.0.2",
            auto_renew_period: 7776000,
            freeze_default: false,
            initial_supply: "100",
            metadata: "bWV0YQ==",
            metadata_key: { key: "mk" },
            modified_timestamp: "2.0",
            supply_type: "INFINITE",
        });
        expect(token.autoRenewAccount).toBe("0.0.2");
        expect(token.autoRenewPeriod).toBe(7776000);
        expect(token.freezeDefault).toBe(false);
        expect(token.initialSupply).toBe("100");
        expect(token.metadata).toBe("bWV0YQ==");
        expect(token.metadataKey).toEqual({ key: "mk" });
        expect(token.modifiedTimestamp).toBe("2.0");
        expect(token.supplyType).toBe("INFINITE");
    });

    it("carries the NFT modified timestamp", () => {
        const nft = convertNft({
            token_id: "0.0.9",
            serial_number: 1,
            account_id: null,
            metadata: "",
            modified_timestamp: "3.0",
            deleted: true,
        });
        expect(nft.modifiedTimestamp).toBe("3.0");
    });

    const baseMessage = {
        topic_id: "0.0.7",
        sequence_number: 9,
        message: "bQ==",
        running_hash: "aA==",
        consensus_timestamp: "1.0",
    };

    it("carries chunk info for a chunked topic message", () => {
        const message = convertTopicMessage({
            ...baseMessage,
            chunk_info: {
                initial_transaction_id: {
                    account_id: "0.0.2",
                    nonce: 0,
                    scheduled: false,
                    transaction_valid_start: "0.5",
                },
                number: 1,
                total: 2,
            },
            running_hash_version: 3,
        });
        expect(message.chunkInfo).toEqual({
            initialTransactionId: {
                accountId: "0.0.2",
                nonce: 0,
                scheduled: false,
                transactionValidStart: "0.5",
            },
            number: 1,
            total: 2,
        });
        expect(message.runningHashVersion).toBe(3);
    });

    it("preserves null chunk info and null inner transaction id", () => {
        expect(
            convertTopicMessage({ ...baseMessage, chunk_info: null }).chunkInfo,
        ).toBeNull();
        expect(
            convertTopicMessage({
                ...baseMessage,
                chunk_info: {
                    initial_transaction_id: null,
                    number: 1,
                    total: 1,
                },
            }).chunkInfo?.initialTransactionId,
        ).toBeNull();
    });

    it("carries the topic entity timestamp range", () => {
        const topic = convertTopicInfo({
            auto_renew_account: null,
            auto_renew_period: null,
            created_timestamp: null,
            deleted: false,
            memo: "",
            timestamp: { from: "1.0", to: null },
            topic_id: "0.0.7",
        });
        expect(topic.timestamp).toEqual({ from: "1.0", to: null });
    });

    const baseNode = {
        node_id: 0,
        node_account_id: "0.0.3",
        description: "d",
        stake: 1,
        min_stake: 1,
        max_stake: 2,
        stake_rewarded: 1,
        stake_not_rewarded: 0,
    };

    it("carries the node identity/endpoint fields", () => {
        const node = convertNetworkNode({
            ...baseNode,
            admin_key: { key: "ak" },
            associated_registered_nodes: [1, 2],
            decline_reward: false,
            file_id: "0.0.102",
            grpc_proxy_endpoint: { domain_name: "grpc.example", port: 443 },
            memo: "m",
            node_cert_hash: "0xcert",
            public_key: "0xkey",
            reward_rate_start: 7,
            service_endpoints: [{ ip_address_v4: "10.0.0.1", port: 50211 }],
            staking_period: { from: "1.0", to: null },
            timestamp: { from: "0.1", to: null },
        });
        expect(node.adminKey).toEqual({ key: "ak" });
        expect(node.associatedRegisteredNodes).toEqual([1, 2]);
        expect(node.declineReward).toBe(false);
        expect(node.fileId).toBe("0.0.102");
        expect(node.grpcProxyEndpoint).toEqual({
            ipAddressV4: undefined,
            port: 443,
            domainName: "grpc.example",
        });
        expect(node.memo).toBe("m");
        expect(node.nodeCertHash).toBe("0xcert");
        expect(node.publicKey).toBe("0xkey");
        expect(node.rewardRateStart).toBe(7);
        expect(node.serviceEndpoints).toEqual([
            { ipAddressV4: "10.0.0.1", port: 50211, domainName: undefined },
        ]);
        expect(node.stakingPeriod).toEqual({ from: "1.0", to: null });
        expect(node.timestamp).toEqual({ from: "0.1", to: null });
    });

    it("preserves a null grpc proxy endpoint", () => {
        expect(
            convertNetworkNode({ ...baseNode, grpc_proxy_endpoint: null })
                .grpcProxyEndpoint,
        ).toBeNull();
    });

    it("carries the staking reward-rate fields", () => {
        const stake = convertNetworkStake({
            max_stake_rewarded: 0,
            max_staking_reward_rate_per_hbar: 0,
            max_total_reward: 0,
            node_reward_fee_fraction: 0,
            reserved_staking_rewards: 0,
            reward_balance_threshold: 0,
            stake_total: 0,
            staking_period: null,
            staking_period_duration: 0,
            staking_periods_stored: 0,
            staking_reward_fee_fraction: 0.1,
            staking_reward_rate: 100000000000,
            staking_start_threshold: 25,
            unreserved_staking_reward_balance: 0,
        });
        expect(stake.stakingRewardFeeFraction).toBe(0.1);
        expect(stake.stakingRewardRate).toBe(100000000000);
        expect(stake.stakingStartThreshold).toBe(25);
    });

    const baseResult = {
        amount: null,
        block_gas_used: null,
        block_hash: null,
        block_number: null,
        chain_id: null,
        contract_id: null,
        from: null,
        gas_limit: 1,
        gas_price: null,
        gas_used: null,
        hash: "0xh",
        max_fee_per_gas: null,
        max_priority_fee_per_gas: null,
        nonce: null,
        result: "SUCCESS",
        status: "0x1",
        timestamp: "1.0",
        to: null,
        transaction_index: null,
        type: null,
    };

    it("carries the ethereum signature internals on contract results", () => {
        const result = convertContractResult({
            ...baseResult,
            access_list: [{ address: "0xa", storage_keys: ["0x1"] }],
            authorization_list: [
                {
                    address: "0xb",
                    chain_id: "0x127",
                    nonce: 5,
                    r: "0xr",
                    s: "0xs",
                    y_parity: "0x1",
                },
            ],
            r: "0xr",
            s: "0xs",
            v: 1,
        });
        expect(result.accessList).toEqual([
            { address: "0xa", storageKeys: ["0x1"] },
        ]);
        expect(result.authorizationList).toEqual([
            {
                address: "0xb",
                chainId: "0x127",
                nonce: 5,
                r: "0xr",
                s: "0xs",
                yParity: "0x1",
            },
        ]);
        expect(result.r).toBe("0xr");
        expect(result.s).toBe("0xs");
        expect(result.v).toBe(1);
    });

    it("preserves null signature lists on native HAPI results", () => {
        const result = convertContractResult({
            ...baseResult,
            access_list: null,
            authorization_list: null,
        });
        expect(result.accessList).toBeNull();
        expect(result.authorizationList).toBeNull();
    });
});
