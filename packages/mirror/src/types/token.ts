import type { MirrorKey } from "./common.js";

/**
 * A row from the network-wide token listing (`/api/v1/tokens`) — the
 * seven-field summary that endpoint actually serves. For supplies,
 * treasury, fees, and timestamps, fetch the full {@link MirrorTokenInfo}
 * by id.
 */
export interface TokenSummary {
    /** Token ID */
    tokenId: string;
    /** Token name */
    name: string;
    /** Token symbol */
    symbol: string;
    /** Token type: FUNGIBLE_COMMON or NON_FUNGIBLE_UNIQUE */
    type: MirrorTokenType;
    /** Decimal places (fungible tokens only) */
    decimals: number;
    /** Admin key (can modify token properties) */
    adminKey?: MirrorKey;
    /** Arbitrary token-class metadata, base64 */
    metadata?: string;
}

/**
 * Full token information from the mirror node.
 */
export interface MirrorTokenInfo {
    /** Token ID */
    tokenId: string;
    /** Token name */
    name: string;
    /** Token symbol */
    symbol: string;
    /** Token type: FUNGIBLE_COMMON or NON_FUNGIBLE_UNIQUE */
    type: MirrorTokenType;
    /** Decimal places (fungible tokens only) */
    decimals: number;
    /** Total supply currently in circulation */
    totalSupply: string;
    /** Maximum supply (0 = infinite) */
    maxSupply: string;
    /** Treasury account receiving minted tokens */
    treasuryAccountId: string;
    /** Admin key (can modify token properties) */
    adminKey?: MirrorKey;
    /** Supply key (can mint/burn) */
    supplyKey?: MirrorKey;
    /** Freeze key */
    freezeKey?: MirrorKey;
    /** Wipe key */
    wipeKey?: MirrorKey;
    /** KYC key */
    kycKey?: MirrorKey;
    /** Pause key */
    pauseKey?: MirrorKey;
    /** Fee schedule key */
    feeScheduleKey?: MirrorKey;
    /** Whether the token is deleted */
    deleted: boolean;
    /** Whether the token is paused */
    paused: boolean;
    /** Custom fees */
    customFees: MirrorCustomFee[];
    /** When the custom-fee schedule was last set, if fees are configured */
    customFeesCreatedTimestamp?: string;
    /** Creation timestamp */
    createdTimestamp?: string;
    /** Expiration timestamp */
    expirationTimestamp?: string;
    /** Memo */
    memo?: string;
    /** Auto-renew payer account, if any */
    autoRenewAccount?: string | null;
    /** Auto-renew period in seconds */
    autoRenewPeriod?: number | null;
    /** Whether new associations start frozen */
    freezeDefault?: boolean;
    /** Supply at creation (smallest unit) */
    initialSupply?: string;
    /** HIP-646 token-class metadata, base64 */
    metadata?: string;
    /** HIP-646 metadata key, if readable */
    metadataKey?: MirrorKey;
    /** When the token was last modified */
    modifiedTimestamp?: string;
    /** Supply type: FINITE or INFINITE */
    supplyType?: string;
}

/**
 * Mirror node token type (string representation from REST API).
 */
export type MirrorTokenType = "FUNGIBLE_COMMON" | "NON_FUNGIBLE_UNIQUE";

/**
 * Token transfer in a transaction.
 */
export interface TokenTransfer {
    /** Token ID */
    tokenId: string;
    /** Account ID */
    accountId: string;
    /** Amount transferred (negative = sent, positive = received) */
    amount: string;
}

/**
 * Custom fee attached to a token (mirror node representation).
 */
export interface MirrorCustomFee {
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
export interface MirrorFixedFee extends MirrorCustomFee {
    type: "fixed";
    /** Amount of the fee */
    amount: string;
    /** Token ID for the fee (null = HBAR) */
    denominatingTokenId?: string;
}

/**
 * Fractional fee — a percentage of the transferred amount.
 */
export interface MirrorFractionalFee extends MirrorCustomFee {
    type: "fractional";
    /** Numerator of the fraction — decimal string (creator-chosen int64) */
    numerator?: string;
    /** Denominator of the fraction — decimal string (creator-chosen int64) */
    denominator?: string;
    /** Minimum fee amount */
    min?: string;
    /** Maximum fee amount */
    max?: string | null;
    /** Whether the fee is deducted from the transferred amount */
    netOfTransfers?: boolean;
    /** Denominating token, or null for HBAR */
    denominatingTokenId?: string | null;
}

/**
 * Royalty fee — charged on NFT transfers as a percentage of the value exchanged.
 */
export interface MirrorRoyaltyFee extends MirrorCustomFee {
    type: "royalty";
    /** Numerator of the fraction — decimal string (creator-chosen int64) */
    numerator?: string;
    /** Denominator of the fraction — decimal string (creator-chosen int64) */
    denominator?: string;
    /** Fallback fixed fee if no value is exchanged */
    fallbackFee?: {
        amount: string;
        denominatingTokenId?: string;
    };
}
