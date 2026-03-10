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
    readonly accountId: string;
    /** The public key associated with the account */
    readonly publicKey: string;
    /** The private key (only available if the account was created by this client) */
    readonly privateKey?: string;
    /** The EVM address derived from the public key */
    readonly evmAddress?: string;
}

/**
 * Extended account information from the mirror node.
 */
export interface AccountInfo {
    /** The account ID */
    readonly accountId: string;
    /** The EVM address */
    readonly evmAddress?: string;
    /** The public key */
    readonly key?: string;
    /** Account balance in tinybars */
    readonly balance: number;
    /** Whether the account has been deleted */
    readonly deleted: boolean;
    /** Auto-renewal period in seconds */
    readonly autoRenewPeriod?: number;
    /** Memo associated with the account */
    readonly memo?: string;
    /** Maximum automatic token associations */
    readonly maxAutomaticTokenAssociations?: number;
    /** Staking info */
    readonly stakedAccountId?: string;
    readonly stakedNodeId?: number;
    readonly stakePeriodStart?: string;
    /** Account creation timestamp */
    readonly createdTimestamp?: string;
    /** Expiration timestamp */
    readonly expirationTimestamp?: string;
}
