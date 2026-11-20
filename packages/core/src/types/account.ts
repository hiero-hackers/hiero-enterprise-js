import type { AccountId } from "@hiero-ledger/sdk";
/**
 * The key algorithm type for the account.
 */
export enum AccountType {
    ED25519 = "ed25519",
    ECDSA = "ecdsa",
}

/**
 * The encoding/algorithm type for the operator private key.
 * Consumers pass plain strings like `"ed25519"` in config.
 */
export enum OperatorKeyType {
    ED25519 = "ed25519",
    ECDSA = "ecdsa",
    DER = "der",
}

/**
 * Represents a Hiero network account.
 */
export interface Account {
    /** The account ID */
    accountId: AccountId;
    /** The public key associated with the account */
    publicKey?: string;
    /** The EVM address alias, derived from a public key or given at creation */
    evmAddress?: string;
}
