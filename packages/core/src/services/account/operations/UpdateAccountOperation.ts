import { AccountUpdateTransaction, Long } from "@hiero-ledger/sdk";
import type { Key, HookCreationDetails } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { UpdateAccountValidator } from "../validation/UpdateAccountValidator.js";

/**
 * Options for updating an existing account on the Hiero network.
 *
 * Extends `TransactionOptions` for full control over fees, validity window,
 * additional signers, and scheduling.
 */
export interface UpdateAccountOptions extends TransactionOptions {
    /** The ID of the account to update (e.g., "0.0.12345"). */
    accountId: string;

    /**
     * New key for the account (key rotation).
     *
     * Replaces the account's current control key. Both the old key AND the
     * new key must sign the transaction — pass them via `additionalSigners`
     * or `externalSigners`.
     *
     * Accepts any SDK Key type:
     * - `PublicKey` — single key
     * - `KeyList` — all keys must sign
     * - `KeyList(keys, threshold)` — N-of-M threshold
     */
    key?: Key;

    /**
     * New expiration time for the account.
     *
     * Can only be extended, not shortened. Accepts a `Date` instance.
     */
    expirationTime?: Date;

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
     * Auto-renew period in seconds (network bounds apply, by default 30 days to 8,000,001 s).
     * Controls how long the account survives without being explicitly renewed.
     */
    autoRenewPeriod?: number;

    /**
     * Hooks to add to the account (HIP-1195). Each needs an extension point
     * (`HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK`), a hook ID unique within the
     * list, and an `EvmHook` with the hook contract.
     */
    hooksToCreate?: HookCreationDetails[];

    /** Hook IDs (non-negative integers) of the account's hooks to delete (HIP-1195). */
    hooksToDelete?: (number | Long)[];
}

export class UpdateAccountOperation extends BaseOperation<UpdateAccountOptions> {
    protected readonly type = "AccountUpdate";
    protected readonly serviceName = "AccountService";
    protected readonly methodName = "updateAccount";
    protected readonly validator = new UpdateAccountValidator();

    /** Update account execute handler. */
    async execute(options: UpdateAccountOptions) {
        return await this.run(options);
    }

    /** Schedule account update */
    async schedule(
        options: UpdateAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    /**
     * Constructs the `AccountUpdateTransaction` from the caller-provided
     * options.
     */
    protected build(options: UpdateAccountOptions): AccountUpdateTransaction {
        const tx = new AccountUpdateTransaction().setAccountId(
            options.accountId,
        );

        if (options.key != null) {
            tx.setKey(options.key);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

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

        if (options.hooksToCreate != null) {
            tx.setHooksToCreate(options.hooksToCreate);
        }

        if (options.hooksToDelete != null) {
            tx.setHooksToDelete(
                options.hooksToDelete.map((hookId) => Long.fromValue(hookId)),
            );
        }

        return tx;
    }
}
