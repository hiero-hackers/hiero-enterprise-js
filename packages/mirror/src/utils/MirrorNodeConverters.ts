import type {
    MirrorAccountInfo,
    Balance,
    TokenBalance,
    Nft,
    MirrorTokenInfo,
    MirrorTopicMessage,
    TransactionInfo,
    Transfer,
    TokenTransferInfo,
    NftTransferInfo,
    StakingRewardTransfer,
    ExchangeRate,
    NetworkStake,
    PageData,
    MirrorCustomFee,
    MirrorFixedFee,
    MirrorFractionalFee,
    MirrorRoyaltyFee,
    MirrorPageResponse,
    MirrorAccountResponse,
    MirrorNft,
    MirrorTokenResponse,
    MirrorTopicMessageRaw,
    MirrorTransaction,
    MirrorTransfer,
    MirrorTokenTransfer,
    MirrorNftTransfer,
    MirrorStakingRewardTransfer,
    MirrorExchangeRate,
    MirrorNetworkStakeResponse,
    MirrorTokenHolderBalance,
    MirrorAccountTokenBalance,
    MirrorNetworkNode,
    NetworkNode,
    TokenHolder,
    AccountBalanceSnapshot,
    MirrorAccountBalanceSnapshot,
    Airdrop,
    MirrorAirdrop,
    CryptoAllowance,
    MirrorCryptoAllowance,
    TokenAllowance,
    MirrorTokenAllowance,
    NftAllowance,
    MirrorNftAllowance,
    MirrorSchedule,
    MirrorScheduleResponse,
    MirrorTopicInfo,
    MirrorTopicResponse,
    NetworkFees,
    MirrorNetworkFeesResponse,
    NftTransaction,
    MirrorNftTransaction,
    Block,
    MirrorBlock,
    Hook,
    MirrorHook,
    HookStorageSlot,
    MirrorHookStorageSlot,
    RegisteredNode,
    MirrorRegisteredNode,
    MirrorContract,
    MirrorContractRaw,
    MirrorContractDetail,
    MirrorContractResponse,
    ContractResult,
    MirrorContractResult,
    ContractResultDetails,
    MirrorContractResultDetails,
    ContractLogEntry,
    MirrorContractResultLog,
    ContractLog,
    MirrorContractLog,
    ContractStateEntry,
    MirrorContractState,
    ContractAction,
    MirrorContractAction,
    OpcodeTrace,
    MirrorOpcodesResponse,
    StakingReward,
    MirrorStakingReward,
    ServiceEndpoint,
    MirrorServiceEndpoint,
    FeeEstimate,
    FeeEstimateComponent,
    MirrorFeeEstimateComponent,
    MirrorFeeEstimateResponse,
    MirrorKey,
} from "../types/index.js";

// ─── Keys ────────────────────────────────────────────────────────

/**
 * Convert a raw mirror-node key object (`{ _type, key }`) to a
 * {@link MirrorKey}, preserving the key algorithm. Returns `undefined` when
 * the key is absent/null, matching the optional key fields on the domain
 * types.
 */
export function convertKey(
    raw: { key: string; _type?: string } | null | undefined,
): MirrorKey | undefined {
    if (!raw) return undefined;
    // Omit `type` entirely when the wire carries no `_type`, rather than
    // emitting `type: undefined` — keeps the object shape honest for
    // property-presence checks and strict deep-equality.
    return raw._type === undefined
        ? { key: raw.key }
        : { key: raw.key, type: raw._type };
}

// ─── Page ────────────────────────────────────────────────────────

