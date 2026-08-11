/**
 * Input types for mirror node list queries — page controls and filters.
 * Result/page types live in `page.ts`; domain-specific query shapes (e.g.
 * `TransactionQuery`) extend these from their own modules.
 */

/** Sort order for a paged mirror node query. */
export type SortOrder = "asc" | "desc";

/**
 * Page-size and ordering controls for a mirror node list query. Fetch only
 * what you need (e.g. the 10 most recent) instead of the default page.
 * `links.next` preserves these, so pagination continues with the same
 * settings.
 */
export interface PageQuery {
    /**
     * Maximum items per page.
     */
    readonly limit?: number;
    /** Sort order by the endpoint's primary key (default: mirror node's). */
    readonly order?: SortOrder;
}

/**
 * Comparison bounds for a mirror node parameter that accepts operators.
 * Every provided bound is emitted as its own repeated query parameter,
 * matching the mirror node REST convention
 * (e.g. `?account.balance=gte:100&account.balance=lt:1000`).
 */
export interface RangeFilter<T extends string | number = string | number> {
    /** Equal to. */
    readonly eq?: T;
    /** Not equal to. */
    readonly ne?: T;
    /** Greater than. */
    readonly gt?: T;
    /** Greater than or equal to. */
    readonly gte?: T;
    /** Less than. */
    readonly lt?: T;
    /** Less than or equal to. */
    readonly lte?: T;
}

/**
 * A range of consensus-timestamp bounds. Each bound is a `seconds.nanos`
 * string (e.g. `"1700000000.000000000"`).
 */
export type TimestampRange = RangeFilter<string>;

/**
 * A consensus-timestamp filter — either a single point-in-time
 * `seconds.nanos` string, or a {@link TimestampRange} for time-series windows.
 */
export type TimestampFilter = string | TimestampRange;

/**
 * An entity-ID filter — a single ID, a discrete list (sent as repeated
 * params; the mirror node returns the union of the matches), or a
 * {@link RangeFilter} of ID bounds for windowed scans.
 */
export type EntityIdFilter = string | readonly string[] | RangeFilter<string>;

/**
 * A balance filter — an exact amount, or a {@link RangeFilter} of threshold
 * bounds. Amounts are in the smallest unit: **tinybars** for HBAR balances
 * on `/api/v1/accounts`, the token's smallest denomination for
 * `/api/v1/tokens/{id}/balances`.
 *
 * Decimal strings are accepted alongside numbers so thresholds compose
 * with the exact string builders (`hbarToTinybar`, `parseUnits`) and the
 * string amount fields — a whale-sized threshold above 2^53 cannot be
 * expressed as a `number` without rounding.
 */
export type BalanceFilter = number | string | RangeFilter<number | string>;

/**
 * Options for a single-account lookup (`/api/v1/accounts/{id}`).
 */
export interface AccountQuery {
    /**
     * Return the account's state — including its balance — as of a point
     * in time (or the bound of a range). The basis for balance-over-time
     * series: snapshot the same account at successive timestamps.
     */
    readonly timestamp?: TimestampFilter;
    /**
     * Whether the response should embed the account's recent transaction
     * list (default: true). Set `false` for faster lookups — the data
     * model doesn't expose the embedded list anyway.
     */
    readonly includeTransactions?: boolean;
}

/**
 * Options for the network supply endpoint (`/api/v1/network/supply`).
 */
export interface NetworkSupplyQuery {
    /** Return supply as of a point in time (historical supply series). */
    readonly timestamp?: TimestampFilter;
}

/**
 * Filters for listing accounts (`/api/v1/accounts`) — the basis for
 * threshold analysis.
 */
export interface AccountListQuery extends PageQuery {
    /** Filter by account ID (supports ranges for ID-windowed scans). */
    readonly accountId?: EntityIdFilter;
    /**
     * Filter by HBAR balance in tinybars, e.g.
     * `{ gte: 100_000_000_000 }` for accounts holding ≥ 1,000 ℏ.
     */
    readonly balance?: BalanceFilter;
    /** Filter by account public key. */
    readonly publicKey?: string;
    /**
     * Whether to include balance info in each entry (default: true).
     * Set `false` to speed up large scans that don't need balances —
     * entries then report a balance of 0.
     */
    readonly includeBalance?: boolean;
}

