import { describe, it } from "vitest";
import {
    convertAccountInfo,
    convertBalance,
    convertAccountTokenBalance,
    convertAccountBalanceSnapshot,
    convertStakingReward,
    convertTokenInfo,
    convertTokenHolder,
    convertNft,
    convertNftTransaction,
    convertTransactionInfo,
    convertTopicInfo,
    convertTopicMessage,
    convertBlock,
    convertSchedule,
    convertHook,
    convertHookStorageSlot,
    convertAirdrop,
    convertCryptoAllowance,
    convertTokenAllowance,
    convertNftAllowance,
    convertNetworkNode,
    convertRegisteredNode,
    convertNetworkStake,
    convertNetworkFees,
    convertFeeEstimate,
    convertContract,
    convertContractDetail,
    convertContractResult,
    convertContractResultDetails,
    convertContractLogEntry,
    convertContractLog,
    convertContractState,
    convertContractAction,
    convertOpcodeTrace,
} from "../../src/utils/MirrorNodeConverters.js";
import type {
    MirrorAccountResponse,
    MirrorAccountTokenBalance,
    MirrorAccountBalanceSnapshot,
    MirrorStakingReward,
    MirrorTokenResponse,
    MirrorTokenHolderBalance,
    MirrorNft,
    MirrorNftTransaction,
    MirrorTransaction,
    MirrorTopicResponse,
    MirrorTopicMessageRaw,
    MirrorBlock,
    MirrorScheduleResponse,
    MirrorHook,
    MirrorHookStorageSlot,
    MirrorAirdrop,
    MirrorCryptoAllowance,
    MirrorTokenAllowance,
    MirrorNftAllowance,
    MirrorNetworkNode,
    MirrorRegisteredNode,
    MirrorNetworkStakeResponse,
    MirrorNetworkFeesResponse,
    MirrorFeeEstimateResponse,
    MirrorContractRaw,
    MirrorContractResponse,
    MirrorContractResult,
    MirrorContractResultDetails,
    MirrorContractResultLog,
    MirrorContractLog,
    MirrorContractState,
    MirrorContractAction,
    MirrorOpcodesResponse,
} from "../../src/types/index.js";
import { assertNoSilentDrops } from "../utils/field-drift.js";

/**
 * WS5 — field-drift guard. Rationale + the shared helper live in
 * `test/utils/field-drift.ts`. In short: each converter is fed a maximal
 * `Required<Raw>` fixture of unique sentinels, and every sentinel must survive
 * into the converted output — a dropped wire field is a failing test. Values
 * that are legitimately reshaped or knowingly deferred are allow-listed inline
 * with a reason, so an omission is always documented, never silent.
 *
 * Complements `response-field-completeness.test.ts`, which exercises the
 * null/absent-value branches this all-populated guard does not.
 */

describe("field-drift guard: account", () => {
    const raw: Required<MirrorAccountResponse> = {
        account: "0.0.1001",
        alias: "HIQQEXWKW6ZC",
        evm_address: "0xacct000000000000000000000000000000000001",
        delegation_address: "0xdelegation00000000000000000000000000000a",
        key: { key: "ACCT_KEY_HEX", _type: "ED25519" },
        balance: {
            timestamp: "1700000000.111111111",
            balance: 424242001,
            tokens: [{ token_id: "0.0.7770", balance: 5501, decimals: 3302 }],
        },
        deleted: false,
        auto_renew_period: 7776001,
        memo: "acct-memo-sentinel",
        max_automatic_token_associations: 110001,
        staked_account_id: "0.0.2220",
        staked_node_id: 70001,
        stake_period_start: "1699999999.222222222",
        created_timestamp: "1600000000.333333333",
        expiry_timestamp: "1800000000.444444444",
        decline_reward: true,
        ethereum_nonce: 30001,
        pending_reward: 990001,
        receiver_sig_required: true,
    };

    it("carries every wire field (documenting the WS4 embedded-token gap)", () => {
        assertNoSilentDrops(raw, convertAccountInfo(raw), {
            // Embedded balance snapshot — dropped until WS4 surfaces it on
            // MirrorAccountInfo. Remove these once WS4 lands.
            "1700000000.111111111":
                "WS4: embedded balance.timestamp not yet carried",
            "0.0.7770":
                "WS4: embedded balance.tokens[].token_id not yet carried",
            "5501": "WS4: embedded balance.tokens[].balance not yet carried",
            "3302": "WS4: embedded balance.tokens[].decimals not yet carried",
        });
    });
});

