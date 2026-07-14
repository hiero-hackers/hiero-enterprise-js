/**
 * Raw mirror node wire types — the snake_case shapes exactly as the REST
 * API sends them. Converters in `mirror-node-converters.ts` map each of
 * these to its camelCase public type; keeping every raw shape in this one
 * file is deliberate, and load-bearing: `spec/diff-response-fields.mjs`
 * parses this file to prove the wire types carry every field the vendored
 * OpenAPI spec defines. Splitting it means updating that tool in lockstep.
 */

export interface MirrorPageResponse<_T> {
    [key: string]: unknown;
    links?: { next: string | null };
}

export interface MirrorAccountResponse {
    account: string;
    alias?: string;
    evm_address?: string;
    /**
     * EIP-7702 delegation indicator ("0x" when none). Implemented on
     * upstream main (rest/model/entity.js, HIP-1340) and returned by
     * its test fixtures, but absent from the OpenAPI spec and not yet
     * in a deployed release as of 0.157.1 — found by
     * spec/check-fixtures.mjs.
     */
    delegation_address?: string | null;
    key?: { key: string; _type?: string };
    balance?: {
        timestamp?: string | null;
        balance: number;
        tokens: MirrorTokenBalance[];
    };
    deleted?: boolean;
    auto_renew_period?: number;
    memo?: string;
    max_automatic_token_associations?: number;
    staked_account_id?: string;
    staked_node_id?: number;
    stake_period_start?: string;
    created_timestamp?: string;
    expiry_timestamp?: string;
    decline_reward?: boolean;
    ethereum_nonce?: number | null;
    pending_reward?: number;
    receiver_sig_required?: boolean | null;
}

export interface MirrorTokenBalance {
    token_id: string;
    balance: number;
    decimals: number;
}

/** A single entry in the raw `/api/v1/tokens/{id}/balances` response. */
export interface MirrorTokenHolderBalance {
    account: string;
    balance: number;
    decimals?: number | null;
}

/** A raw gRPC/REST service endpoint published by a node. */
export interface MirrorServiceEndpoint {
    ip_address_v4?: string;
    port?: number;
    domain_name?: string;
}

/** A single node entry in the raw `/api/v1/network/nodes` response. */
export interface MirrorNetworkNode {
    node_id: number;
    node_account_id: string;
    description: string;
    stake: number;
    min_stake: number;
    max_stake: number;
    stake_rewarded: number;
    stake_not_rewarded: number;
    admin_key?: { key: string; _type?: string } | null;
    associated_registered_nodes?: number[];
    decline_reward?: boolean | null;
    file_id?: string | null;
    grpc_proxy_endpoint?: MirrorServiceEndpoint | null;
    memo?: string | null;
    node_cert_hash?: string | null;
    public_key?: string | null;
    reward_rate_start?: number | null;
    service_endpoints?: MirrorServiceEndpoint[];
    staking_period?: MirrorTimestampRange | null;
    timestamp?: MirrorTimestampRange;
}

/** A single entry in the raw `/api/v1/accounts/{id}/tokens` response. */
export interface MirrorAccountTokenBalance {
    token_id: string;
    balance: number;
    decimals?: number | null;
    automatic_association?: boolean | null;
    created_timestamp?: string | null;
    freeze_status?: string | null;
    kyc_status?: string | null;
}

export interface MirrorNft {
    token_id: string;
    serial_number: number;
    account_id: string | null;
    metadata: string;
    created_timestamp?: string;
    modified_timestamp?: string | null;
    deleted: boolean;
    delegating_spender?: string;
    spender?: string;
}

