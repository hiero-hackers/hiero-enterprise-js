/**
 * The type of account (and underlying key) to generate.
 */
export enum AccountType {
    NATIVE = "ED25519",
    EVM = "ECDSA",
}

/**
 * Represents a Hiero network account.
 */
export interface Account {
    /** The account ID (e.g., "0.0.12345") */
    accountId: string;
    /** The public key associated with the account */
    publicKey: string;
    /** The private key (only available if the account was created by this client) */
    privateKey?: string;
    /** The EVM address derived from the public key */
    evmAddress?: string;
}

/**
 * Extended account information from the mirror node.
 */
export interface AccountInfo {
    /** The account ID */
    accountId: string;
    /** The EVM address */
    evmAddress?: string;
    /** The public key */
    key?: string;
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
}