describe("field-drift guard: token", () => {
    const raw: Required<MirrorTokenResponse> = {
        token_id: "0.0.5550",
        name: "SentinelToken",
        symbol: "SENT",
        type: "FUNGIBLE_COMMON",
        decimals: "8",
        total_supply: "1000001",
        max_supply: "2000002",
        treasury_account_id: "0.0.3330",
        admin_key: { key: "ADMIN_HEX", _type: "ED25519" },
        supply_key: { key: "SUPPLY_HEX", _type: "ECDSA_SECP256K1" },
        freeze_key: { key: "FREEZE_HEX", _type: "ED25519" },
        wipe_key: { key: "WIPE_HEX", _type: "ED25519" },
        kyc_key: { key: "KYC_HEX", _type: "ED25519" },
        pause_key: { key: "PAUSE_HEX", _type: "ED25519" },
        fee_schedule_key: { key: "FEESCHED_HEX", _type: "ED25519" },
        deleted: false,
        pause_status: "UNPAUSED",
        custom_fees: {
            created_timestamp: "1650000000.555555555",
            fixed_fees: [
                {
                    amount: 4400,
                    collector_account_id: "0.0.4440",
                    denominating_token_id: "0.0.4441",
                    all_collectors_are_exempt: false,
                },
            ],
            fractional_fees: [],
            royalty_fees: [],
        },
        created_timestamp: "1640000000.666666666",
        expiry_timestamp: "1660000000.777777777",
        memo: "token-memo-sentinel",
        auto_renew_account: "0.0.6660",
        auto_renew_period: 7776002,
        freeze_default: false,
        initial_supply: "3000003",
        metadata: "bWV0YWRhdGE=",
        metadata_key: { key: "METADATA_HEX", _type: "ED25519" },
        modified_timestamp: "1670000000.888888888",
        supply_type: "FINITE",
    };

    it("carries every wire field (keys w/ algorithm, custom-fee timestamp)", () => {
        assertNoSilentDrops(raw, convertTokenInfo(raw), {
            // pause_status is collapsed to the boolean `paused`.
            UNPAUSED: "transformed: pause_status → boolean `paused`",
        });
    });
});

describe("field-drift guard: balance", () => {
    it("carries every wire field", () => {
        // convertBalance reads only balance.*; accountId is supplied as an
        // argument, so seed raw.account with the same id we pass in so the
        // (otherwise-unread) leaf still appears in the output.
        const raw: MirrorAccountResponse = {
            account: "0.0.9000001",
            balance: {
                timestamp: "1700000001.100000001",
                balance: 4242010,
                tokens: [
                    {
                        token_id: "0.0.9000011",
                        balance: 4242011,
                        decimals: 4242012,
                    },
                ],
            },
        };
        assertNoSilentDrops(raw, convertBalance("0.0.9000001", raw));
    });
});

describe("field-drift guard: accountTokenBalance", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorAccountTokenBalance> = {
            token_id: "0.0.9100001",
            balance: 4243001,
            decimals: 4243002,
            automatic_association: true,
            created_timestamp: "1700000002.200000002",
            freeze_status: "FROZEN",
            kyc_status: "GRANTED",
        };
        assertNoSilentDrops(raw, convertAccountTokenBalance(raw));
    });
});

describe("field-drift guard: accountBalanceSnapshot", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorAccountBalanceSnapshot> = {
            account: "0.0.9200001",
            balance: 4244001,
            tokens: [{ token_id: "0.0.9200011", balance: 4244002 }],
        };
        assertNoSilentDrops(raw, convertAccountBalanceSnapshot(raw));
    });
});

