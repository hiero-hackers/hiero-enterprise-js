/**
 * Exchange rate between HBAR and USD cents.
 */
export interface ExchangeRate {
    /** HBAR equivalent */
    readonly hbarEquivalent: number;
    /** Cent equivalent (USD) */
    readonly centEquivalent: number;
    /** Expiration timestamp */
    readonly expirationTime: string;
}

/**
 * Current and next exchange rates.
 */
export interface ExchangeRates {
    /** Current exchange rate */
    readonly currentRate: ExchangeRate;
    /** Next exchange rate */
    readonly nextRate: ExchangeRate;
}

/**
 * Network staking information.
 */
export interface NetworkStake {
    /** Maximum stake rewarded in tinybars */
    readonly maxStakeRewarded: number;
    /** Maximum staking reward rate per HBAR */
    readonly maxStakingRewardRatePerHbar: number;
    /** Maximum total reward in tinybars */
    readonly maxTotalReward: number;
    /** Threshold for minimum node stake */
    readonly nodeRewardFeeFraction: number;
    /** Reserved staking rewards in tinybars */
    readonly reservedStakingRewards: number;
    /** Reward balance threshold */
    readonly rewardBalanceThreshold: number;
    /** Total stake rewarded */
    readonly stakeTotal: number;
    /** Staking period start */
    readonly stakingPeriod: string;
    /** Staking period duration in minutes */
    readonly stakingPeriodDuration: number;
    /** Staking periods stored */
    readonly stakingPeriodsStored: number;
    /** Unreserved staking reward balance */
    readonly unreservedStakingRewardBalance: number;
}

/**
 * Network supply information.
 */
export interface NetworkSupplies {
    /** Released supply in tinybars */
    readonly releasedSupply: string;
    /** Total supply in tinybars */
    readonly totalSupply: string;
    /** Timestamp */
    readonly timestamp: string;
}
