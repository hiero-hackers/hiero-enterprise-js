import type {
    AccountInfo,
    Balance,
    TokenBalance,
    Nft,
    TokenInfo,
    TopicMessage,
    TransactionInfo,
    Transfer,
    TokenTransferInfo,
    NftTransferInfo,
    StakingRewardTransfer,
    ExchangeRates,
    ExchangeRate,
    NetworkStake,
    NetworkSupplies,
    Page,
    CustomFee,
    FixedFee,
    FractionalFee,
    RoyaltyFee,
} from "../data/index.js";
import { HieroError } from "../errors/index.js";

/**
 * HTTP client for querying the Hiero Mirror Node REST API.
 */
export class MirrorNodeClient {
    private readonly baseUrl: string;

    constructor(baseUrl: string) {
        // Remove trailing slash
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    // ─── HTTP Helper ─────────────────────────────────────────────

    private async fetch<T>(path: string): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        let response: Response;
        try {
            response = await fetch(url);
        } catch (err) {
            throw new HieroError(`Mirror node request failed: ${url}`, {
                code: "MIRROR_NODE_ERROR",
                context: path,
                cause: err instanceof Error ? err : undefined,
            });
        }
        if (!response.ok) {
            throw new HieroError(
                `Mirror node returned ${response.status}: ${response.statusText}`,
                { code: "MIRROR_NODE_HTTP_ERROR", context: path },
            );
        }
        return response.json() as Promise<T>;
    }

    // ─── Accounts ────────────────────────────────────────────────

    async queryAccount(accountId: string): Promise<AccountInfo> {
        const raw = await this.fetch<MirrorAccountResponse>(
            `/api/v1/accounts/${accountId}`,
        );
        return convertAccountInfo(raw);
    }

    async queryAccountBalance(accountId: string): Promise<Balance> {
        const raw = await this.fetch<MirrorAccountResponse>(
            `/api/v1/accounts/${accountId}`,
        );
        return convertBalance(accountId, raw);
    }

    // ─── NFTs ────────────────────────────────────────────────────