/**
 * Filters for listing the holders of a token
 * (`/api/v1/tokens/{id}/balances`).
 */
export interface TokenBalancesQuery extends PageQuery {
    /**
     * Filter holders by their token balance (in the token's smallest unit),
     * e.g. `{ gte: 1_000_000 }` for ≥ 1 USDC at 6 decimals.
     */
    readonly accountBalance?: BalanceFilter;
    /** Filter by holder account ID. */
    readonly accountId?: EntityIdFilter;
    /** Filter by holder public key. */
    readonly publicKey?: string;
    /**
     * Holder snapshot as of a point in time — the token-side counterpart
     * of the network-wide `/balances` history.
     */
    readonly timestamp?: TimestampFilter;
}

/** Options for a single-token lookup (`/api/v1/tokens/{id}`). */
export interface TokenQuery {
    /** Token state — including total supply — as of a point in time. */
    readonly timestamp?: TimestampFilter;
}

/** Filters for the token listing (`/api/v1/tokens`). */
export interface TokensQuery extends PageQuery {
    /** Only tokens associated with this account. */
    readonly accountId?: string;
    /** Case-insensitive partial match on the token name. */
    readonly name?: string;
    /** Filter by admin/supply key. */
    readonly publicKey?: string;
    /** Filter by token ID (supports ranges). */
    readonly tokenId?: EntityIdFilter;
    /** Filter by token type, e.g. `FUNGIBLE_COMMON` or `NON_FUNGIBLE_UNIQUE`. */
    readonly type?: string;
}

/**
 * Filters for an account's token-balance listing
 * (`/api/v1/accounts/{id}/tokens`).
 */
export interface AccountTokensQuery extends PageQuery {
    /** Filter by token ID (supports ranges). */
    readonly tokenId?: EntityIdFilter;
}

/**
 * Filters for an account's NFT listing (`/api/v1/accounts/{id}/nfts`).
 */
export interface AccountNftsQuery extends PageQuery {
    /** Filter by NFT collection. */
    readonly tokenId?: string;
    /** Filter by serial number (supports ranges; requires `tokenId`). */
    readonly serialNumber?: number | RangeFilter<number>;
    /** Filter by approved spender. */
    readonly spenderId?: EntityIdFilter;
}

/**
 * Filters for a collection's NFT listing (`/api/v1/tokens/{id}/nfts`).
 */
export interface TokenNftsQuery extends PageQuery {
    /** Filter by owning account. */
    readonly accountId?: string;
    /** Filter by serial number (supports ranges). */
    readonly serialNumber?: number | RangeFilter<number>;
}

/**
 * Filters for the network-wide balance snapshot endpoint
 * (`/api/v1/balances`). Combine `timestamp` with a `balance` threshold to
 * answer historical questions like "how many accounts held ≥ X ℏ on
 * date D" — the account list endpoint only reports current state.
 */
export interface BalancesQuery extends PageQuery {
    /** Filter by account ID, alias or EVM address. */
    readonly accountId?: EntityIdFilter;
    /** Filter by HBAR balance in tinybars. */
    readonly balance?: BalanceFilter;
    /** Filter by account public key. */
    readonly publicKey?: string;
    /** Snapshot as of a point in time (historical whale counts). */
    readonly timestamp?: TimestampFilter;
}

/**
 * Filters for the pending/outstanding airdrop listings
 * (`/api/v1/accounts/{id}/airdrops/…`).
 */
export interface AirdropsQuery extends PageQuery {
    /** Pending listing: filter by the sending account. */
    readonly senderId?: EntityIdFilter;
    /** Outstanding listing: filter by the receiving account. */
    readonly receiverId?: EntityIdFilter;
    /** Filter by NFT serial number. */
    readonly serialNumber?: number | RangeFilter<number>;
    /** Filter by token ID. */
    readonly tokenId?: EntityIdFilter;
}

/**
 * Filters for the crypto/token allowance listings
 * (`/api/v1/accounts/{id}/allowances/{crypto,tokens}`).
 */
