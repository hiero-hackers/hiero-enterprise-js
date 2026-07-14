import type { MirrorKey } from "./common.js";

/**
 * Extended account information from the mirror node.
 */
export interface MirrorAccountInfo {
    /** The account ID */
    accountId: string;
    /** The EVM address */
    evmAddress?: string;
    /** RFC4648 no-padding base32 account alias, if the account has one */
    alias?: string;
    /** EIP-7702 delegation indicator ("0x" when none) */
    delegationAddress?: string;
    /** The account's key (material + algorithm) */
    key?: MirrorKey;
    /** Account balance in tinybars */
    balance: number;
    /** Whether the account has been deleted */
    deleted: boolean;
    /** Auto-renewal period in seconds */
    autoRenewPeriod?: number;
    /** Memo associated with the account */
    memo?: string;
    /** Maximum automatic token associations */
    maxAutomaticTokenAssociations?: number;
    /** Staking info */
    stakedAccountId?: string;
    stakedNodeId?: number;
    stakePeriodStart?: string;
    /** Account creation timestamp */
    createdTimestamp?: string;
    /** Expiration timestamp */
    expirationTimestamp?: string;
    /** Whether the account declines staking rewards */
    declineReward?: boolean;
    /** The account's ethereum transaction nonce */
    ethereumNonce?: number | null;
    /** Pending staking reward in tinybars (updates at period end) */
    pendingReward?: number;
    /** Whether transfers into the account require its signature */
    receiverSigRequired?: boolean | null;
}