describe("field-drift guard: stakingReward", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorStakingReward> = {
            account_id: "0.0.9300001",
            amount: 4245001,
            timestamp: "1700000003.300000003",
        };
        assertNoSilentDrops(raw, convertStakingReward(raw));
    });
});

describe("field-drift guard: airdrop", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorAirdrop> = {
            amount: 4246001,
            receiver_id: "0.0.9400001",
            sender_id: "0.0.9400002",
            serial_number: 4246002,
            timestamp: {
                from: "1700000004.400000004",
                to: "1700000004.500000005",
            },
            token_id: "0.0.9400003",
        };
        assertNoSilentDrops(raw, convertAirdrop(raw));
    });
});

describe("field-drift guard: cryptoAllowance", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorCryptoAllowance> = {
            amount: 4247001,
            amount_granted: 4247002,
            owner: "0.0.9500001",
            spender: "0.0.9500002",
            timestamp: {
                from: "1700000005.500000005",
                to: "1700000005.600000006",
            },
        };
        assertNoSilentDrops(raw, convertCryptoAllowance(raw));
    });
});

describe("field-drift guard: tokenAllowance", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorTokenAllowance> = {
            amount: 4248001,
            amount_granted: 4248002,
            owner: "0.0.9600001",
            spender: "0.0.9600002",
            timestamp: {
                from: "1700000006.600000006",
                to: "1700000006.700000007",
            },
            token_id: "0.0.9600003",
        };
        assertNoSilentDrops(raw, convertTokenAllowance(raw));
    });
});

describe("field-drift guard: nftAllowance", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorNftAllowance> = {
            approved_for_all: true,
            owner: "0.0.9700001",
            spender: "0.0.9700002",
            timestamp: {
                from: "1700000007.700000007",
                to: "1700000007.800000008",
            },
            token_id: "0.0.9700003",
        };
        assertNoSilentDrops(raw, convertNftAllowance(raw));
    });
});

describe("field-drift guard: hook", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorHook> = {
            admin_key: { key: "0xadminkey9800001", _type: "ECDSA_SECP256K1" },
            contract_id: "0.0.9800002",
            created_timestamp: "1700000008.800000008",
            deleted: true,
            extension_point: "ACCOUNT_ALLOWANCE_HOOK",
            hook_id: 4249001,
            owner_id: "0.0.9800003",
            timestamp_range: {
                from: "1700000008.900000009",
                to: "1700000008.910000010",
            },
            type: "LAMBDA",
        };
        assertNoSilentDrops(raw, convertHook(raw));
    });
});

describe("field-drift guard: hookStorageSlot", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorHookStorageSlot> = {
            key: "0xslotkey9900001",
            value: "0xslotval9900002",
            timestamp: "1700000009.900000009",
        };
        assertNoSilentDrops(raw, convertHookStorageSlot(raw));
    });
});

describe("field-drift guard: tokenHolder", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorTokenHolderBalance> = {
            account: "0.0.700001",
            balance: 918273645001,
            decimals: 700007,
        };
        assertNoSilentDrops(raw, convertTokenHolder(raw));
    });
});

describe("field-drift guard: nft", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorNft> = {
            token_id: "0.0.800001",
            serial_number: 800002,
            account_id: "0.0.800003",
            metadata: "bWV0YWRhdGEtODAwMDA0",
            created_timestamp: "800005.000000001",
            modified_timestamp: "800006.000000002",
            deleted: true,
            delegating_spender: "0.0.800007",
            spender: "0.0.800008",
        };
        assertNoSilentDrops(raw, convertNft(raw));
    });
});

describe("field-drift guard: nftTransaction", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorNftTransaction> = {
            consensus_timestamp: "900001.000000001",
            is_approval: true,
            nonce: 900002,
            receiver_account_id: "0.0.900003",
            sender_account_id: "0.0.900004",
            transaction_id: "0.0.900005-900006-900007",
            type: "CRYPTOTRANSFER",
        };
        assertNoSilentDrops(raw, convertNftTransaction(raw));
    });
});

