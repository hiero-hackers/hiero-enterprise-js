/**
 * HBAR and token balance for an account.
 */
export interface Balance {
    /** Account ID */
    accountId: string;
    /** HBAR balance in tinybars */
    hbars: number;
    /** Token balances associated with this account */
    tokens: TokenBalance[];
}

/**
 * Balance of a specific token held by an account.
 */
export interface TokenBalance {
    /** Token ID */
    tokenId: string;
    /** Balance amount */
    balance: number;
    /** Token decimals */
    decimals: number;
}
