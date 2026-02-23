/**
 * HBAR and token balance for an account.
 */
export interface Balance {
    /** Account ID */
    readonly accountId: string;
    /** HBAR balance in tinybars */
    readonly hbars: number;
    /** Token balances associated with this account */
    readonly tokens: TokenBalance[];
}

/**
 * Balance of a specific token held by an account.
 */
export interface TokenBalance {
    /** Token ID */
    readonly tokenId: string;
    /** Balance amount */
    readonly balance: number;
    /** Token decimals */
    readonly decimals: number;
}