export interface MirrorTokenResponse {
    token_id: string;
    name: string;
    symbol: string;
    type: string;
    decimals: string;
    total_supply: string;
    max_supply: string;
    treasury_account_id: string;
    admin_key?: { key: string; _type?: string };
    supply_key?: { key: string; _type?: string };
    freeze_key?: { key: string; _type?: string };
    wipe_key?: { key: string; _type?: string };
    kyc_key?: { key: string; _type?: string };
    pause_key?: { key: string; _type?: string };
    fee_schedule_key?: { key: string; _type?: string };
    deleted: boolean;
    pause_status?: string;
    custom_fees?: {
        created_timestamp?: string;
        fixed_fees?: MirrorFixedFeeRaw[];
        fractional_fees?: MirrorFractionalFeeRaw[];
        royalty_fees?: MirrorRoyaltyFeeRaw[];
    };
    created_timestamp?: string;
    /**
     * Upstream wart (documented in the mirror node's own V2-API notes):
     * tokens return this as epoch NANOSECONDS as a JSON number — unlike
     * the `seconds.nanoseconds` strings everywhere else. Values exceed
     * MAX_SAFE_INTEGER, so JSON.parse has already rounded to ~512ns
     * granularity by the time we see it.
     */
    expiry_timestamp?: number | string;
    memo?: string;
    auto_renew_account?: string | null;
    auto_renew_period?: number | null;
    freeze_default?: boolean;
    initial_supply?: string;
    metadata?: string;
    metadata_key?: { key: string; _type?: string } | null;
    modified_timestamp?: string;
    supply_type?: string;
}

export interface MirrorFixedFeeRaw {
    amount: number;
    collector_account_id: string;
    denominating_token_id?: string;
    all_collectors_are_exempt?: boolean;
}

export interface MirrorFractionalFeeRaw {
    amount?: { numerator: number; denominator: number };
    minimum?: number;
    maximum?: number | null;
    net_of_transfers?: boolean;
    collector_account_id: string;
    denominating_token_id?: string | null;
    all_collectors_are_exempt?: boolean;
}

export interface MirrorRoyaltyFeeRaw {
    amount?: { numerator: number; denominator: number };
    fallback_fee?: {
        amount: number;
        denominating_token_id?: string | null;
    } | null;
    collector_account_id: string;
    all_collectors_are_exempt?: boolean;
}

/** Chunk metadata for a multi-chunk topic message. */
export interface MirrorChunkInfo {
    initial_transaction_id: {
        account_id: string | null;
        nonce: number | null;
        scheduled: boolean | null;
        transaction_valid_start: string;
    } | null;
    number: number;
    total: number;
}

export interface MirrorTopicMessageRaw {
    topic_id: string;
    sequence_number: number;
    message: string;
    running_hash: string;
    consensus_timestamp: string;
    payer_account_id?: string;
    chunk_info?: MirrorChunkInfo | null;
    running_hash_version?: number;
}

/** A custom fee actually charged by a transaction. */
export interface MirrorAssessedCustomFee {
    amount: number;
    collector_account_id: string | null;
    effective_payer_account_ids: string[];
    token_id: string | null;
}

/** A HIP-18 custom fee limit attached to a transaction. */
export interface MirrorCustomFeeLimit {
    account_id: string | null;
    amount: number;
    denominating_token_id: string | null;
}

export interface MirrorTransaction {
    transaction_id: string;
    name: string;
    result: string;
    consensus_timestamp: string;
    valid_start_timestamp: string;
    charged_tx_fee: number;
    memo_base64?: string;
    transfers: MirrorTransfer[];
    token_transfers: MirrorTokenTransfer[];
    nft_transfers: MirrorNftTransfer[];
    staking_reward_transfers: MirrorStakingRewardTransfer[];
    batch_key?: { key: string; _type?: string } | null;
    bytes?: string | null;
    entity_id?: string | null;
    high_volume?: boolean;
    high_volume_pricing_multiplier?: number | null;
    max_custom_fees?: MirrorCustomFeeLimit[];
    max_fee?: string;
    node?: string | null;
    nonce?: number;
    parent_consensus_timestamp?: string | null;
    scheduled?: boolean;
    transaction_hash?: string;
    valid_duration_seconds?: string | null;
    assessed_custom_fees?: MirrorAssessedCustomFee[];
}

export interface MirrorTransfer {
    account: string;
    amount: number;
    is_approval: boolean;
}

export interface MirrorTokenTransfer {
    token_id: string;
    account: string;
    amount: number;
    is_approval?: boolean;
}

export interface MirrorNftTransfer {
    token_id: string;
    serial_number: number;
    sender_account_id: string;
    receiver_account_id: string;
    is_approval?: boolean;
}

