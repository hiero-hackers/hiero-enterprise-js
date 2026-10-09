import type { TransactionReceipt, Key } from "@hiero-ledger/sdk";
import { AccountCreateTransaction, PublicKey, Hbar } from "@hiero-ledger/sdk";
import { AccountType } from "../../../types/index.js";
import type { Account } from "../../../types/index.js";
import { HieroError } from "../../../errors/HieroError.js";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { CreateAccountValidator } from "../validation/index.js";

/**
 * Options for creating a new account on the Hiero network.
 *
 * The caller is responsible for key generation (e.g. via HSM, KMS, or wallet).
 * Only the public key is provided here — private key material never enters
 * this library.
 *
 * Provide either `publicKey` (string shorthand for a single key) OR `key`
 * (SDK Key type for KeyList / threshold keys) — not both.
 *
 * Extends `TransactionOptions` for full control over fees, validity window,
 * additional signers, and scheduling.
 */
export interface CreateAccountOptions extends TransactionOptions {
    /**
     * The public key for the new account (raw hex or DER-encoded hex).
     *
     * Use this for the common single-key case. Mutually exclusive with `key`.
     * When provided, `keyType` specifies how to parse the string.
     */
    publicKey?: string;

    /**
     * How to parse the `publicKey` string. Required when `publicKey` is provided
     * as raw hex where the algorithm cannot be inferred. For DER-encoded keys,
     * the specified type must match the algorithm encoded in the DER prefix.
     *
     * Defaults to `AccountType.ED25519`. Ignored when `key` is provided.
     */
    keyType?: AccountType;

    /**
     * SDK Key instance for the new account.
     *
     * Use this for advanced key structures (KeyList, threshold keys) or when
     * you already have a parsed Key object. Mutually exclusive with `publicKey`.
     *
     * Examples:
     * - `PublicKey.fromStringED25519("302a...")`
     * - `new KeyList([keyA, keyB, keyC])` — all must sign
     * - `new KeyList([keyA, keyB, keyC], 2)` — 2-of-3 threshold
     */
    key?: Key;

    /**
     * Whether to derive an EVM alias for the account.
     *
     * - `true` — derives alias from `publicKey` (requires `keyType: "ECDSA"`).
     * - `{ ecdsaPublicKey: string }` — derives alias from a separate ECDSA key
     *   while using `publicKey` as the account's controlling key (two-key pattern).
     *   The separate key's derived EVM address becomes the permanent, immutable alias.
     * - `undefined` / `false` — no alias is set.
     *
     * Note: aliases are immutable once set. Do not set an alias if you plan
     * to rotate keys in the future.
     */
    alias?: boolean | { ecdsaPublicKey: string };

    /** Initial balance in HBAR (default: 0). Accepts Hbar instance for tinybar precision. */
    initialBalance?: number | Hbar;

    /** Whether the receiver signature is required for transfers to this account. */
    receiverSignatureRequired?: boolean;

    /** Account memo (max 100 bytes). */
    memo?: string;

    /** Maximum number of automatic token associations (default: 0, use -1 for unlimited). */
    maxAutomaticTokenAssociations?: number;

    /** Account ID to stake to for earning rewards. Mutually exclusive with `stakedNodeId`. */
    stakedAccountId?: string;

    /** Node ID to stake to for earning rewards. Mutually exclusive with `stakedAccountId`. */
    stakedNodeId?: number;

    /** Whether to decline staking rewards (default: false). */
    declineStakingReward?: boolean;

    /**
     * Auto-renew period in seconds (must be between 30 and 90 days).
     * Controls how long the account survives without being explicitly renewed.
     */
    autoRenewPeriod?: number;
}

export class CreateAccountOperation extends BaseOperation<CreateAccountOptions> {
    protected readonly type = "AccountCreate";
    protected readonly serviceName = "AccountService";
    protected readonly methodName = "createAccount";
    protected readonly validator = new CreateAccountValidator();