describe("field-drift guard: transactionInfo", () => {
    it("carries every wire field (transfers, custom fees, batch key)", () => {
        const raw: Required<MirrorTransaction> = {
            transaction_id: "0.0.100001-100002-100003",
            name: "Crypto Transfer",
            result: "SUCCESS",
            consensus_timestamp: "100010.000000001",
            valid_start_timestamp: "100011.000000002",
            charged_tx_fee: 100012,
            memo_base64: "TWF4aW1hbCBtZW1v",
            transfers: [
                { account: "0.0.100020", amount: 100021, is_approval: true },
            ],
            token_transfers: [
                {
                    token_id: "0.0.100030",
                    account: "0.0.100031",
                    amount: 100032,
                    is_approval: false,
                },
            ],
            nft_transfers: [
                {
                    token_id: "0.0.100040",
                    serial_number: 100041,
                    sender_account_id: "0.0.100042",
                    receiver_account_id: "0.0.100043",
                    is_approval: true,
                },
            ],
            staking_reward_transfers: [
                { account: "0.0.100050", amount: 100051 },
            ],
            batch_key: { key: "0xbatchkey100060", _type: "ED25519" },
            bytes: "Ynl0ZXMxMDAwNzA=",
            entity_id: "0.0.100080",
            high_volume: true,
            high_volume_pricing_multiplier: 100090,
            max_custom_fees: [
                {
                    account_id: "0.0.100100",
                    amount: 100101,
                    denominating_token_id: "0.0.100102",
                },
            ],
            max_fee: "100110",
            node: "0.0.100120",
            nonce: 100130,
            parent_consensus_timestamp: "100140.000000003",
            scheduled: false,
            transaction_hash: "0xhash100150",
            valid_duration_seconds: "100160",
            assessed_custom_fees: [
                {
                    amount: 100170,
                    collector_account_id: "0.0.100171",
                    effective_payer_account_ids: ["0.0.100172", "0.0.100173"],
                    token_id: "0.0.100174",
                },
            ],
        };
        assertNoSilentDrops(raw, convertTransactionInfo(raw), {
            TWF4aW1hbCBtZW1v: "transformed: memo_base64 → atob",
        });
    });
});

describe("field-drift guard: contract", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorContractRaw> = {
            admin_key: { key: "0xadminkey_ct01", _type: "ED25519" },
            auto_renew_account: "0.0.1101",
            auto_renew_period: 7776001,
            contract_id: "0.0.1102",
            created_timestamp: "1700000101.000000101",
            deleted: false,
            evm_address: "0xevmaddr_ct02",
            expiration_timestamp: "1800000102.000000102",
            file_id: "0.0.1103",
            max_automatic_token_associations: 111,
            memo: "contract-memo-ct03",
            nonce: 112,
            obtainer_id: "0.0.1104",
            permanent_removal: true,
            proxy_account_id: "0.0.1105",
            timestamp: {
                from: "1700000103.000000103",
                to: "1700000104.000000104",
            },
        };
        assertNoSilentDrops(raw, convertContract(raw));
    });
});

describe("field-drift guard: contractDetail", () => {
    it("carries every wire field (+ bytecode)", () => {
        const raw: Required<MirrorContractResponse> = {
            admin_key: { key: "0xadminkey_cd01", _type: "ECDSA_SECP256K1" },
            auto_renew_account: "0.0.1201",
            auto_renew_period: 7776002,
            contract_id: "0.0.1202",
            created_timestamp: "1700000201.000000201",
            deleted: false,
            evm_address: "0xevmaddr_cd02",
            expiration_timestamp: "1800000202.000000202",
            file_id: "0.0.1203",
            max_automatic_token_associations: 121,
            memo: "contract-memo-cd03",
            nonce: 122,
            obtainer_id: "0.0.1204",
            permanent_removal: true,
            proxy_account_id: "0.0.1205",
            timestamp: {
                from: "1700000203.000000203",
                to: "1700000204.000000204",
            },
            bytecode: "0xbytecode_cd04",
            runtime_bytecode: "0xruntimebytecode_cd05",
        };
        assertNoSilentDrops(raw, convertContractDetail(raw));
    });
});

