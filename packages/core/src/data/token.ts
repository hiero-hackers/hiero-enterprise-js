/**
 * Full token information from the mirror node.
 */
export interface TokenInfo {
    /** Token ID */
    readonly tokenId: string;
    /** Token name */
    readonly name: string;
    /** Token symbol */
    readonly symbol: string;
    /** Token type: FUNGIBLE_COMMON or NON_FUNGIBLE_UNIQUE */
    readonly type: TokenType;
    /** Decimal places (fungible tokens only) */
    readonly decimals: number;
    /** Total supply currently in circulation */
    readonly totalSupply: string;
    /** Maximum supply (0 = infinite) */
    readonly maxSupply: string;
    /** Treasury account receiving minted tokens */
    readonly treasuryAccountId: string;
    /** Admin key (can modify token properties) */
    readonly adminKey?: string;
    /** Supply key (can mint/burn) */
    readonly supplyKey?: string;
    /** Freeze key */
    readonly freezeKey?: string;
    /** Wipe key */
    readonly wipeKey?: string;
    /** KYC key */
    readonly kycKey?: string;
    /** Pause key */
    readonly pauseKey?: string;
    /** Fee schedule key */
    readonly feeScheduleKey?: string;
    /** Whether the token is deleted */
    readonly deleted: boolean;
    /** Whether the token is paused */
    readonly paused: boolean;
    /** Custom fees */
    readonly customFees: CustomFee[];
    /** Creation timestamp */
    readonly createdTimestamp?: string;
    /** Expiration timestamp */
    readonly expirationTimestamp?: string;
    /** Memo */
    readonly memo?: string;
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
    readonly tokenId: string;
    /** Account ID */
    readonly accountId: string;
    /** Amount transferred (negative = sent, positive = received) */
    readonly amount: number;
}

/**
 * Custom fee attached to a token.
 */
export interface CustomFee {
    /** Fee type */
    readonly type: "fixed" | "fractional" | "royalty";
    /** Fee collector account */
    readonly collectorAccountId: string;
    /** Whether all collectors are exempt */
    readonly allCollectorsAreExempt: boolean;
}

/**
 * Fixed fee — a flat fee charged per transaction.
 */
export interface FixedFee extends CustomFee {
    readonly type: "fixed";
    /** Amount of the fee */
    readonly amount: number;
    /** Token ID for the fee (null = HBAR) */
    readonly denominatingTokenId?: string;
}

/**
 * Fractional fee — a percentage of the transferred amount.
 */
export interface FractionalFee extends CustomFee {
    readonly type: "fractional";
    /** Numerator of the fraction */
    readonly numerator: number;
    /** Denominator of the fraction */
    readonly denominator: number;
    /** Minimum fee amount */
    readonly min?: number;
    /** Maximum fee amount */
    readonly max?: number;
    /** Whether the fee is deducted from the transferred amount */
    readonly netOfTransfers: boolean;
}

/**
 * Royalty fee — charged on NFT transfers as a percentage of the value exchanged.
 */
export interface RoyaltyFee extends CustomFee {
    readonly type: "royalty";
    /** Numerator of the fraction */
    readonly numerator: number;
    /** Denominator of the fraction */
    readonly denominator: number;
    /** Fallback fixed fee if no value is exchanged */
    readonly fallbackFee?: {
        readonly amount: number;
        readonly denominatingTokenId?: string;
    };
}
