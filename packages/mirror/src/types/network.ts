import type { EffectiveTimestampRange, MirrorKey } from "./common.js";

/**
 * Exchange rate between HBAR and USD cents.
 */
export interface ExchangeRate {
    /** HBAR equivalent */
    hbarEquivalent: number;
    /** Cent equivalent (USD) */
    centEquivalent: number;
    /** Expiration timestamp */
    expirationTime: string;
}

/**
 * Current and next exchange rates.
 */
export interface ExchangeRates {
    /** Current exchange rate */
    currentRate: ExchangeRate;
    /** Next exchange rate */
    nextRate: ExchangeRate;
    /** Consensus timestamp the rate set was published at, when reported */
    timestamp?: string;
}

/**
 * A staking period's bounds, as `seconds.nanoseconds` consensus timestamps.
 */
export interface StakingPeriod {
    /** Period start */
    from: string;
    /** Period end (exclusive) */
    to: string;
}

/**
 * A consensus node's staking state, from `/api/v1/network/nodes`.
 */
export interface NetworkNode {
    /** Node ID (0, 1, 2, …) */
    nodeId: number;
    /** The node's account ID */
    nodeAccountId: string;
    /** Node operator description, e.g. "Hosted by X | City" */
    description: string;
    /** Current effective stake in tinybars */
    stake: number;
    /** Minimum stake for the node to be eligible for rewards, in tinybars */
    minStake: number;
    /** Maximum stake considered for rewards, in tinybars */
    maxStake: number;
    /** Stake that is eligible for rewards, in tinybars */
    stakeRewarded: number;
    /** Stake that declines rewards, in tinybars */
    stakeNotRewarded: number;
    /** The node's admin key, if readable */
    adminKey?: MirrorKey;
    /** Registered node IDs associated with this consensus node */
    associatedRegisteredNodes?: number[];
    /** Whether the node declines staking rewards */
    declineReward?: boolean | null;
    /** The address-book file the entry came from (0.0.101 / 0.0.102) */
    fileId?: string | null;
    /** gRPC web-proxy endpoint, if published */
    grpcProxyEndpoint?: ServiceEndpoint | null;
    /** Node memo */
    memo?: string | null;
    /** Hex hash of the node's TLS certificate */
    nodeCertHash?: string | null;
    /** Hex X509 RSA public key used to verify stream signatures */
    publicKey?: string | null;
    /** Tinybars earned per whole hbar staked in the last period */
    rewardRateStart?: number | null;
    /** Endpoints the node serves */
    serviceEndpoints?: ServiceEndpoint[];
    /** The staking period the stake figures describe */
    stakingPeriod?: EffectiveTimestampRange | null;
    /** Entity validity range */
    timestamp?: EffectiveTimestampRange;
}

/** A gRPC/REST endpoint a registered node serves. */
export interface ServiceEndpoint {
    /** IPv4 address, if published */
    ipAddressV4?: string;
    /** Port number */
    port?: number;
    /** Domain name, if published instead of an IP */
    domainName?: string;
}

/**
 * An endpoint served by a registered node — richer than a consensus
 * node's {@link ServiceEndpoint}: role flags and TLS requirement.
 */
export interface RegisteredServiceEndpoint {
    /** Whether the endpoint serves the block-node role */
    blockNode?: boolean;
    /** Block-node variant: APIs the endpoint exposes */
    endpointApis?: string[];
    /** General-service variant: what the endpoint serves */
    description?: string | null;
    /** Domain name, if published instead of an IP */
    domainName?: string | null;
    /** Whether the endpoint serves a general service */
    generalService?: boolean;
    /** IP address, if published */
    ipAddress?: string | null;
    /** Whether the endpoint serves the mirror-node role */
    mirrorNode?: boolean;
    /** Port number */
    port?: number;
    /** Whether TLS is required */
    requiresTls?: boolean;
    /** Whether the endpoint serves the RPC-relay role */
    rpcRelay?: boolean;
    /** The endpoint type */
    type?: string;
}

/**
 * A registered (non-consensus) node, from
 * `/api/v1/network/registered-nodes`.
 */