export interface AllowancesQuery extends PageQuery {
    /** Filter by the spender account. */
    readonly spenderId?: EntityIdFilter;
    /** Token allowances only: filter by token ID. */
    readonly tokenId?: EntityIdFilter;
}

/**
 * Filters for the NFT allowance listing
 * (`/api/v1/accounts/{id}/allowances/nfts`).
 */
export interface NftAllowancesQuery extends PageQuery {
    /** Filter by the counterparty account. */
    readonly accountId?: EntityIdFilter;
    /** Filter by token ID. */
    readonly tokenId?: EntityIdFilter;
    /**
     * When `true` (default) the path account is the owner and results list
     * its spenders; when `false` the path account is the spender.
     */
    readonly owner?: boolean;
}

/**
 * Filters for the schedule listing (`/api/v1/schedules`).
 */
export interface SchedulesQuery extends PageQuery {
    /** Filter by the creator account. */
    readonly accountId?: EntityIdFilter;
    /** Filter by schedule ID. */
    readonly scheduleId?: EntityIdFilter;
}

/**
 * Filters for an NFT's transaction history
 * (`/api/v1/tokens/{id}/nfts/{serial}/transactions`).
 */
export interface NftTransactionsQuery extends PageQuery {
    /** Filter by consensus timestamp. */
    readonly timestamp?: TimestampFilter;
}

/** Options for the network fee schedule (`/api/v1/network/fees`). */
export interface NetworkFeesQuery {
    /** Fee schedule as of a point in time. */
    readonly timestamp?: TimestampFilter;
    /** Sort order. */
    readonly order?: SortOrder;
}

/** Options for the exchange rate (`/api/v1/network/exchangerate`). */
export interface ExchangeRateQuery {
    /** Exchange rate as of a point in time (historical HBAR/cent rate). */
    readonly timestamp?: TimestampFilter;
}

/** Filters for the consensus node listing (`/api/v1/network/nodes`). */
export interface NetworkNodesQuery extends PageQuery {
    /** Filter by node ID (supports ranges). */
    readonly nodeId?: number | RangeFilter<number>;
    /** Filter by the address-book file (0.0.101 or 0.0.102). */
    readonly fileId?: string;
}

/**
 * Filters for an account's staking-reward history
 * (`/api/v1/accounts/{id}/rewards`).
 */
export interface StakingRewardsQuery extends PageQuery {
    /** Filter by the reward payment's consensus timestamp. */
    readonly timestamp?: TimestampFilter;
}

/**
 * Options for fee estimation (`POST /api/v1/network/fees`).
 */
export interface FeeEstimateQuery {
    /**
     * `INTRINSIC` (default) estimates from the transaction's inherent
     * properties; `STATE` also consults network state.
     */
    readonly mode?: "INTRINSIC" | "STATE";
    /**
     * High-volume throttle utilization in basis points (0–10000, HIP-1313).
     * 0 (default) means no high-volume pricing.
     */
    readonly highVolumeThrottle?: number;
}

/**
 * Options for a single-transaction lookup
 * (`/api/v1/transactions/{transactionId}`).
 */
export interface TransactionLookupQuery {
    /** Child-transaction nonce to select (default 0, the parent). */
    readonly nonce?: number;
    /** Whether to return the scheduled execution instead of the create. */
    readonly scheduled?: boolean;
}

/**
 * Filters for a topic's message listing (`/api/v1/topics/{id}/messages`).
 */
export interface TopicMessagesQuery extends PageQuery {
    /** Filter by sequence number (supports ranges). */
    readonly sequenceNumber?: number | RangeFilter<number>;
    /** Filter by consensus timestamp (time-windowed reads). */
    readonly timestamp?: TimestampFilter;
}

/** Filters for the block listing (`/api/v1/blocks`). */
export interface BlocksQuery extends PageQuery {
    /** Filter by block height. */
    readonly blockNumber?: number | RangeFilter<number>;
    /** Filter by the blocks' consensus-timestamp span. */
    readonly timestamp?: TimestampFilter;
}

