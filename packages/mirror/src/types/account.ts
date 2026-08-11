import type { MirrorKey } from "./common.js";
import type { TokenBalance } from "./balance.js";

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
    /** Account balance in tinybars — decimal string; live values exceed 2^53 */
    balance: string;
    /**
     * When the mirror node snapshotted `balance` and `tokenBalances`.
     *
     * A balance is a snapshot, and this is the moment it describes — without
     * it, `balance` is a number whose meaning depends on when you asked.
     */
    balanceTimestamp?: string | null;
    /**
     * Token balances the account holds, as reported alongside the HBAR balance.
     *
     * `/api/v1/accounts/{id}` returns these in the same response as the account
     * itself; they are surfaced here so that reading them does not require a
     * second request to the identical URL (which is what `getBalance` does).
     */
    tokenBalances?: TokenBalance[];
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
    pendingReward?: string;
    /** Whether transfers into the account require its signature */
    receiverSigRequired?: boolean | null;
}