export function convertPage<TRaw, TOut>(
    raw: MirrorPageResponse<TRaw>,
    converter: (item: TRaw) => TOut,
): PageData<TOut> {
    // The mirror node returns arrays under different keys (nfts, tokens, messages, transactions).
    // Find the first array value that isn't 'links'.
    const dataEntry = Object.entries(raw).find(
        ([key, value]) => key !== "links" && Array.isArray(value),
    );
    const items = dataEntry ? (dataEntry[1] as TRaw[]) : [];
    return {
        data: items.map(converter),
        links: { next: raw.links?.next ?? null },
        // Snapshot endpoints (/balances, /tokens/{id}/balances) report the
        // moment the figures describe at the top level — carry it through.
        ...(typeof raw.timestamp === "string" || raw.timestamp === null
            ? { timestamp: raw.timestamp as string | null }
            : {}),
    };
}

// ─── Accounts ────────────────────────────────────────────────────

export function convertAccountInfo(
    raw: MirrorAccountResponse,
): MirrorAccountInfo {
    return {
        accountId: raw.account,
        evmAddress: raw.evm_address,
        alias: raw.alias,
        delegationAddress: raw.delegation_address ?? undefined,
        key: convertKey(raw.key),
        balance: raw.balance?.balance ?? 0,
        deleted: raw.deleted ?? false,
        autoRenewPeriod: raw.auto_renew_period,
        memo: raw.memo,
        maxAutomaticTokenAssociations: raw.max_automatic_token_associations,
        stakedAccountId: raw.staked_account_id,
        stakedNodeId: raw.staked_node_id,
        stakePeriodStart: raw.stake_period_start,
        createdTimestamp: raw.created_timestamp,
        expirationTimestamp: raw.expiry_timestamp,
        declineReward: raw.decline_reward,
        ethereumNonce: raw.ethereum_nonce,
        pendingReward: raw.pending_reward,
        receiverSigRequired: raw.receiver_sig_required,
    };
}

export function convertBalance(
    accountId: string,
    raw: MirrorAccountResponse,
): Balance {
    const tokens: TokenBalance[] = (raw.balance?.tokens ?? []).map((t) => ({
        tokenId: t.token_id,
        balance: String(t.balance),
        decimals: t.decimals,
    }));
    return {
        accountId,
        hbars: String(raw.balance?.balance ?? 0),
        timestamp: raw.balance?.timestamp,
        tokens,
    };
}

export function convertTokenHolder(raw: MirrorTokenHolderBalance): TokenHolder {
    return {
        accountId: raw.account,
        balance: String(raw.balance),
        decimals: raw.decimals ?? undefined,
    };
}

function convertServiceEndpoint(raw: MirrorServiceEndpoint): ServiceEndpoint {
    return {
        ipAddressV4: raw.ip_address_v4,
        port: raw.port,
        domainName: raw.domain_name,
    };
}

export function convertNetworkNode(raw: MirrorNetworkNode): NetworkNode {
    return {
        nodeId: raw.node_id,
        nodeAccountId: raw.node_account_id,
        description: raw.description,
        stake: raw.stake,
        minStake: raw.min_stake,
        maxStake: raw.max_stake,
        stakeRewarded: raw.stake_rewarded,
        stakeNotRewarded: raw.stake_not_rewarded,
        adminKey: convertKey(raw.admin_key),
        associatedRegisteredNodes: raw.associated_registered_nodes,
        declineReward: raw.decline_reward,
        fileId: raw.file_id,
        grpcProxyEndpoint:
            raw.grpc_proxy_endpoint === null
                ? null
                : raw.grpc_proxy_endpoint &&
                  convertServiceEndpoint(raw.grpc_proxy_endpoint),
        memo: raw.memo,
        nodeCertHash: raw.node_cert_hash,
        publicKey: raw.public_key,
        rewardRateStart: raw.reward_rate_start,
        serviceEndpoints: raw.service_endpoints?.map(convertServiceEndpoint),
        stakingPeriod: raw.staking_period,
        timestamp: raw.timestamp,
    };
}

export function convertAccountTokenBalance(
    raw: MirrorAccountTokenBalance,
): TokenBalance {
    return {
        tokenId: raw.token_id,
        balance: String(raw.balance),
        decimals: raw.decimals ?? 0,
        automaticAssociation: raw.automatic_association ?? undefined,
        createdTimestamp: raw.created_timestamp ?? undefined,
        freezeStatus: raw.freeze_status ?? undefined,
        kycStatus: raw.kyc_status ?? undefined,
    };
}

