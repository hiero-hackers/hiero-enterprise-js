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
