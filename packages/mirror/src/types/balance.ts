/**
 * HBAR and token balance for an account.
 *
 * Structurally identical to core's `Balance` (the SDK-side balance query
 * returns the same shape) — TypeScript's structural typing keeps the two
 * freely assignable. If a third copy ever appears, extract a shared
 * package instead.
 */
export interface Balance {
    /** Account ID */
    accountId: string;
    /** HBAR balance in tinybars — decimal string; `BigInt(x)` for arithmetic */
    tinybars: string;
    /** When the balance figures were snapshotted by the mirror node */
    timestamp?: string | null;
    /** Token balances associated with this account */
    tokens: TokenBalance[];
}

/**
 * Balance of a specific token held by an account.
 */
export interface TokenBalance {
    /** Token ID */
    tokenId: string;
    /** Balance in the token's smallest unit — decimal string */
    balance: string;
    /** Token decimals */
    decimals: number;
    /** Whether the association was automatic (account-tokens listing) */
    automaticAssociation?: boolean;
    /** When the token was associated (account-tokens listing) */
    createdTimestamp?: string;
    /** FROZEN / UNFROZEN / NOT_APPLICABLE (account-tokens listing) */
    freezeStatus?: string;
    /** GRANTED / REVOKED / NOT_APPLICABLE (account-tokens listing) */
    kycStatus?: string;
}

/**
 * A single holder of a token, as returned by the token balances endpoint —
 * the basis for holder-distribution and threshold analysis.
 */
export interface TokenHolder {
    /** The holding account's ID */
    accountId: string;
    /** Balance in the token's smallest unit — decimal string */
    balance: string;
    /** Token decimals, when the mirror node reports them */
    decimals?: number;
}

/**
 * One account's balance in a network-wide snapshot
 * (`/api/v1/balances`) — supports historical `timestamp` queries, unlike
 * the accounts list.
 */
export interface AccountBalanceSnapshot {
    /** Account ID */
    accountId: string;
    /** HBAR balance in tinybars at the snapshot time — decimal string */
    balance: string;
    /** Token balances at the snapshot time, in each token's smallest unit — decimal strings */
    tokens: Array<{ tokenId: string; balance: string }>;
}
