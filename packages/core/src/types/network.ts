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
    /** Staking period start */
    stakingPeriod: string;
    /** Staking period duration in minutes */
    stakingPeriodDuration: number;
    /** Staking periods stored */
    stakingPeriodsStored: number;
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
