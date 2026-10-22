import { validationError } from "../../../errors/index.js";
import type { HookStoreOperationOptions } from "../operations/HookStoreOperation.js";
import { validateHookId, validateStorageUpdates } from "./hooks.js";

/**
 * Validates `HookStoreOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class HookStoreValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: HookStoreOperationOptions): void {
        this.validateOwner(options);
        this.validateHookId(options);
        this.validateStorageUpdates(options);
    }

    /** The hook's owner is exactly one of an account or a contract. */
    private validateOwner(options: HookStoreOperationOptions): void {
        const hasAccount = options.accountId != null;
        const hasContract = options.contractId != null;

        if (hasAccount && hasContract) {
            throw validationError(
                "HookStoreValidator",
                "Specify either accountId or contractId as the hook owner, not both.",
            );
        }

        if (!hasAccount && !hasContract) {
            throw validationError(
                "HookStoreValidator",
                "A hook owner is required: provide either accountId or contractId.",
            );
        }

        const ownerId = options.accountId ?? options.contractId;

        if (typeof ownerId === "string" && ownerId.trim().length === 0) {
            throw validationError(
                "HookStoreValidator",
                `${hasAccount ? "accountId" : "contractId"} cannot be empty.`,
            );
        }
    }

    private validateHookId(options: HookStoreOperationOptions): void {
        if (options.hookId == null) {
            throw validationError("HookStoreValidator", "hookId is required.");
        }

        validateHookId("HookStoreValidator", "hookId", options.hookId);
    }

    private validateStorageUpdates(options: HookStoreOperationOptions): void {
        if (
            options.storageUpdates == null ||
            options.storageUpdates.length === 0
        ) {
            throw validationError(
                "HookStoreValidator",
                "storageUpdates must contain at least one update.",
            );
        }

        validateStorageUpdates(
            "HookStoreValidator",
            "storageUpdates",
            options.storageUpdates,
        );
    }
}