// ─── NFTs ────────────────────────────────────────────────────────

export function convertNft(raw: MirrorNft): Nft {
    return {
        tokenId: raw.token_id,
        serialNumber: raw.serial_number,
        accountId: raw.account_id,
        metadata: raw.metadata,
        createdTimestamp: raw.created_timestamp,
        modifiedTimestamp: raw.modified_timestamp,
        deleted: raw.deleted,
        delegatingSpender: raw.delegating_spender,
        spender: raw.spender,
    };
}

// ─── Tokens ──────────────────────────────────────────────────────

/** Epoch nanoseconds (as a JS number) → "seconds.nnnnnnnnn". */
function nanosToTimestamp(nanos: number): string {
    const seconds = Math.floor(nanos / 1e9);
    const remainder = Math.round(nanos - seconds * 1e9);
    return `${seconds}.${String(remainder).padStart(9, "0")}`;
}

export function convertTokenInfo(raw: MirrorTokenResponse): MirrorTokenInfo {
    const customFees: MirrorCustomFee[] = [];
    if (raw.custom_fees) {
        for (const f of raw.custom_fees.fixed_fees ?? []) {
            const fee: MirrorFixedFee = {
                type: "fixed",
                amount: f.amount,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt ?? false,
                denominatingTokenId: f.denominating_token_id,
            };
            customFees.push(fee);
        }
        for (const f of raw.custom_fees.fractional_fees ?? []) {
            const fee: MirrorFractionalFee = {
                type: "fractional",
                // The mirror node nests the fraction under `amount`.
                numerator: f.amount?.numerator,
                denominator: f.amount?.denominator,
                min: f.minimum,
                max: f.maximum,
                netOfTransfers: f.net_of_transfers,
                collectorAccountId: f.collector_account_id,
                denominatingTokenId: f.denominating_token_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt ?? false,
            };
            customFees.push(fee);
        }
        for (const f of raw.custom_fees.royalty_fees ?? []) {
            const fee: MirrorRoyaltyFee = {
                type: "royalty",
                numerator: f.amount?.numerator,
                denominator: f.amount?.denominator,
                fallbackFee: f.fallback_fee
                    ? {
                          amount: f.fallback_fee.amount,
                          denominatingTokenId:
                              f.fallback_fee.denominating_token_id ?? undefined,
                      }
                    : undefined,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt ?? false,
            };
            customFees.push(fee);
        }
    }

    return {
        tokenId: raw.token_id,
        name: raw.name,
        symbol: raw.symbol,
        type:
            raw.type === "NON_FUNGIBLE_UNIQUE"
                ? "NON_FUNGIBLE_UNIQUE"
                : "FUNGIBLE_COMMON",
        decimals: parseInt(raw.decimals, 10),
        totalSupply: raw.total_supply,
        maxSupply: raw.max_supply,
        treasuryAccountId: raw.treasury_account_id,
        adminKey: convertKey(raw.admin_key),
        supplyKey: convertKey(raw.supply_key),
        freezeKey: convertKey(raw.freeze_key),
        wipeKey: convertKey(raw.wipe_key),
        kycKey: convertKey(raw.kyc_key),
        pauseKey: convertKey(raw.pause_key),
        feeScheduleKey: convertKey(raw.fee_schedule_key),
        deleted: raw.deleted,
        paused: raw.pause_status === "PAUSED",
        customFees,
        customFeesCreatedTimestamp: raw.custom_fees?.created_timestamp,
        createdTimestamp: raw.created_timestamp,
        // Normalize the tokens-only numeric-nanoseconds form to the
        // canonical "seconds.nanoseconds" string used everywhere else.
        expirationTimestamp:
            typeof raw.expiry_timestamp === "number"
                ? nanosToTimestamp(raw.expiry_timestamp)
                : raw.expiry_timestamp,
        memo: raw.memo,
        autoRenewAccount: raw.auto_renew_account,
        autoRenewPeriod: raw.auto_renew_period,
        freezeDefault: raw.freeze_default,
        initialSupply: raw.initial_supply,
        metadata: raw.metadata,
        metadataKey: convertKey(raw.metadata_key),
        modifiedTimestamp: raw.modified_timestamp,
        supplyType: raw.supply_type,
    };
}