describe("field-drift guard: contractResult", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorContractResult> = {
            access_list: [
                {
                    address: "0xacc_addr_cr01",
                    storage_keys: ["0xstoragekey_cr02"],
                },
            ],
            address: "0xresult_addr_cr03",
            authorization_list: [
                {
                    address: "0xauth_addr_cr04",
                    chain_id: "0xauth_chain_cr05",
                    nonce: 130001,
                    r: "0xauth_r_cr06",
                    s: "0xauth_s_cr07",
                    y_parity: "0xauth_ypar_cr08",
                },
            ],
            amount: 1300000001,
            block_gas_used: 1300000002,
            block_hash: "0xblockhash_cr09",
            block_number: 1300000003,
            bloom: "0xbloom_cr10",
            call_result: "0xcallresult_cr11",
            chain_id: "0xtop_chain_cr12",
            contract_id: "0.0.1301",
            created_contract_ids: ["0.0.1302"],
            error_message: "err-msg-cr13",
            failed_initcode: "0xfailedinitcode_cr14",
            from: "0xfrom_addr_cr15",
            function_parameters: "0xfnparams_cr16",
            gas_consumed: 1300000004,
            gas_limit: 1300000005,
            gas_price: "0xgasprice_cr17",
            gas_used: 1300000006,
            hash: "0xhash_cr18",
            max_fee_per_gas: "0xmaxfee_cr19",
            max_priority_fee_per_gas: "0xmaxprio_cr20",
            nonce: 130002,
            r: "0xtop_r_cr21",
            result: "result-cr22",
            s: "0xtop_s_cr23",
            status: "status-cr24",
            timestamp: "1700000301.000000301",
            to: "0xto_addr_cr25",
            transaction_index: 130003,
            type: 130004,
            v: 130005,
        };
        assertNoSilentDrops(raw, convertContractResult(raw));
    });
});

describe("field-drift guard: contractResultDetails", () => {
    it("carries every wire field (+ logs, state_changes)", () => {
        const raw: Required<MirrorContractResultDetails> = {
            access_list: [
                {
                    address: "0xacc_addr_cx01",
                    storage_keys: ["0xstoragekey_cx02"],
                },
            ],
            address: "0xresult_addr_cx03",
            authorization_list: [
                {
                    address: "0xauth_addr_cx04",
                    chain_id: "0xauth_chain_cx05",
                    nonce: 140001,
                    r: "0xauth_r_cx06",
                    s: "0xauth_s_cx07",
                    y_parity: "0xauth_ypar_cx08",
                },
            ],
            amount: 1400000001,
            block_gas_used: 1400000002,
            block_hash: "0xblockhash_cx09",
            block_number: 1400000003,
            bloom: "0xbloom_cx10",
            call_result: "0xcallresult_cx11",
            chain_id: "0xtop_chain_cx12",
            contract_id: "0.0.1401",
            created_contract_ids: ["0.0.1402"],
            error_message: "err-msg-cx13",
            failed_initcode: "0xfailedinitcode_cx14",
            from: "0xfrom_addr_cx15",
            function_parameters: "0xfnparams_cx16",
            gas_consumed: 1400000004,
            gas_limit: 1400000005,
            gas_price: "0xgasprice_cx17",
            gas_used: 1400000006,
            hash: "0xhash_cx18",
            max_fee_per_gas: "0xmaxfee_cx19",
            max_priority_fee_per_gas: "0xmaxprio_cx20",
            nonce: 140002,
            r: "0xtop_r_cx21",
            result: "result-cx22",
            s: "0xtop_s_cx23",
            status: "status-cx24",
            timestamp: "1700000401.000000401",
            to: "0xto_addr_cx25",
            transaction_index: 140003,
            type: 140004,
            v: 140005,
            logs: [
                {
                    address: "0xlog_addr_cx26",
                    bloom: "0xlog_bloom_cx27",
                    contract_id: "0.0.1403",
                    data: "0xlog_data_cx28",
                    index: 140006,
                    topics: ["0xlog_topic_cx29"],
                },
            ],
            state_changes: [
                {
                    address: "0xsc_addr_cx30",
                    contract_id: "0.0.1404",
                    slot: "0xsc_slot_cx31",
                    value_read: "0xsc_valueread_cx32",
                    value_written: "0xsc_valuewritten_cx33",
                },
            ],
        };
        assertNoSilentDrops(raw, convertContractResultDetails(raw));
    });
});

