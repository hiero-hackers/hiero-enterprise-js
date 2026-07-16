import type { EffectiveTimestampRange } from "./common.js";

/**
 * A live token airdrop record — pending from the receiver's point of view,
 * outstanding from the sender's. The read-side counterpart of core's
 * `claimAirdrop` / `cancelAirdrop`.
 */
export interface Airdrop {
    /** Fungible amount (0 for NFTs) */
    amount: string;
    /** Receiving account */
    receiverId: string;
    /** Sending account */
    senderId: string;
    /** NFT serial number, or null for fungible airdrops */
    serialNumber: number | null;
    /** Token being airdropped */
    tokenId: string;
    /** When the airdrop became (and stopped being) live */
    timestamp: EffectiveTimestampRange;
}

/**
 * A live HBAR spending allowance — the read-side counterpart of core's
 * `approveHbarAllowance`.
 */
export interface CryptoAllowance {
    /** Remaining allowance in tinybars */
    amount: string;
    /** Originally granted allowance in tinybars */
    amountGranted: string;
    /** Granting account */
    owner: string;
    /** Approved spender */
    spender: string;
    /** When the allowance became (and stopped being) live */
    timestamp: EffectiveTimestampRange;
}

/**
 * A live fungible-token spending allowance.
 */
export interface TokenAllowance extends CryptoAllowance {
    /** Token the allowance applies to */
    tokenId: string;
}

/**
 * A live approved-for-all NFT allowance.
 */
export interface NftAllowance {
    /** Whether the spender may transfer all of the owner's serials */
    approvedForAll: boolean;
    /** Granting account */
    owner: string;
    /** Approved spender */
    spender: string;
    /** NFT collection the allowance applies to */
    tokenId: string;
    /** When the allowance became (and stopped being) live */
    timestamp: EffectiveTimestampRange;
}