// ─── Topics ──────────────────────────────────────────────────────

export function convertTopicMessage(
    raw: MirrorTopicMessageRaw,
): MirrorTopicMessage {
    return {
        topicId: raw.topic_id,
        sequenceNumber: String(raw.sequence_number),
        message: raw.message,
        runningHash: raw.running_hash,
        consensusTimestamp: raw.consensus_timestamp,
        payerAccountId: raw.payer_account_id,
        chunkInfo:
            raw.chunk_info === null
                ? null
                : raw.chunk_info && {
                      initialTransactionId:
                          raw.chunk_info.initial_transaction_id === null
                              ? null
                              : {
                                    accountId:
                                        raw.chunk_info.initial_transaction_id
                                            .account_id,
                                    nonce: raw.chunk_info.initial_transaction_id
                                        .nonce,
                                    scheduled:
                                        raw.chunk_info.initial_transaction_id
                                            .scheduled,
                                    transactionValidStart:
                                        raw.chunk_info.initial_transaction_id
                                            .transaction_valid_start,
                                },
                      number: raw.chunk_info.number,
                      total: raw.chunk_info.total,
                  },
        runningHashVersion: raw.running_hash_version,
    };
}

// ─── Transactions ────────────────────────────────────────────────

export function convertTransactionInfo(
    raw: MirrorTransaction,
): TransactionInfo {
    return {
        transactionId: raw.transaction_id,
        type: raw.name?.toUpperCase().replace(/ /g, "") ?? "",
        name: raw.name ?? "",
        result: raw.result,
        consensusTimestamp: raw.consensus_timestamp,
        validStartTimestamp: raw.valid_start_timestamp,
        successful: raw.result === "SUCCESS",
        chargedTxFee: raw.charged_tx_fee,
        memo: raw.memo_base64 ? atob(raw.memo_base64) : undefined,
        transfers: (raw.transfers ?? []).map(convertTransfer),
        tokenTransfers: (raw.token_transfers ?? []).map(convertTokenTransfer),
        nftTransfers: (raw.nft_transfers ?? []).map(convertNftTransfer),
        stakingRewardTransfers: (raw.staking_reward_transfers ?? []).map(
            convertStakingRewardTransfer,
        ),
        // Preserve the absent (undefined) vs explicit-null distinction the
        // wire draws — only a present-but-null batch_key becomes `null`.
        batchKey:
            raw.batch_key === undefined
                ? undefined
                : (convertKey(raw.batch_key) ?? null),
        bytes: raw.bytes,
        entityId: raw.entity_id,
        highVolume: raw.high_volume,
        highVolumePricingMultiplier: raw.high_volume_pricing_multiplier,
        maxCustomFees: raw.max_custom_fees?.map((limit) => ({
            accountId: limit.account_id,
            amount: limit.amount,
            denominatingTokenId: limit.denominating_token_id,
        })),
        maxFee: raw.max_fee,
        node: raw.node,
        nonce: raw.nonce,
        parentConsensusTimestamp: raw.parent_consensus_timestamp,
        scheduled: raw.scheduled,
        transactionHash: raw.transaction_hash,
        validDurationSeconds: raw.valid_duration_seconds,
        assessedCustomFees: raw.assessed_custom_fees?.map((fee) => ({
            amount: fee.amount,
            collectorAccountId: fee.collector_account_id,
            effectivePayerAccountIds: fee.effective_payer_account_ids ?? [],
            tokenId: fee.token_id,
        })),
    };
}