describe("field-drift guard: contractLogEntry", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorContractResultLog> = {
            address: "0xlogentry_addr_le01",
            bloom: "0xlogentry_bloom_le02",
            contract_id: "0.0.1501",
            data: "0xlogentry_data_le03",
            index: 150001,
            topics: ["0xlogentry_topic_le04", "0xlogentry_topic_le05"],
        };
        assertNoSilentDrops(raw, convertContractLogEntry(raw));
    });
});

describe("field-drift guard: contractLog", () => {
    it("carries every wire field (+ block context)", () => {
        const raw: Required<MirrorContractLog> = {
            address: "0xlog_addr_cl01",
            bloom: "0xlog_bloom_cl02",
            contract_id: "0.0.1601",
            data: "0xlog_data_cl03",
            index: 160001,
            topics: ["0xlog_topic_cl04"],
            block_hash: "0xlog_blockhash_cl05",
            block_number: 160002,
            root_contract_id: "0.0.1602",
            timestamp: "1700000601.000000601",
            transaction_hash: "0xlog_txhash_cl06",
            transaction_index: 160003,
        };
        assertNoSilentDrops(raw, convertContractLog(raw));
    });
});

describe("field-drift guard: contractState", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorContractState> = {
            address: "0xstate_addr_cs01",
            contract_id: "0.0.1701",
            timestamp: "1700000701.000000701",
            slot: "0xstate_slot_cs02",
            value: "0xstate_value_cs03",
        };
        assertNoSilentDrops(raw, convertContractState(raw));
    });
});

describe("field-drift guard: contractAction", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorContractAction> = {
            call_depth: 180001,
            call_operation_type: "CALL_ca01",
            call_type: "CALL_ca02",
            caller: "0.0.1801",
            caller_type: "ACCOUNT_ca03",
            from: "0xaction_from_ca04",
            gas: 180002,
            gas_used: 180003,
            index: 180004,
            input: "0xaction_input_ca05",
            recipient: "0.0.1802",
            recipient_type: "CONTRACT_ca06",
            result_data: "0xaction_resultdata_ca07",
            result_data_type: "OUTPUT_ca08",
            timestamp: "1700000801.000000801",
            to: "0xaction_to_ca09",
            value: 180005,
        };
        assertNoSilentDrops(raw, convertContractAction(raw));
    });
});

describe("field-drift guard: opcodeTrace", () => {
    it("carries every wire field (nested opcodes[])", () => {
        const raw: Required<MirrorOpcodesResponse> = {
            address: "0xopcode_addr_op01",
            contract_id: "0.0.1901",
            failed: false,
            gas: 190001,
            opcodes: [
                {
                    depth: 190002,
                    gas: 190003,
                    gas_cost: 190004,
                    memory: ["0xopcode_mem_op02", "0xopcode_mem_op03"],
                    op: "SSTORE_op04",
                    pc: 190005,
                    reason: "0xopcode_reason_op05",
                    stack: ["0xopcode_stack_op06", "0xopcode_stack_op07"],
                    storage: {
                        "0xopcode_slot_op08": "0xopcode_storageval_op09",
                    },
                },
            ],
            return_value: "0xopcode_returnvalue_op10",
        };
        assertNoSilentDrops(raw, convertOpcodeTrace(raw));
    });
});