export interface RegisteredNode {
    /** The node's admin key, if readable */
    adminKey?: MirrorKey;
    /** When the node registered */
    createdTimestamp: string | null;
    /** A short description of the node */
    description: string | null;
    /** The registered node's identifier */
    registeredNodeId: number;
    /** Endpoints the node serves */
    serviceEndpoints: RegisteredServiceEndpoint[];
    /** Validity range; `to` is null while the record is current */
    timestamp: EffectiveTimestampRange;
}

/**
 * Network staking information.
 */
export interface NetworkStake {
    /** Maximum stake rewarded in tinybars */
    maxStakeRewarded: number;
    /** Maximum staking reward rate per HBAR */
    maxStakingRewardRatePerHbar: number;
    /** Maximum total reward in tinybars */
    maxTotalReward: number;
    /** Threshold for minimum node stake */
    nodeRewardFeeFraction: number;
    /** Reserved staking rewards in tinybars */
    reservedStakingRewards: number;
    /** Reward balance threshold */
    rewardBalanceThreshold: number;
    /** Total stake rewarded */
    stakeTotal: number;
    /** The current staking period's bounds (consensus timestamps) */
    stakingPeriod: StakingPeriod | null;
    /** Staking period duration in minutes */
    stakingPeriodDuration: number;
    /** Staking periods stored */
    stakingPeriodsStored: number;
    /** Fraction (0–1) of fees paid to the staking reward account 0.0.800 */
    stakingRewardFeeFraction: number;
    /** Total tinybars distributed as staking rewards each period */
    stakingRewardRate: number;
    /** Minimum 0.0.800 balance required to activate rewards */
    stakingStartThreshold: number;
    /** Unreserved staking reward balance */
    unreservedStakingRewardBalance: number;
}

/**
 * Network supply information.
 */
export interface NetworkSupplies {
    /** Released supply in tinybars */
    releasedSupply: string;
    /** Total supply in tinybars */
    totalSupply: string;
    /** Timestamp */
    timestamp: string;
}

/**
 * One staking reward payment to an account, from
 * `/api/v1/accounts/{id}/rewards`.
 */
export interface StakingReward {
    /** The rewarded account */
    accountId: string | null;
    /** The reward amount in tinybars */
    amount: number;
    /** When the reward was paid */
    timestamp: string;
}

/** One itemized extra fee inside a fee-estimate component. */
export interface FeeExtra {
    /** Amount charged for this extra, in tinycents */
    charged: number;
    /** Units of the extra present in the transaction */
    count: number;
    /** Price per unit, in tinycents */
    feePerUnit: number;
    /** Units included in the base fee before charging begins */
    included: number;
    /** The extra's name */
    name: string;
    /** Subtotal for this extra, in tinycents */
    subtotal: number;
}

/** The node or service component of a fee estimate. */
export interface FeeEstimateComponent {
    /** Base fee price, in tinycents */
    base: number;
    /** Itemized extra fees */
    extras: FeeExtra[];
}

/**
 * A HIP-1313 fee estimate for a HAPI transaction, from
 * `POST /api/v1/network/fees`. All amounts are in tinycents.
 */
export interface FeeEstimate {
    /** High-volume pricing multiplier (1 = no high-volume pricing) */
    highVolumeMultiplier: number;
    /** Network fee component */
    network: { multiplier: number; subtotal: number };
    /** Node fee component (pre-check work by the submitting node) */
    node: FeeEstimateComponent;
    /** Service fee component (execution + state storage) */
    service: FeeEstimateComponent;
    /** Sum of all components, in tinycents */
    total: number;
}

/**
 * One entry in the network fee schedule.
 */
export interface NetworkFee {
    /** Gas cost in tinybars */
    gas: number;
    /** Transaction type the fee applies to, e.g. "ContractCall" */
    transactionType: string;
}

/**
 * The network fee schedule (`/api/v1/network/fees`).
 */
export interface NetworkFees {
    /** Snapshot timestamp */
    timestamp: string;
    /** Per-transaction-type gas costs */
    fees: NetworkFee[];
}