function convertTransfer(raw: MirrorTransfer): Transfer {
    return {
        accountId: raw.account,
        amount: raw.amount,
        isApproval: raw.is_approval,
    };
}

function convertTokenTransfer(raw: MirrorTokenTransfer): TokenTransferInfo {
    return {
        tokenId: raw.token_id,
        accountId: raw.account,
        amount: raw.amount,
        isApproval: raw.is_approval,
    };
}

function convertNftTransfer(raw: MirrorNftTransfer): NftTransferInfo {
    return {
        tokenId: raw.token_id,
        serialNumber: raw.serial_number,
        senderAccountId: raw.sender_account_id,
        receiverAccountId: raw.receiver_account_id,
        isApproval: raw.is_approval,
    };
}

function convertStakingRewardTransfer(
    raw: MirrorStakingRewardTransfer,
): StakingRewardTransfer {
    return {
        accountId: raw.account,
        amount: raw.amount,
    };
}

// ─── Network ─────────────────────────────────────────────────────

export function convertExchangeRate(raw: MirrorExchangeRate): ExchangeRate {
    return {
        hbarEquivalent: raw.hbar_equivalent,
        centEquivalent: raw.cent_equivalent,
        expirationTime: String(raw.expiration_time),
    };
}

export function convertNetworkStake(
    raw: MirrorNetworkStakeResponse,
): NetworkStake {
    return {
        maxStakeRewarded: raw.max_stake_rewarded,
        maxStakingRewardRatePerHbar: raw.max_staking_reward_rate_per_hbar,
        maxTotalReward: raw.max_total_reward,
        nodeRewardFeeFraction: raw.node_reward_fee_fraction,
        reservedStakingRewards: raw.reserved_staking_rewards,
        rewardBalanceThreshold: raw.reward_balance_threshold,
        stakeTotal: raw.stake_total,
        stakingPeriod: raw.staking_period,
        stakingPeriodDuration: raw.staking_period_duration,
        stakingPeriodsStored: raw.staking_periods_stored,
        stakingRewardFeeFraction: raw.staking_reward_fee_fraction,
        stakingRewardRate: raw.staking_reward_rate,
        stakingStartThreshold: raw.staking_start_threshold,
        unreservedStakingRewardBalance: raw.unreserved_staking_reward_balance,
    };
}

export function convertAccountBalanceSnapshot(
    raw: MirrorAccountBalanceSnapshot,
): AccountBalanceSnapshot {
    return {
        accountId: raw.account,
        balance: raw.balance,
        tokens: (raw.tokens ?? []).map((token) => ({
            tokenId: token.token_id,
            balance: token.balance,
        })),
    };
}

export function convertAirdrop(raw: MirrorAirdrop): Airdrop {
    return {
        amount: raw.amount,
        receiverId: raw.receiver_id,
        senderId: raw.sender_id,
        serialNumber: raw.serial_number,
        tokenId: raw.token_id,
        timestamp: raw.timestamp,
    };
}

export function convertCryptoAllowance(
    raw: MirrorCryptoAllowance,
): CryptoAllowance {
    return {
        amount: raw.amount,
        amountGranted: raw.amount_granted,
        owner: raw.owner,
        spender: raw.spender,
        timestamp: raw.timestamp,
    };
}

export function convertTokenAllowance(
    raw: MirrorTokenAllowance,
): TokenAllowance {
    return {
        ...convertCryptoAllowance(raw),
        tokenId: raw.token_id,
    };
}

export function convertNftAllowance(raw: MirrorNftAllowance): NftAllowance {
    return {
        approvedForAll: raw.approved_for_all,
        owner: raw.owner,
        spender: raw.spender,
        tokenId: raw.token_id,
        timestamp: raw.timestamp,
    };
}