describe("field-drift guard: topicInfo", () => {
    it("carries every wire field (keys w/ algorithm, custom-fee timestamp)", () => {
        const raw: Required<MirrorTopicResponse> = {
            admin_key: { key: "TOPIC_ADMIN_HEX", _type: "ED25519" },
            auto_renew_account: "0.0.8801",
            auto_renew_period: 7776010,
            created_timestamp: "1610000001.100000001",
            custom_fees: {
                created_timestamp: "1610000002.100000002",
                fixed_fees: [
                    {
                        amount: 880011,
                        collector_account_id: "0.0.8802",
                        denominating_token_id: "0.0.8803",
                    },
                ],
            },
            deleted: false,
            fee_exempt_key_list: [
                { key: "TOPIC_EXEMPT_HEX", _type: "ECDSA_SECP256K1" },
            ],
            fee_schedule_key: { key: "TOPIC_FEESCHED_HEX", _type: "ED25519" },
            memo: "topic-memo-sentinel",
            submit_key: { key: "TOPIC_SUBMIT_HEX", _type: "ED25519" },
            timestamp: {
                from: "1610000003.100000003",
                to: "1610000004.100000004",
            },
            topic_id: "0.0.8800",
        };
        assertNoSilentDrops(raw, convertTopicInfo(raw));
    });
});

describe("field-drift guard: topicMessage", () => {
    it("carries every wire field (nested chunk_info)", () => {
        const raw: Required<MirrorTopicMessageRaw> = {
            topic_id: "0.0.9900",
            sequence_number: 990012,
            message: "topic-message-b64-sentinel",
            running_hash: "RUNNING_HASH_SENTINEL",
            consensus_timestamp: "1620000001.200000001",
            payer_account_id: "0.0.9901",
            chunk_info: {
                initial_transaction_id: {
                    account_id: "0.0.9902",
                    nonce: 990013,
                    scheduled: false,
                    transaction_valid_start: "1620000002.200000002",
                },
                number: 990014,
                total: 990015,
            },
            running_hash_version: 990016,
        };
        assertNoSilentDrops(raw, convertTopicMessage(raw));
    });
});

describe("field-drift guard: block", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorBlock> = {
            count: 330011,
            gas_used: 330012,
            hapi_version: "0.330.13",
            hash: "BLOCK_HASH_SENTINEL",
            logs_bloom: "0xblockbloomsentinel",
            name: "block-name-sentinel",
            number: 330014,
            previous_hash: "BLOCK_PREV_HASH_SENTINEL",
            size: 330015,
            timestamp: {
                from: "1630000001.300000001",
                to: "1630000002.300000002",
            },
        };
        assertNoSilentDrops(raw, convertBlock(raw));
    });
});

describe("field-drift guard: schedule", () => {
    it("carries every wire field (admin key, signatures[])", () => {
        const raw: Required<MirrorScheduleResponse> = {
            admin_key: { key: "SCHED_ADMIN_HEX", _type: "ED25519" },
            consensus_timestamp: "1640000001.400000001",
            creator_account_id: "0.0.4401",
            deleted: false,
            executed_timestamp: "1640000002.400000002",
            expiration_time: "1640000003.400000003",
            memo: "schedule-memo-sentinel",
            payer_account_id: "0.0.4402",
            schedule_id: "0.0.4400",
            signatures: [
                {
                    consensus_timestamp: "1640000004.400000004",
                    public_key_prefix: "SIG_PREFIX_SENTINEL",
                    signature: "SIG_SENTINEL",
                    type: "ED25519",
                },
            ],
            transaction_body: "TX_BODY_SENTINEL",
            wait_for_expiry: false,
        };
        assertNoSilentDrops(raw, convertSchedule(raw));
    });
});

describe("field-drift guard: networkNode", () => {
    it("carries every wire field (endpoints, timestamp ranges)", () => {
        const raw: Required<MirrorNetworkNode> = {
            node_id: 550011,
            node_account_id: "0.0.5501",
            description: "node-desc-sentinel",
            stake: 550012000000,
            min_stake: 550013000000,
            max_stake: 550014000000,
            stake_rewarded: 550015000000,
            stake_not_rewarded: 550016000000,
            admin_key: { key: "NODE_ADMIN_HEX", _type: "ED25519" },
            associated_registered_nodes: [550017, 550018],
            decline_reward: false,
            file_id: "0.0.5502",
            grpc_proxy_endpoint: {
                ip_address_v4: "10.55.0.1",
                port: 55011,
                domain_name: "grpc-proxy.sentinel",
            },
            memo: "node-memo-sentinel",
            node_cert_hash: "NODE_CERT_HASH_SENTINEL",
            public_key: "NODE_PUBKEY_SENTINEL",
            reward_rate_start: 550019,
            service_endpoints: [
                {
                    ip_address_v4: "10.55.0.2",
                    port: 55012,
                    domain_name: "svc-endpoint.sentinel",
                },
            ],
            staking_period: {
                from: "1650000001.500000001",
                to: "1650000002.500000002",
            },
            timestamp: {
                from: "1650000003.500000003",
                to: "1650000004.500000004",
            },
        };
        assertNoSilentDrops(raw, convertNetworkNode(raw));
    });
});

