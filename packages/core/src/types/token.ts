/**
 * Full token information from the mirror node.
 */
export interface TokenInfo {
    /** Token ID */
    tokenId: string;
    /** Token name */
    name: string;
    /** Token symbol */
    symbol: string;
    /** Token type: FUNGIBLE_COMMON or NON_FUNGIBLE_UNIQUE */
    type: TokenType;
    /** Decimal places (fungible tokens only) */
    decimals: number;
    /** Total supply currently in circulation */
    totalSupply: string;
    /** Maximum supply (0 = infinite) */
    maxSupply: string;
    /** Treasury account receiving minted tokens */
    treasuryAccountId: string;
    /** Admin key (can modify token properties) */
    adminKey?: string;
    /** Supply key (can mint/burn) */
    supplyKey?: string;
    /** Freeze key */
    freezeKey?: string;
    /** Wipe key */
    wipeKey?: string;
    /** KYC key */
    kycKey?: string;
    /** Pause key */
    pauseKey?: string;
    /** Fee schedule key */
    feeScheduleKey?: string;
    /** Whether the token is deleted */
    deleted: boolean;
    /** Whether the token is paused */
    paused: boolean;
    /** Custom fees */
    customFees: CustomFee[];
    /** Creation timestamp */
    createdTimestamp?: string;
    /** Expiration timestamp */
    expirationTimestamp?: string;
    /** Memo */
    memo?: string;
}

/**
 * Token type enum.
 */
export type TokenType = "FUNGIBLE_COMMON" | "NON_FUNGIBLE_UNIQUE";

/**
 * Token transfer in a transaction.
 */
export interface TokenTransfer {
    /** Token ID */
    tokenId: string;
    /** Account ID */
    accountId: string;
    /** Amount transferred (negative = sent, positive = received) */
    amount: number;
}

/**
 * Custom fee attached to a token.
 */
export interface CustomFee {
    /** Fee type */
    type: "fixed" | "fractional" | "royalty";
    /** Fee collector account */
    collectorAccountId: string;
    /** Whether all collectors are exempt */
    allCollectorsAreExempt: boolean;
}

/**
 * Fixed fee — a flat fee charged per transaction.
 */
export interface FixedFee extends CustomFee {
    type: "fixed";
    /** Amount of the fee */
    amount: number;
    /** Token ID for the fee (null = HBAR) */
    denominatingTokenId?: string;
}

/**
 * Fractional fee — a percentage of the transferred amount.
 */
export interface FractionalFee extends CustomFee {
    type: "fractional";
    /** Numerator of the fraction */
    numerator: number;
    /** Denominator of the fraction */
    denominator: number;
    /** Minimum fee amount */
    min?: number;
    /** Maximum fee amount */
    max?: number;
    /** Whether the fee is deducted from the transferred amount */
    netOfTransfers: boolean;
}

/**
 * Royalty fee — charged on NFT transfers as a percentage of the value exchanged.
 */
export interface RoyaltyFee extends CustomFee {
    type: "royalty";
    /** Numerator of the fraction */
    numerator: number;
    /** Denominator of the fraction */
    denominator: number;
    /** Fallback fixed fee if no value is exchanged */
    fallbackFee?: {
        amount: number;
        denominatingTokenId?: string;
    };
}
