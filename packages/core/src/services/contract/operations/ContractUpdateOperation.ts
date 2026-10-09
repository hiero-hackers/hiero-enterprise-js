import type {
    AccountId,
    ContractId,
    FileId,
    Key,
    Long,
    Timestamp,
} from "@hiero-ledger/sdk";
import { ContractUpdateTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { ContractUpdateValidator } from "../validation/index.js";

/**
 * Low-level options for the `ContractUpdate` SDK transaction.
 *
 * Mirrors the surface of `ContractUpdateTransaction`. Callers usually go
 * through `ContractService.updateContract`, which exposes a friendlier
 * shape. Use this directly when you need full control over every field.
 *
 * Only properties that are explicitly set are sent to the network;
 * omitted fields are left unchanged on the contract.
 *
 * Updating any field requires the contract's current `adminKey` to sign
 * the transaction — pass it via `additionalSigners`. Contracts deployed
 * without an admin key are immutable and cannot be updated.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface ContractUpdateOperationOptions extends TransactionOptions {
    /** Contract to update. */
    contractId: string | ContractId;
    /** Replace the current admin key. */
    adminKey?: Key;
    /** New contract-level memo (max 100 bytes). */
    contractMemo?: string;
    /** New auto-renew period, in seconds. */
    autoRenewPeriod?: Long | number;
    /** Replace the auto-renew payer account. */
    autoRenewAccountId?: string | AccountId;
    /** Extend the contract's expiration. */
    expirationTime?: Timestamp | Date;
    /** Replace the bytecode pointer (advanced — most contracts are immutable). */
    bytecodeFileId?: string | FileId;
    /** Switch staking target. Mutually exclusive with `stakedNodeId`. */
    stakedAccountId?: string | AccountId;
    /** Switch staking target. Mutually exclusive with `stakedAccountId`. */
    stakedNodeId?: Long | number;
    /** Toggle staking-reward decline. */
    declineStakingReward?: boolean;
    /**
     * Update the auto-association limit (HIP-23). `-1` is unlimited (HIP-904).
     */
    maxAutomaticTokenAssociations?: number;
}

export class ContractUpdateOperation extends BaseOperation<ContractUpdateOperationOptions> {
    protected readonly type = "ContractUpdate";
    protected readonly serviceName = "ContractService";
    protected readonly methodName = "updateContract";
    protected readonly validator = new ContractUpdateValidator();

    /**
     * Submit a `ContractUpdateTransaction`.
     */
    async execute(options: ContractUpdateOperationOptions) {
        return await this.run(options);
    }

    /** Schedule a `ContractUpdateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: ContractUpdateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    /**
     * Construct the `ContractUpdateTransaction` from the caller-provided
     * options.
     *
     * Only setters for fields that were actually provided are invoked so
     * the SDK leaves omitted properties unchanged on the contract.
     */
    protected build(
        options: ContractUpdateOperationOptions,
    ): ContractUpdateTransaction {
        const tx = new ContractUpdateTransaction().setContractId(
            options.contractId,
        );

        if (options.adminKey != null) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.contractMemo != null) {
            tx.setContractMemo(options.contractMemo);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.autoRenewAccountId != null) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        if (options.bytecodeFileId != null) {
            tx.setBytecodeFileId(options.bytecodeFileId);
        }

        if (options.stakedAccountId != null) {
            tx.setStakedAccountId(options.stakedAccountId);
        }

        if (options.stakedNodeId != null) {
            tx.setStakedNodeId(options.stakedNodeId);
        }

        if (options.declineStakingReward != null) {
            tx.setDeclineStakingReward(options.declineStakingReward);
        }

        if (options.maxAutomaticTokenAssociations != null) {
            tx.setMaxAutomaticTokenAssociations(
                options.maxAutomaticTokenAssociations,
            );
        }

        return tx;
    }
}