export function convertSchedule(raw: MirrorScheduleResponse): MirrorSchedule {
    return {
        adminKey: convertKey(raw.admin_key),
        consensusTimestamp: raw.consensus_timestamp,
        creatorAccountId: raw.creator_account_id,
        deleted: raw.deleted,
        executedTimestamp: raw.executed_timestamp,
        expirationTime: raw.expiration_time,
        memo: raw.memo,
        payerAccountId: raw.payer_account_id,
        scheduleId: raw.schedule_id,
        signatures: (raw.signatures ?? []).map((signature) => ({
            consensusTimestamp: signature.consensus_timestamp,
            publicKeyPrefix: signature.public_key_prefix,
            signature: signature.signature,
            type: signature.type,
        })),
        transactionBody: raw.transaction_body,
        waitForExpiry: raw.wait_for_expiry,
    };
}

export function convertTopicInfo(raw: MirrorTopicResponse): MirrorTopicInfo {
    return {
        adminKey: convertKey(raw.admin_key),
        autoRenewAccount: raw.auto_renew_account,
        autoRenewPeriod: raw.auto_renew_period,
        createdTimestamp: raw.created_timestamp,
        deleted: raw.deleted,
        // Each wire entry always carries `key`, so convertKey never returns
        // undefined here; the assertion keeps the array typed as MirrorKey[].
        feeExemptKeyList: raw.fee_exempt_key_list?.map((k) => convertKey(k)!),
        feeScheduleKey: convertKey(raw.fee_schedule_key),
        customFeesCreatedTimestamp: raw.custom_fees?.created_timestamp,
        fixedFees: raw.custom_fees?.fixed_fees?.map((fee) => ({
            amount: fee.amount,
            collectorAccountId: fee.collector_account_id,
            denominatingTokenId: fee.denominating_token_id,
        })),
        memo: raw.memo,
        submitKey: convertKey(raw.submit_key),
        timestamp: raw.timestamp,
        topicId: raw.topic_id,
    };
}

export function convertNetworkFees(
    raw: MirrorNetworkFeesResponse,
): NetworkFees {
    return {
        timestamp: raw.timestamp,
        fees: (raw.fees ?? []).map((fee) => ({
            gas: fee.gas,
            transactionType: fee.transaction_type,
        })),
    };
}

export function convertNftTransaction(
    raw: MirrorNftTransaction,
): NftTransaction {
    return {
        consensusTimestamp: raw.consensus_timestamp,
        isApproval: raw.is_approval,
        nonce: raw.nonce,
        receiverAccountId: raw.receiver_account_id,
        senderAccountId: raw.sender_account_id,
        transactionId: raw.transaction_id,
        type: raw.type,
    };
}

// ─── Blocks ──────────────────────────────────────────────────────

export function convertBlock(raw: MirrorBlock): Block {
    return {
        count: raw.count,
        gasUsed: raw.gas_used,
        hapiVersion: raw.hapi_version,
        hash: raw.hash,
        logsBloom: raw.logs_bloom,
        name: raw.name,
        number: raw.number,
        previousHash: raw.previous_hash,
        size: raw.size,
        timestamp: raw.timestamp,
    };
}

// ─── Hooks ───────────────────────────────────────────────────────

export function convertHook(raw: MirrorHook): Hook {
    return {
        adminKey: convertKey(raw.admin_key),
        contractId: raw.contract_id,
        createdTimestamp: raw.created_timestamp,
        deleted: raw.deleted,
        extensionPoint: raw.extension_point,
        hookId: raw.hook_id,
        ownerId: raw.owner_id,
        timestampRange: raw.timestamp_range,
        type: raw.type,
    };
}

export function convertHookStorageSlot(
    raw: MirrorHookStorageSlot,
): HookStorageSlot {
    return {
        key: raw.key,
        value: raw.value,
        timestamp: raw.timestamp,
    };
}

// ─── Registered nodes ────────────────────────────────────────────