describe("field-drift guard: registeredNode", () => {
    it("carries every wire field (flat endpoint role flags + siblings)", () => {
        const raw: Required<MirrorRegisteredNode> = {
            admin_key: { key: "REGNODE_ADMIN_HEX", _type: "ED25519" },
            created_timestamp: "1660000001.600000001",
            description: "regnode-desc-sentinel",
            registered_node_id: 660011,
            service_endpoints: [
                {
                    block_node: true,
                    endpoint_apis: ["BLOCK_API_ONE", "BLOCK_API_TWO"],
                    description: "regnode-endpoint-desc-sentinel",
                    domain_name: "regnode-endpoint.sentinel",
                    general_service: false,
                    ip_address: "10.66.0.1",
                    mirror_node: false,
                    port: 66011,
                    requires_tls: true,
                    rpc_relay: false,
                    type: "REGNODE_ENDPOINT_TYPE",
                },
            ],
            timestamp: {
                from: "1660000002.600000002",
                to: "1660000003.600000003",
            },
        };
        assertNoSilentDrops(raw, convertRegisteredNode(raw));
    });
});

describe("field-drift guard: networkStake", () => {
    it("carries every wire field", () => {
        const raw: Required<MirrorNetworkStakeResponse> = {
            max_stake_rewarded: 770011000000,
            max_staking_reward_rate_per_hbar: 770012,
            max_total_reward: 770013000000,
            node_reward_fee_fraction: 770014,
            reserved_staking_rewards: 770015000000,
            reward_balance_threshold: 770016000000,
            stake_total: 770017000000,
            staking_period: {
                from: "1670000001.700000001",
                to: "1670000002.700000002",
            },
            staking_period_duration: 770018,
            staking_periods_stored: 770019,
            staking_reward_fee_fraction: 770020,
            staking_reward_rate: 770021,
            staking_start_threshold: 770022000000,
            unreserved_staking_reward_balance: 770023000000,
        };
        assertNoSilentDrops(raw, convertNetworkStake(raw));
    });
});

describe("field-drift guard: networkFees", () => {
    it("carries every wire field (fees[])", () => {
        const raw: Required<MirrorNetworkFeesResponse> = {
            fees: [
                { gas: 880011, transaction_type: "ContractCall" },
                { gas: 880012, transaction_type: "ContractCreate" },
            ],
            timestamp: "1680000001.800000001",
        };
        assertNoSilentDrops(raw, convertNetworkFees(raw));
    });
});

describe("field-drift guard: feeEstimate", () => {
    it("carries every wire field (network/node/service + extras[])", () => {
        const raw: Required<MirrorFeeEstimateResponse> = {
            high_volume_multiplier: 990011,
            network: { multiplier: 990012, subtotal: 990013 },
            node: {
                base: 990014,
                extras: [
                    {
                        charged: 990015,
                        count: 990016,
                        fee_per_unit: 990017,
                        included: 990018,
                        name: "node-extra-sentinel",
                        subtotal: 990019,
                    },
                ],
            },
            service: {
                base: 990020,
                extras: [
                    {
                        charged: 990021,
                        count: 990022,
                        fee_per_unit: 990023,
                        included: 990024,
                        name: "service-extra-sentinel",
                        subtotal: 990025,
                    },
                ],
            },
            total: 990026,
        };
        assertNoSilentDrops(raw, convertFeeEstimate(raw));
    });
});