    /** Create account execute handler. */
    async execute(options: CreateAccountOptions) {
        const results = await this.run(options);
        return {
            ...results,
            ...this.toAccount(results.receipt, options),
        };
    }

    /** Schedule account creation */
    async schedule(
        options: CreateAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    /**
     * Constructs the `AccountCreateTransaction` from the caller-provided
     * options.
     */
    protected build(options: CreateAccountOptions): AccountCreateTransaction {
        const tx = new AccountCreateTransaction();

        if (options.key != null) {
            // Advanced path: SDK Key used directly (KeyList, threshold, or pre-parsed PublicKey)
            tx.setKeyWithoutAlias(options.key);
        } else {
            // Simple path: parse publicKey string with keyType
            const keyType = options.keyType ?? AccountType.ED25519;
            const publicKey =
                keyType === AccountType.ED25519
                    ? PublicKey.fromStringED25519(options.publicKey!)
                    : PublicKey.fromStringECDSA(options.publicKey!);

            // Key + alias strategy
            if (options.alias === true) {
                // CreateAccountValidator ensures keyType === ECDSA when alias is true
                tx.setECDSAKeyWithAlias(publicKey);
            } else if (
                typeof options.alias === "object" &&
                options.alias?.ecdsaPublicKey
            ) {
                // Two-key pattern: account controlled by publicKey, alias derived from a separate ECDSA key
                const aliasKey = PublicKey.fromStringECDSA(
                    options.alias.ecdsaPublicKey,
                );
                tx.setKeyWithAlias(publicKey, aliasKey);
            } else {
                tx.setKeyWithoutAlias(publicKey);
            }
        }

        // Initial balance
        const hbarBalance =
            options.initialBalance instanceof Hbar
                ? options.initialBalance
                : new Hbar(options.initialBalance ?? 0);
        tx.setInitialBalance(hbarBalance);

        // Optional properties
        if (options.receiverSignatureRequired != null) {
            tx.setReceiverSignatureRequired(options.receiverSignatureRequired);
        }

        if (options.memo != null) {
            tx.setAccountMemo(options.memo);
        }

        if (options.maxAutomaticTokenAssociations != null) {
            tx.setMaxAutomaticTokenAssociations(
                options.maxAutomaticTokenAssociations,
            );
        }

        if (options.stakedAccountId != null) {
            tx.setStakedAccountId(options.stakedAccountId);
        }

        if (options.stakedNodeId != null) {
            tx.setStakedNodeId(options.stakedNodeId);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.declineStakingReward != null) {
            tx.setDeclineStakingReward(options.declineStakingReward);
        }

        return tx;
    }

    /**
     * Maps the network receipt to the `Account` return type.
     */
    private toAccount(
        receipt: TransactionReceipt,
        options: CreateAccountOptions,
    ): Account {
        if (!receipt.accountId) {
            throw new HieroError(
                "Account creation failed — no accountId returned in receipt.",
                {
                    code: "SDK_ERROR",
                    context: "CreateAccountOperation.execute",
                    sdkStatus: receipt.status.toString(),
                },
            );
        }
        const result: Account = {
            accountId: receipt.accountId,
        };

        if (options.key != null) {
            // When using SDK Key directly, stringify it for the response
            result.publicKey = options.key.toString();
        } else {
            const keyType = options.keyType ?? AccountType.ED25519;
            const publicKey =
                keyType === AccountType.ED25519
                    ? PublicKey.fromStringED25519(options.publicKey!)
                    : PublicKey.fromStringECDSA(options.publicKey!);

            result.publicKey = publicKey.toString();

            // Include EVM address if an alias was set
            if (options.alias === true) {
                result.evmAddress = publicKey.toEvmAddress();
            } else if (
                typeof options.alias === "object" &&
                options.alias?.ecdsaPublicKey
            ) {
                result.evmAddress = PublicKey.fromStringECDSA(
                    options.alias.ecdsaPublicKey,
                ).toEvmAddress();
            }
        }

        return result;
    }
}
