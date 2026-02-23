/**
 * Transaction information from the mirror node.
 */
export interface TransactionInfo {
    /** Transaction ID */
    readonly transactionId: string;
    /** Transaction type (e.g., "CRYPTOTRANSFER", "TOKENCREATION") */
    readonly type: string;
    /** Human-readable name */
    readonly name: string;
    /** Transaction result status */
    readonly result: string;
    /** Consensus timestamp */
    readonly consensusTimestamp: string;
    /** Valid start timestamp */
    readonly validStartTimestamp: string;
    /** Whether the transaction was successful */
    readonly successful: boolean;
    /** Charged transaction fee in tinybars */
    readonly chargedTxFee: number;
    /** Memo */
    readonly memo?: string;
    /** HBAR transfers */
    readonly transfers: Transfer[];
    /** Token transfers */
    readonly tokenTransfers: TokenTransferInfo[];
    /** NFT transfers */
    readonly nftTransfers: NftTransferInfo[];
    /** Staking reward transfers */
    readonly stakingRewardTransfers: StakingRewardTransfer[];
}

/**
 * HBAR transfer within a transaction.
 */
export interface Transfer {
    /** Account ID */
    readonly accountId: string;
    /** Amount in tinybars (negative = sent, positive = received) */
    readonly amount: number;
    /** Whether this is a reward payout */
    readonly isApproval: boolean;
}

/**
 * Token transfer within a transaction.
 */
export interface TokenTransferInfo {
    /** Token ID */
    readonly tokenId: string;
    /** Account ID */
    readonly accountId: string;
    /** Amount transferred */
    readonly amount: number;
}

/**
 * NFT transfer within a transaction.
 */
export interface NftTransferInfo {
    /** Token ID */
    readonly tokenId: string;
    /** Serial number */
    readonly serialNumber: number;
    /** Sender account ID */
    readonly senderAccountId: string;
    /** Receiver account ID */
    readonly receiverAccountId: string;
}

/**
 * Staking reward transfer.
 */
export interface StakingRewardTransfer {
    /** Account ID receiving the reward */
    readonly accountId: string;
    /** Reward amount in tinybars */
    readonly amount: number;
}

/**
 * Transaction type enum matching Hedera's transaction types.
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