export interface MirrorStakingRewardTransfer {
    account: string;
    amount: number;
}

export interface MirrorTransactionListResponse {
    transactions: MirrorTransaction[];
}

export interface MirrorExchangeRatesResponse {
    current_rate: MirrorExchangeRate;
    next_rate: MirrorExchangeRate;
    timestamp?: string;
}

export interface MirrorExchangeRate {
    cent_equivalent: number;
    hbar_equivalent: number;
    expiration_time: number;
}

export interface MirrorNetworkSupplyResponse {
    released_supply: string;
    total_supply: string;
    timestamp: string;
}

export interface MirrorNetworkStakeResponse {
    max_stake_rewarded: number;
    max_staking_reward_rate_per_hbar: number;
    max_total_reward: number;
    node_reward_fee_fraction: number;
    reserved_staking_rewards: number;
    reward_balance_threshold: number;
    stake_total: number;
    staking_period: { from: string; to: string } | null;
    staking_period_duration: number;
    staking_periods_stored: number;
    staking_reward_fee_fraction: number;
    staking_reward_rate: number;
    staking_start_threshold: number;
    unreserved_staking_reward_balance: number;
}

/** A single entry in the raw `/api/v1/balances` snapshot response. */
export interface MirrorAccountBalanceSnapshot {
    account: string;
    balance: number;
    tokens?: Array<{ token_id: string; balance: number }>;
}

/** Raw timestamp range: `to` is null while the record is current. */
export interface MirrorTimestampRange {
    from: string;
    to: string | null;
}

/** A single entry in the raw airdrop listings. */
export interface MirrorAirdrop {
    amount: number;
    receiver_id: string;
    sender_id: string;
    serial_number: number | null;
    timestamp: MirrorTimestampRange;
    token_id: string;
}

/** A single entry in the raw crypto-allowance listing. */
export interface MirrorCryptoAllowance {
    amount: number;
    amount_granted: number;
    owner: string;
    spender: string;
    timestamp: MirrorTimestampRange;
}

/** A single entry in the raw token-allowance listing. */
export interface MirrorTokenAllowance extends MirrorCryptoAllowance {
    token_id: string;
}

/** A single entry in the raw NFT-allowance listing. */
export interface MirrorNftAllowance {
    approved_for_all: boolean;
    owner: string;
    spender: string;
    timestamp: MirrorTimestampRange;
    token_id: string;
}

/** A raw schedule signature. */
export interface MirrorScheduleSignature {
    consensus_timestamp: string;
    public_key_prefix: string;
    signature: string;
    type: string;
}

/** Raw `/api/v1/schedules/{id}` response (and list entries). */
export interface MirrorScheduleResponse {
    admin_key?: { key: string; _type?: string } | null;
    consensus_timestamp: string;
    creator_account_id: string;
    deleted: boolean;
    executed_timestamp: string | null;
    expiration_time: string | null;
    memo: string;
    payer_account_id: string;
    schedule_id: string;
    signatures: MirrorScheduleSignature[];
    transaction_body: string;
    wait_for_expiry: boolean;
}

/** Raw `/api/v1/topics/{id}` response. */
export interface MirrorTopicResponse {
    admin_key?: { key: string; _type?: string } | null;
    auto_renew_account: string | null;
    auto_renew_period: number | null;
    created_timestamp: string | null;
    custom_fees?: {
        created_timestamp?: string;
        fixed_fees?: Array<{
            amount: number;
            collector_account_id: string;
            denominating_token_id: string | null;
        }>;
    };
    deleted: boolean | null;
    fee_exempt_key_list?: Array<{ key: string; _type?: string }>;
    fee_schedule_key?: { key: string; _type?: string } | null;
    memo: string;
    submit_key?: { key: string; _type?: string } | null;
    timestamp?: MirrorTimestampRange;
    topic_id: string;
}

/** Raw `/api/v1/network/fees` response. */
export interface MirrorNetworkFeesResponse {
    fees: Array<{ gas: number; transaction_type: string }>;
    timestamp: string;
}

