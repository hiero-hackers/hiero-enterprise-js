import type { PageQuery, TimestampFilter } from "./query.js";
import type { MirrorKey } from "./common.js";

/**
 * Transaction information from the mirror node.
 */
export interface TransactionInfo {
    /** Transaction ID */
    transactionId: string;
    /** Transaction type (e.g., "CRYPTOTRANSFER", "TOKENCREATION") */
    type: string;
    /** Human-readable name */
    name: string;
    /** Transaction result status */
    result: string;
    /** Consensus timestamp */
    consensusTimestamp: string;
    /** Valid start timestamp */
    validStartTimestamp: string;
    /** Whether the transaction was successful */
    successful: boolean;
    /** Charged transaction fee in tinybars */
    chargedTxFee: number;
    /** Memo */
    memo?: string;
    /** HBAR transfers */
    transfers: Transfer[];
    /** Token transfers */
    tokenTransfers: TokenTransferInfo[];
    /** NFT transfers */
    nftTransfers: NftTransferInfo[];
    /** Staking reward transfers */
    stakingRewardTransfers: StakingRewardTransfer[];
    /** Batch key for atomic batch transactions, if readable */
    batchKey?: MirrorKey | null;
    /** The transaction bytes, base64 (usually null) */
    bytes?: string | null;
    /** The entity the transaction created or touched (account/token/…) */
    entityId?: string | null;
    /** Whether HIP-1313 high-volume throttles/pricing applied */
    highVolume?: boolean;
    /** HIP-1313 fee multiplier scaled by 1000, when in effect */
    highVolumePricingMultiplier?: number | null;
    /** HIP-18 custom fee limits attached to the transaction */
    maxCustomFees?: CustomFeeLimit[];
    /** Maximum fee the payer allowed, in tinybars */
    maxFee?: string;
    /** The node account the transaction was submitted to */
    node?: string | null;
    /** Nonce distinguishing child transactions (0 = parent) */
    nonce?: number;
    /** Consensus timestamp of the parent transaction, if a child */
    parentConsensusTimestamp?: string | null;
    /** Whether this is the scheduled execution of a schedule */
    scheduled?: boolean;
    /** The transaction hash, base64 */
    transactionHash?: string;
    /** Valid duration in seconds */
    validDurationSeconds?: string | null;
    /** Custom fees actually charged (single-transaction lookups) */
    assessedCustomFees?: AssessedCustomFee[];
}

/**
 * A custom fee actually charged by a transaction.
 */
export interface AssessedCustomFee {
    /** Fee amount, in the denominating token's smallest unit */
    amount: number;
    /** The fee collector */
    collectorAccountId: string | null;
    /** Accounts that effectively paid the fee */
    effectivePayerAccountIds: string[];
    /** Denominating token, or null for HBAR */
    tokenId: string | null;
}

/**
 * A HIP-18 custom fee limit attached to a transaction.
 */
export interface CustomFeeLimit {
    /** The payer account the limit applies to */
    accountId: string | null;
    /** Maximum fee amount */
    amount: number;
    /** Denominating token, or null for HBAR */
    denominatingTokenId: string | null;
}

/**
 * HBAR transfer within a transaction.
 */
export interface Transfer {
    /** Account ID */
    accountId: string;
    /** Amount in tinybars (negative = sent, positive = received) */
    amount: number;
    /** Whether this is a reward payout */
    isApproval: boolean;
}

/**
 * Token transfer within a transaction.
 */
export interface TokenTransferInfo {
    /** Token ID */
    tokenId: string;
    /** Account ID */
    accountId: string;
    /** Amount transferred */
    amount: number;
    /** Whether this leg spent an allowance */
    isApproval?: boolean;
}

/**
 * NFT transfer within a transaction.
 */
export interface NftTransferInfo {
    /** Token ID */
    tokenId: string;
    /** Serial number */
    serialNumber: number;
    /** Sender account ID */
    senderAccountId: string;
    /** Receiver account ID */
    receiverAccountId: string;
    /** Whether this leg spent an allowance */
    isApproval?: boolean;
}

/**
 * Staking reward transfer.
 */
export interface StakingRewardTransfer {
    /** Account ID receiving the reward */
    accountId: string;
    /** Reward amount in tinybars */
    amount: number;
}

/**
 * Transaction type enum matching Hiero's transaction types.
 */
export type TransactionType =
    | "CONSENSUSCREATETOPIC"
    | "CONSENSUSDELETETOPIC"
    | "CONSENSUSSUBMITMESSAGE"
    | "CONSENSUSUPDATETOPIC"
    | "CONTRACTCALL"
    | "CONTRACTCREATEINSTANCE"
    | "CONTRACTDELETEINSTANCE"
    | "CONTRACTUPDATEINSTANCE"
    | "CRYPTOADDLIVEHASH"
    | "CRYPTOAPPROVEALLOWANCE"
    | "CRYPTOCREATEACCOUNT"
    | "CRYPTODELETE"
    | "CRYPTODELETELIVEHASH"
    | "CRYPTOTRANSFER"
    | "CRYPTOUPDATEACCOUNT"
    | "FILEAPPEND"
    | "FILECREATE"
    | "FILEDELETE"
    | "FILEUPDATE"
    | "FREEZE"
    | "SCHEDULECREATE"
    | "SCHEDULEDELETE"
    | "SCHEDULESIGN"
    | "SYSTEMDELETE"
    | "SYSTEMUNDELETE"
    | "TOKENASSOCIATE"
    | "TOKENAIRDROP"
    | "TOKENBURN"
    | "TOKENCREATION"
    | "TOKENDELETION"
    | "TOKENDISSOCIATE"
    | "TOKENFEESCHEDULEUPDATE"
    | "TOKENFREEZE"
    | "TOKENGRANTKYC"
    | "TOKENMINT"
    | "TOKENPAUSE"
    | "TOKENREVOKEKYC"
    | "TOKENUNFREEZE"
    | "TOKENUNPAUSE"
    | "TOKENUPDATE"
    | "TOKENWIPE"
    | "UNCHECKEDSUBMIT";

/**
 * Filters for a transaction list query — page controls plus a consensus
 * timestamp window, a transaction type, and optionally an account, bundled
 * into one call so you don't craft a separate query per filter.
 *
 * Omit `accountId` to search network-wide (e.g. "the largest transfers
 * today" or "all contract calls in this window").
 */
export interface TransactionQuery extends PageQuery {
    /** Restrict to transactions involving this account. */
    readonly accountId?: string;
    /** Filter by outcome: only successful or only failed transactions. */
    readonly result?: "success" | "fail";
    /** Filter by consensus timestamp — a point in time or a range. */
    readonly timestamp?: TimestampFilter;
    /** Filter to a single transaction type, e.g. `"CRYPTOTRANSFER"`. */
    readonly transactionType?: TransactionType;
    /** Filter by transfer direction for the account: credit or debit. */
    readonly type?: "credit" | "debit";
}