    async queryNftsByAccount(accountId: string): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/accounts/${accountId}/nfts`,
        );
        return convertPage(raw, convertNft);
    }

    async queryNftsByTokenId(tokenId: string): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/tokens/${tokenId}/nfts`,
        );
        return convertPage(raw, convertNft);
    }

    async queryNftsByTokenIdAndSerial(
        tokenId: string,
        serialNumber: number,
    ): Promise<Nft> {
        const raw = await this.fetch<MirrorNft>(
            `/api/v1/tokens/${tokenId}/nfts/${serialNumber}`,
        );
        return convertNft(raw);
    }

    async queryNftsByAccountAndTokenId(
        accountId: string,
        tokenId: string,
    ): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}`,
        );
        return convertPage(raw, convertNft);
    }

    // ─── Tokens ──────────────────────────────────────────────────

    async queryTokenById(tokenId: string): Promise<TokenInfo> {
        const raw = await this.fetch<MirrorTokenResponse>(
            `/api/v1/tokens/${tokenId}`,
        );
        return convertTokenInfo(raw);
    }

    async queryTokensByAccountId(accountId: string): Promise<Page<TokenInfo>> {
        // The mirror node exposes token relationships via balances
        const raw = await this.fetch<MirrorPageResponse<MirrorTokenResponse>>(
            `/api/v1/tokens?account.id=${accountId}`,
        );
        return convertPage(raw, convertTokenInfo);
    }

    // ─── Topics ──────────────────────────────────────────────────

    async queryTopicMessages(topicId: string): Promise<Page<TopicMessage>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTopicMessage>>(
            `/api/v1/topics/${topicId}/messages`,
        );
        return convertPage(raw, convertTopicMessage);
    }

    async queryTopicMessageBySequence(
        topicId: string,
        sequenceNumber: number,
    ): Promise<TopicMessage> {
        const raw = await this.fetch<MirrorTopicMessage>(
            `/api/v1/topics/${topicId}/messages/${sequenceNumber}`,
        );
        return convertTopicMessage(raw);
    }

    // ─── Transactions ────────────────────────────────────────────

    async queryTransactionsByAccount(
        accountId: string,
    ): Promise<Page<TransactionInfo>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTransaction>>(
            `/api/v1/transactions?account.id=${accountId}`,
        );
        return convertPage(raw, convertTransactionInfo);
    }

    async queryTransactionsByAccountAndType(
        accountId: string,
        type: string,
    ): Promise<Page<TransactionInfo>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTransaction>>(
            `/api/v1/transactions?account.id=${accountId}&transactiontype=${type}`,
        );
        return convertPage(raw, convertTransactionInfo);
    }

    async queryTransaction(transactionId: string): Promise<TransactionInfo> {
        const raw = await this.fetch<MirrorTransactionListResponse>(
            `/api/v1/transactions/${transactionId}`,
        );
        if (!raw.transactions || raw.transactions.length === 0) {
            throw new HieroError(`Transaction not found: ${transactionId}`, {
                code: "NOT_FOUND",
            });
        }
        return convertTransactionInfo(raw.transactions[0]);
    }

    // ─── Network ─────────────────────────────────────────────────

    async queryExchangeRates(): Promise<ExchangeRates> {
        const raw = await this.fetch<MirrorExchangeRatesResponse>(
            "/api/v1/network/exchangerate",
        );
        return {
            currentRate: convertExchangeRate(raw.current_rate),
            nextRate: convertExchangeRate(raw.next_rate),
        };
    }

    async queryNetworkSupplies(): Promise<NetworkSupplies> {
        const raw = await this.fetch<MirrorNetworkSupplyResponse>(
            "/api/v1/network/supply",
        );
        return {
            releasedSupply: raw.released_supply,
            totalSupply: raw.total_supply,
            timestamp: raw.timestamp,
        };
    }

    async queryNetworkStake(): Promise<NetworkStake> {
        const raw = await this.fetch<MirrorNetworkStakeResponse>(
            "/api/v1/network/stake",
        );
        return convertNetworkStake(raw);
    }

    // ─── Pagination ──────────────────────────────────────────────

    /**
     * Fetch the next page of results using a pagination link.
     */
    async fetchNextPage<T>(
        nextLink: string,
        converter: (raw: unknown) => T,
    ): Promise<Page<T>> {
        const raw = await this.fetch<MirrorPageResponse<unknown>>(nextLink);
        return convertPage(raw, converter);
    }
}

// ─── Mirror Node Response Types ────────────────────────────────

interface MirrorPageResponse<_T> {
    [key: string]: unknown;
    links?: { next: string | null };
}

interface MirrorAccountResponse {
    account: string;
    alias?: string;
    evm_address?: string;
    key?: { key: string };
    balance?: { balance: number; tokens: MirrorTokenBalance[] };
    deleted?: boolean;
    auto_renew_period?: number;
    memo?: string;
    max_automatic_token_associations?: number;
    staked_account_id?: string;
    staked_node_id?: number;
    stake_period_start?: string;
    created_timestamp?: string;
    expiry_timestamp?: string;
}

interface MirrorTokenBalance {
    token_id: string;
    balance: number;
    decimals: number;
}

interface MirrorNft {
    token_id: string;
    serial_number: number;
    account_id: string;
    metadata: string;
    created_timestamp?: string;
    deleted: boolean;
    delegating_spender?: string;
    spender?: string;
}

interface MirrorTokenResponse {
    token_id: string;
    name: string;
    symbol: string;
    type: string;
    decimals: string;
    total_supply: string;
    max_supply: string;
    treasury_account_id: string;
    admin_key?: { key: string };
    supply_key?: { key: string };
    freeze_key?: { key: string };
    wipe_key?: { key: string };
    kyc_key?: { key: string };
    pause_key?: { key: string };
    fee_schedule_key?: { key: string };
    deleted: boolean;
    pause_status?: string;
    custom_fees?: {
        fixed_fees?: MirrorFixedFee[];
        fractional_fees?: MirrorFractionalFee[];
        royalty_fees?: MirrorRoyaltyFee[];
    };
    created_timestamp?: string;
    expiry_timestamp?: string;
    memo?: string;
}

interface MirrorFixedFee {
    amount: number;
    collector_account_id: string;
    denominating_token_id?: string;
    all_collectors_are_exempt: boolean;
}

interface MirrorFractionalFee {
    numerator: number;
    denominator: number;
    minimum?: number;
    maximum?: number;
    net_of_transfers: boolean;
    collector_account_id: string;
    all_collectors_are_exempt: boolean;
}

interface MirrorRoyaltyFee {
    numerator: number;
    denominator: number;
    fallback_fee?: { amount: number; denominating_token_id?: string };
    collector_account_id: string;
    all_collectors_are_exempt: boolean;
}

interface MirrorTopicMessage {
    topic_id: string;
    sequence_number: number;
    message: string;
    running_hash: string;
    consensus_timestamp: string;
    payer_account_id?: string;
}

interface MirrorTransaction {
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
}

interface MirrorTransfer {
    account: string;
    amount: number;
    is_approval: boolean;
}

interface MirrorTokenTransfer {
    token_id: string;
    account: string;
    amount: number;
}

interface MirrorNftTransfer {
    token_id: string;
    serial_number: number;
    sender_account_id: string;
    receiver_account_id: string;
}

interface MirrorStakingRewardTransfer {
    account: string;
    amount: number;
}

interface MirrorTransactionListResponse {
    transactions: MirrorTransaction[];
}

interface MirrorExchangeRatesResponse {
    current_rate: MirrorExchangeRate;
    next_rate: MirrorExchangeRate;
}

interface MirrorExchangeRate {
    cent_equivalent: number;
    hbar_equivalent: number;
    expiration_time: number;
}

interface MirrorNetworkSupplyResponse {
    released_supply: string;
    total_supply: string;
    timestamp: string;
}

interface MirrorNetworkStakeResponse {
    max_stake_rewarded: number;
    max_staking_reward_rate_per_hbar: number;
    max_total_reward: number;
    node_reward_fee_fraction: number;
    reserved_staking_rewards: number;
    reward_balance_threshold: number;
    stake_total: number;
    staking_period: string;
    staking_period_duration: number;
    staking_periods_stored: number;
    unreserved_staking_reward_balance: number;
}

// ─── Converters ────────────────────────────────────────────────

function convertPage<TRaw, TOut>(
    raw: MirrorPageResponse<TRaw>,
    converter: (item: TRaw) => TOut,
): Page<TOut> {
    // The mirror node returns arrays under different keys (nfts, tokens, messages, transactions)
    // Find the first array value that isn't 'links'
    const dataKey = Object.keys(raw).find(
        (k) => k !== "links" && Array.isArray(raw[k]),
    );
    const items = dataKey ? (raw[dataKey] as TRaw[]) : [];
    return {
        data: items.map(converter),
        links: { next: raw.links?.next ?? null },
    };
}

function convertAccountInfo(raw: MirrorAccountResponse): AccountInfo {
    return {
        accountId: raw.account,
        evmAddress: raw.evm_address,
        key: raw.key?.key,
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
    };
}

function convertBalance(
    accountId: string,
    raw: MirrorAccountResponse,
): Balance {
    const tokens: TokenBalance[] = (raw.balance?.tokens ?? []).map((t) => ({
        tokenId: t.token_id,
        balance: t.balance,
        decimals: t.decimals,
    }));
    return {
        accountId,
        hbars: raw.balance?.balance ?? 0,
        tokens,
    };
}

function convertNft(raw: MirrorNft): Nft {
    return {
        tokenId: raw.token_id,
        serialNumber: raw.serial_number,
        accountId: raw.account_id,
        metadata: raw.metadata,
        createdTimestamp: raw.created_timestamp,
        deleted: raw.deleted,
        delegatingSpender: raw.delegating_spender,
        spender: raw.spender,
    };
}

function convertTokenInfo(raw: MirrorTokenResponse): TokenInfo {
    const customFees: CustomFee[] = [];
    if (raw.custom_fees) {
        for (const f of raw.custom_fees.fixed_fees ?? []) {
            customFees.push({
                type: "fixed",
                amount: f.amount,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt,
                denominatingTokenId: f.denominating_token_id,
            } as FixedFee);
        }
        for (const f of raw.custom_fees.fractional_fees ?? []) {
            customFees.push({
                type: "fractional",
                numerator: f.numerator,
                denominator: f.denominator,
                min: f.minimum,
                max: f.maximum,
                netOfTransfers: f.net_of_transfers,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt,
            } as FractionalFee);
        }
        for (const f of raw.custom_fees.royalty_fees ?? []) {
            customFees.push({
                type: "royalty",
                numerator: f.numerator,
                denominator: f.denominator,
                fallbackFee: f.fallback_fee
                    ? {
                          amount: f.fallback_fee.amount,
                          denominatingTokenId:
                              f.fallback_fee.denominating_token_id,
                      }
                    : undefined,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt,
            } as RoyaltyFee);
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
        adminKey: raw.admin_key?.key,
        supplyKey: raw.supply_key?.key,
        freezeKey: raw.freeze_key?.key,
        wipeKey: raw.wipe_key?.key,
        kycKey: raw.kyc_key?.key,
        pauseKey: raw.pause_key?.key,
        feeScheduleKey: raw.fee_schedule_key?.key,
        deleted: raw.deleted,
        paused: raw.pause_status === "PAUSED",
        customFees,
        createdTimestamp: raw.created_timestamp,
        expirationTimestamp: raw.expiry_timestamp,
        memo: raw.memo,
    };
}

function convertTopicMessage(raw: MirrorTopicMessage): TopicMessage {
    return {
        topicId: raw.topic_id,
        sequenceNumber: raw.sequence_number,
        message: raw.message,
        runningHash: raw.running_hash,
        consensusTimestamp: raw.consensus_timestamp,
        payerAccountId: raw.payer_account_id,
    };
}

function convertTransactionInfo(raw: MirrorTransaction): TransactionInfo {
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
    };
}

function convertNftTransfer(raw: MirrorNftTransfer): NftTransferInfo {
    return {
        tokenId: raw.token_id,
        serialNumber: raw.serial_number,
        senderAccountId: raw.sender_account_id,
        receiverAccountId: raw.receiver_account_id,
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

function convertExchangeRate(raw: MirrorExchangeRate): ExchangeRate {
    return {
        hbarEquivalent: raw.hbar_equivalent,
        centEquivalent: raw.cent_equivalent,
        expirationTime: String(raw.expiration_time),
    };
}

function convertNetworkStake(raw: MirrorNetworkStakeResponse): NetworkStake {
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
        unreservedStakingRewardBalance: raw.unreserved_staking_reward_balance,
    };
}