export function convertRegisteredNode(
    raw: MirrorRegisteredNode,
): RegisteredNode {
    return {
        adminKey: convertKey(raw.admin_key),
        createdTimestamp: raw.created_timestamp,
        description: raw.description,
        registeredNodeId: raw.registered_node_id,
        serviceEndpoints: (raw.service_endpoints ?? []).map((endpoint) => ({
            blockNode: endpoint.block_node,
            endpointApis: endpoint.endpoint_apis,
            description: endpoint.description,
            domainName: endpoint.domain_name,
            generalService: endpoint.general_service,
            ipAddress: endpoint.ip_address,
            mirrorNode: endpoint.mirror_node,
            port: endpoint.port,
            requiresTls: endpoint.requires_tls,
            rpcRelay: endpoint.rpc_relay,
            type: endpoint.type,
        })),
        timestamp: raw.timestamp,
    };
}

// ─── Contracts ───────────────────────────────────────────────────

export function convertContract(raw: MirrorContractRaw): MirrorContract {
    return {
        adminKey: convertKey(raw.admin_key),
        autoRenewAccount: raw.auto_renew_account,
        autoRenewPeriod: raw.auto_renew_period,
        contractId: raw.contract_id,
        createdTimestamp: raw.created_timestamp,
        deleted: raw.deleted,
        evmAddress: raw.evm_address,
        expirationTimestamp: raw.expiration_timestamp,
        fileId: raw.file_id,
        maxAutomaticTokenAssociations: raw.max_automatic_token_associations,
        memo: raw.memo,
        nonce: raw.nonce,
        obtainerId: raw.obtainer_id,
        proxyAccountId: raw.proxy_account_id ?? null,
        permanentRemoval: raw.permanent_removal,
        timestamp: raw.timestamp,
    };
}

export function convertContractDetail(
    raw: MirrorContractResponse,
): MirrorContractDetail {
    return {
        ...convertContract(raw),
        bytecode: raw.bytecode,
        runtimeBytecode: raw.runtime_bytecode,
    };
}

export function convertContractResult(
    raw: MirrorContractResult,
): ContractResult {
    return {
        accessList:
            raw.access_list === null
                ? null
                : raw.access_list?.map((entry) => ({
                      address: entry.address,
                      storageKeys: entry.storage_keys ?? [],
                  })),
        address: raw.address,
        authorizationList:
            raw.authorization_list === null
                ? null
                : raw.authorization_list?.map((entry) => ({
                      address: entry.address,
                      chainId: entry.chain_id,
                      nonce: entry.nonce,
                      r: entry.r,
                      s: entry.s,
                      yParity: entry.y_parity,
                  })),
        amount: raw.amount,
        blockGasUsed: raw.block_gas_used,
        blockHash: raw.block_hash,
        blockNumber: raw.block_number,
        bloom: raw.bloom,
        callResult: raw.call_result,
        chainId: raw.chain_id,
        contractId: raw.contract_id,
        createdContractIds: raw.created_contract_ids,
        errorMessage: raw.error_message,
        failedInitcode: raw.failed_initcode ?? undefined,
        from: raw.from,
        functionParameters: raw.function_parameters,
        gasConsumed: raw.gas_consumed,
        gasLimit: raw.gas_limit,
        gasPrice: raw.gas_price,
        gasUsed: raw.gas_used,
        hash: raw.hash,
        maxFeePerGas: raw.max_fee_per_gas,
        maxPriorityFeePerGas: raw.max_priority_fee_per_gas,
        nonce: raw.nonce,
        r: raw.r,
        result: raw.result,
        s: raw.s,
        status: raw.status,
        timestamp: raw.timestamp,
        to: raw.to,
        transactionIndex: raw.transaction_index,
        type: raw.type,
        v: raw.v,
    };
}

export function convertContractLogEntry(
    raw: MirrorContractResultLog,
): ContractLogEntry {
    return {
        address: raw.address,
        bloom: raw.bloom,
        contractId: raw.contract_id,
        data: raw.data,
        index: raw.index,
        topics: raw.topics ?? [],
    };
}