/** A single entry in the raw NFT transaction history. */
export interface MirrorNftTransaction {
    consensus_timestamp: string;
    is_approval?: boolean;
    nonce?: number;
    receiver_account_id: string;
    sender_account_id: string | null;
    transaction_id: string;
    type: string;
}

/** A single entry in the raw `/api/v1/blocks` response. */
export interface MirrorBlock {
    count: number;
    gas_used: number | null;
    hapi_version: string | null;
    hash: string;
    logs_bloom: string | null;
    name: string;
    number: number;
    previous_hash: string;
    size: number | null;
    timestamp: MirrorTimestampRange;
}

/** A single entry in the raw `/api/v1/accounts/{id}/hooks` response. */
export interface MirrorHook {
    admin_key?: { key: string; _type?: string } | null;
    contract_id: string | null;
    created_timestamp: string | null;
    deleted: boolean;
    extension_point: string;
    hook_id: number;
    owner_id: string | null;
    timestamp_range: MirrorTimestampRange;
    type: string;
}

/** A single slot in the raw hook storage response. */
export interface MirrorHookStorageSlot {
    key: string;
    value: string | null;
    timestamp: string;
}

/** A raw endpoint served by a registered node (richer than consensus
 * node endpoints: role flags, TLS requirement). */
export interface MirrorRegisteredServiceEndpoint {
    block_node?: boolean;
    /** Block-node variant: APIs the endpoint exposes */
    endpoint_apis?: string[];
    /** General-service variant: what the endpoint serves */
    description?: string | null;
    domain_name?: string | null;
    general_service?: boolean;
    ip_address?: string | null;
    mirror_node?: boolean;
    port?: number;
    requires_tls?: boolean;
    rpc_relay?: boolean;
    type?: string;
}

/** A single entry in the raw `/api/v1/network/registered-nodes` response. */
export interface MirrorRegisteredNode {
    admin_key?: { key: string; _type?: string } | null;
    created_timestamp: string | null;
    description: string | null;
    registered_node_id: number;
    service_endpoints: MirrorRegisteredServiceEndpoint[];
    timestamp: MirrorTimestampRange;
}

/** A contract entity in the raw `/api/v1/contracts` response. */
export interface MirrorContractRaw {
    admin_key?: { key: string; _type?: string } | null;
    auto_renew_account: string | null;
    auto_renew_period: number | null;
    contract_id: string;
    created_timestamp: string | null;
    deleted: boolean;
    evm_address: string;
    expiration_timestamp: string | null;
    file_id: string | null;
    max_automatic_token_associations: number | null;
    memo: string;
    nonce: number | null;
    obtainer_id: string | null;
    permanent_removal: boolean | null;
    proxy_account_id?: string | null;
    timestamp: MirrorTimestampRange;
}

/** Raw `/api/v1/contracts/{id}` response — contract plus bytecode. */
export interface MirrorContractResponse extends MirrorContractRaw {
    bytecode: string | null;
    runtime_bytecode: string | null;
}

/** A raw EIP-2930 access-list entry on a wrapped ethereum transaction. */
export interface MirrorAccessListEntry {
    address: string;
    storage_keys: string[];
}

/** A raw EIP-7702 authorization on a wrapped ethereum transaction. */
export interface MirrorAuthorizationListEntry {
    address: string;
    chain_id: string;
    nonce: number;
    r: string;
    s: string;
    y_parity: string;
}

/**
 * A single entry in the raw contract result listings.
 *
 * The spec models list rows and `/contracts/results/{id}` details as
 * one schema, but the mirror node serves only a 15-field subset on
 * LIST rows (verified live): the block/ethereum-envelope fields and
 * `result`/`status` arrive only on details. Those are optional here
 * and re-required on `MirrorContractResultDetails`.
 */