/** Filters for an account's hook listing (`/api/v1/accounts/{id}/hooks`). */
export interface HooksQuery extends PageQuery {
    /** Filter by hook ID. */
    readonly hookId?: number | RangeFilter<number>;
}

/**
 * Filters for a hook's storage listing
 * (`/api/v1/accounts/{id}/hooks/{hookId}/storage`).
 */
export interface HookStorageQuery extends PageQuery {
    /** Filter by storage key (`operator:address` pair). */
    readonly key?: string;
    /** Storage as of a point in time. */
    readonly timestamp?: TimestampFilter;
}

/**
 * Filters for the registered-node listing
 * (`/api/v1/network/registered-nodes`).
 */
export interface RegisteredNodesQuery extends PageQuery {
    /** Filter by registered node ID. */
    readonly registeredNodeId?: number | RangeFilter<number>;
    /** Filter by node type. */
    readonly type?: string;
}

/** Filters for the contract listing (`/api/v1/contracts`). */
export interface ContractsQuery extends PageQuery {
    /** Filter by contract ID. */
    readonly contractId?: EntityIdFilter;
}

/** Options for a single-contract lookup (`/api/v1/contracts/{id}`). */
export interface ContractQuery {
    /** Return the contract's state as of a point in time. */
    readonly timestamp?: TimestampFilter;
}

/**
 * Filters for the contract result listings
 * (`/api/v1/contracts/{id}/results` and `/api/v1/contracts/results`).
 */
export interface ContractResultsQuery extends PageQuery {
    /** Filter by block hash. */
    readonly blockHash?: string;
    /** Filter by block height. */
    readonly blockNumber?: number | RangeFilter<number>;
    /** Filter by the account or EVM address executing the contract. */
    readonly from?: string;
    /** Include child (internal) transactions (default false). */
    readonly internal?: boolean;
    /** Filter by consensus timestamp. */
    readonly timestamp?: TimestampFilter;
    /** Filter by the transaction's index in its block. */
    readonly transactionIndex?: number;
}

/**
 * Options for a single contract result lookup
 * (`/api/v1/contracts/results/{transactionIdOrHash}`).
 */
export interface ContractResultQuery {
    /** Child-transaction nonce to select (default 0, the parent). */
    readonly nonce?: number;
}

/** Filters for a contract's storage (`/api/v1/contracts/{id}/state`). */
export interface ContractStateQuery extends PageQuery {
    /** Filter by storage slot (hex). */
    readonly slot?: string;
    /** State as of a point in time (defaults to current). */
    readonly timestamp?: TimestampFilter;
}

/**
 * Filters for the contract log listings
 * (`/api/v1/contracts/{id}/results/logs` and
 * `/api/v1/contracts/results/logs`). Topic filters require a `timestamp`
 * range of at most seven days.
 */
export interface ContractLogsQuery extends PageQuery {
    /** Filter by log index within an execution (requires `timestamp`). */
    readonly index?: number | RangeFilter<number>;
    /** Filter by consensus timestamp. */
    readonly timestamp?: TimestampFilter;
    /** Filter by the first log topic. */
    readonly topic0?: string;
    /** Filter by the second log topic. */
    readonly topic1?: string;
    /** Filter by the third log topic. */
    readonly topic2?: string;
    /** Filter by the fourth log topic. */
    readonly topic3?: string;
    /** Network-wide listing only: filter by transaction hash. */
    readonly transactionHash?: string;
}

/**
 * Filters for a result's action listing
 * (`/api/v1/contracts/results/{transactionIdOrHash}/actions`).
 */
export interface ContractActionsQuery extends PageQuery {
    /** Filter by action index. */
    readonly index?: number | RangeFilter<number>;
}

/**
 * Options for an opcode trace
 * (`/api/v1/contracts/results/{transactionIdOrHash}/opcodes`). The
 * transaction is re-executed on the EVM, so requesting memory/storage can
 * be slow.
 */
export interface OpcodesQuery {
    /** Include stack information (default true). */
    readonly stack?: boolean;
    /** Include memory information (default false). */
    readonly memory?: boolean;
    /** Include storage information (default false). */
    readonly storage?: boolean;
}