export function convertContractResultDetails(
    raw: MirrorContractResultDetails,
): ContractResultDetails {
    return {
        ...convertContractResult(raw),
        // Present on every detail response (re-required on the detail
        // types; optional on the base because LIST rows omit them).
        blockGasUsed: raw.block_gas_used,
        blockHash: raw.block_hash,
        blockNumber: raw.block_number,
        chainId: raw.chain_id,
        gasPrice: raw.gas_price,
        maxFeePerGas: raw.max_fee_per_gas,
        maxPriorityFeePerGas: raw.max_priority_fee_per_gas,
        nonce: raw.nonce,
        result: raw.result,
        status: raw.status,
        transactionIndex: raw.transaction_index,
        type: raw.type,
        logs: (raw.logs ?? []).map(convertContractLogEntry),
        stateChanges: (raw.state_changes ?? []).map((change) => ({
            address: change.address,
            contractId: change.contract_id,
            slot: change.slot,
            valueRead: change.value_read,
            valueWritten: change.value_written,
        })),
    };
}

export function convertContractLog(raw: MirrorContractLog): ContractLog {
    return {
        ...convertContractLogEntry(raw),
        blockHash: raw.block_hash,
        blockNumber: raw.block_number,
        rootContractId: raw.root_contract_id,
        timestamp: raw.timestamp,
        transactionHash: raw.transaction_hash,
        transactionIndex: raw.transaction_index,
    };
}

export function convertContractState(
    raw: MirrorContractState,
): ContractStateEntry {
    return {
        address: raw.address,
        contractId: raw.contract_id,
        timestamp: raw.timestamp,
        slot: raw.slot,
        value: raw.value,
    };
}

export function convertContractAction(
    raw: MirrorContractAction,
): ContractAction {
    return {
        callDepth: raw.call_depth,
        callOperationType: raw.call_operation_type,
        callType: raw.call_type,
        caller: raw.caller,
        callerType: raw.caller_type,
        from: raw.from,
        gas: raw.gas,
        gasUsed: raw.gas_used,
        index: raw.index,
        input: raw.input,
        recipient: raw.recipient,
        recipientType: raw.recipient_type,
        resultData: raw.result_data,
        resultDataType: raw.result_data_type,
        timestamp: raw.timestamp,
        to: raw.to,
        value: raw.value,
    };
}

export function convertStakingReward(raw: MirrorStakingReward): StakingReward {
    return {
        accountId: raw.account_id,
        amount: raw.amount,
        timestamp: raw.timestamp,
    };
}

function convertFeeEstimateComponent(
    raw: MirrorFeeEstimateComponent,
): FeeEstimateComponent {
    return {
        base: raw.base,
        extras: (raw.extras ?? []).map((extra) => ({
            charged: extra.charged,
            count: extra.count,
            feePerUnit: extra.fee_per_unit,
            included: extra.included,
            name: extra.name,
            subtotal: extra.subtotal,
        })),
    };
}

export function convertFeeEstimate(
    raw: MirrorFeeEstimateResponse,
): FeeEstimate {
    return {
        highVolumeMultiplier: raw.high_volume_multiplier,
        network: {
            multiplier: raw.network.multiplier,
            subtotal: raw.network.subtotal,
        },
        node: convertFeeEstimateComponent(raw.node),
        service: convertFeeEstimateComponent(raw.service),
        total: raw.total,
    };
}

export function convertOpcodeTrace(raw: MirrorOpcodesResponse): OpcodeTrace {
    return {
        address: raw.address,
        contractId: raw.contract_id,
        failed: raw.failed,
        gas: raw.gas,
        opcodes: (raw.opcodes ?? []).map((opcode) => ({
            depth: opcode.depth,
            gas: opcode.gas,
            gasCost: opcode.gas_cost,
            memory: opcode.memory,
            op: opcode.op,
            pc: opcode.pc,
            reason: opcode.reason,
            stack: opcode.stack,
            storage: opcode.storage,
        })),
        returnValue: raw.return_value,
    };
}
