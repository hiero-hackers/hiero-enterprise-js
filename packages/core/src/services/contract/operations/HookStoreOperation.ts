import type { EvmHookStorageUpdate } from "@hiero-ledger/sdk";
import {
    AccountId,
    ContractId,
    HookEntityId,
    HookId,
    HookStoreTransaction,
    Long,
} from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { HookStoreValidator } from "../validation/index.js";

/**
 * Options for the `HookStore` SDK transaction (HIP-1195), which updates an
 * EVM hook's storage.
 *
 * A hook is identified by its owner, an account or a contract (exactly one
 * of `accountId` / `contractId`), plus the owner's hook ID.
 *
 * Either the owner's key or the hook's admin key must sign; pass it via
 * `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window and additional
 * signers. The network does not allow scheduling a `HookStore`.
 */
export interface HookStoreOperationOptions extends TransactionOptions {
    /** Account that owns the hook. Mutually exclusive with `contractId`. */
    accountId?: string | AccountId;
    /** Contract that owns the hook. Mutually exclusive with `accountId`. */
    contractId?: string | ContractId;
    /** The owner's hook ID (a non-negative integer). */
    hookId: number | Long;
    /**
     * Storage changes, at least one: `EvmHookStorageSlot` (`key`, `value`)
     * or `EvmHookMappingEntries` (`mappingSlot` and entries by `key` or
     * `preimage`). Keys, values and mapping slots are at most 32 bytes with
     * no leading zero bytes; an empty value deletes the slot.
     */
    storageUpdates: EvmHookStorageUpdate[];
}

export class HookStoreOperation extends BaseOperation<HookStoreOperationOptions> {
    protected readonly type = "HookStore";
    protected readonly serviceName = "ContractService";
    protected readonly methodName = "updateHookStorage";
    protected readonly validator = new HookStoreValidator();

    /** Submit a `HookStoreTransaction`. */
    async execute(options: HookStoreOperationOptions) {
        return await this.run(options);
    }

    /** Construct the `HookStoreTransaction` from the caller-provided options. */
    protected build(options: HookStoreOperationOptions): HookStoreTransaction {
        let entityId: HookEntityId;

        if (options.accountId != null) {
            const accountId =
                typeof options.accountId === "string"
                    ? AccountId.fromString(options.accountId)
                    : options.accountId;
            entityId = new HookEntityId({ accountId });
        } else {
            const contractId =
                typeof options.contractId === "string"
                    ? ContractId.fromString(options.contractId)
                    : options.contractId;
            entityId = new HookEntityId({ contractId });
        }

        return new HookStoreTransaction()
            .setHookId(
                new HookId({
                    entityId,
                    hookId: Long.fromValue(options.hookId),
                }),
            )
            .setStorageUpdates(options.storageUpdates);
    }
}