export interface MirrorContractResult {
    access_list?: MirrorAccessListEntry[] | null;
    address?: string;
    authorization_list?: MirrorAuthorizationListEntry[] | null;
    amount: number | null;
    block_gas_used?: number | null;
    block_hash?: string | null;
    block_number?: number | null;
    bloom?: string | null;
    call_result?: string | null;
    chain_id?: string | null;
    contract_id: string | null;
    created_contract_ids?: string[] | null;
    error_message?: string | null;
    failed_initcode?: string | null;
    from: string | null;
    function_parameters?: string | null;
    gas_consumed?: number | null;
    gas_limit: number;
    gas_price?: string | null;
    gas_used: number | null;
    hash: string;
    max_fee_per_gas?: string | null;
    max_priority_fee_per_gas?: string | null;
    nonce?: number | null;
    r?: string | null;
    result?: string;
    s?: string | null;
    status?: string;
    timestamp: string;
    to: string | null;
    transaction_index?: number | null;
    type?: number | null;
    v?: number | null;
}

/** A raw log entry inside a contract result detail. */
export interface MirrorContractResultLog {
    address: string;
    bloom?: string | null;
    contract_id: string | null;
    data: string | null;
    index: number;
    topics: string[];
}

/** A raw storage change inside a contract result detail. */
export interface MirrorContractStateChange {
    address: string;
    contract_id: string | null;
    slot: string;
    value_read: string;
    value_written: string | null;
}

/** Raw detailed contract result (single-result endpoints). */
export interface MirrorContractResultDetails extends MirrorContractResult {
    // Detail responses always carry the fields the list omits.
    block_gas_used: number | null;
    block_hash: string | null;
    block_number: number | null;
    chain_id: string | null;
    gas_price: string | null;
    max_fee_per_gas: string | null;
    max_priority_fee_per_gas: string | null;
    nonce: number | null;
    result: string;
    status: string;
    transaction_index: number | null;
    type: number | null;
    logs?: MirrorContractResultLog[];
    state_changes?: MirrorContractStateChange[];
}

/** A single entry in the raw contract log listings. */
export interface MirrorContractLog extends MirrorContractResultLog {
    block_hash: string;
    block_number: number;
    root_contract_id?: string | null;
    timestamp: string;
    transaction_hash: string;
    transaction_index: number | null;
}

/** A single slot in the raw `/api/v1/contracts/{id}/state` response. */
export interface MirrorContractState {
    address: string;
    contract_id: string | null;
    timestamp: string;
    slot: string;
    value: string;
}

/** A single entry in the raw contract actions response. */
export interface MirrorContractAction {
    call_depth: number;
    call_operation_type: string;
    call_type: string;
    caller: string | null;
    caller_type: string;
    from: string;
    gas: number;
    gas_used: number;
    index: number;
    input: string | null;
    recipient: string | null;
    recipient_type: string | null;
    result_data: string | null;
    result_data_type: string;
    timestamp: string;
    to: string | null;
    value: number;
}

/** A single opcode step in the raw opcode trace response. */
export interface MirrorOpcode {
    depth: number;
    gas: number;
    gas_cost: number;
    memory: string[] | null;
    op: string;
    pc: number;
    reason?: string | null;
    stack: string[] | null;
    storage: Record<string, string> | null;
}

/** Raw `/api/v1/contracts/results/{id}/opcodes` response. */
export interface MirrorOpcodesResponse {
    address: string;
    contract_id: string | null;
    failed: boolean;
    gas: number;
    opcodes: MirrorOpcode[];
    return_value: string;
}

/** Raw `POST /api/v1/contracts/call` response. */
export interface MirrorContractCallResponse {
    result: string;
}

/** A single entry in the raw `/api/v1/accounts/{id}/rewards` response. */
export interface MirrorStakingReward {
    account_id: string | null;
    amount: number;
    timestamp: string;
}

/** A raw itemized extra fee inside a fee-estimate component. */
export interface MirrorFeeExtra {
    charged: number;
    count: number;
    fee_per_unit: number;
    included: number;
    name: string;
    subtotal: number;
}

/** A raw node/service fee-estimate component. */
export interface MirrorFeeEstimateComponent {
    base: number;
    extras: MirrorFeeExtra[];
}

/** Raw `POST /api/v1/network/fees` response. */
export interface MirrorFeeEstimateResponse {
    high_volume_multiplier: number;
    network: { multiplier: number; subtotal: number };
    node: MirrorFeeEstimateComponent;
    service: MirrorFeeEstimateComponent;
    total: number;
}
