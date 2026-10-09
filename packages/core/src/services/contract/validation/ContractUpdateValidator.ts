import { validationError } from "../../../errors/index.js";
import type { ContractUpdateOperationOptions } from "../operations/ContractUpdateOperation.js";

const MAX_CONTRACT_MEMO_BYTES = 100;

/**
 * Validates `ContractUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractUpdateOperationOptions): void {
        this.validateContractId(options);
        this.validateMemo(options);
        this.validateStakingMutex(options);
        this.validateMaxAutomaticTokenAssociations(options);
    }

    private validateContractId(options: ContractUpdateOperationOptions): void {
        if (options.contractId == null) {
            throw validationError(
                "ContractUpdateValidator",
                "contractId is required.",
            );
        }

        if (
            typeof options.contractId === "string" &&
            options.contractId.trim().length === 0
        ) {
            throw validationError(
                "ContractUpdateValidator",
                "contractId cannot be empty.",
            );
        }
    }

    private validateMemo(options: ContractUpdateOperationOptions): void {
        if (options.contractMemo == null) return;

        const byteLength = Buffer.byteLength(options.contractMemo, "utf8");
        if (byteLength > MAX_CONTRACT_MEMO_BYTES) {
            throw validationError(
                "ContractUpdateValidator",
                `contractMemo exceeds ${MAX_CONTRACT_MEMO_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateStakingMutex(
        options: ContractUpdateOperationOptions,
    ): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw validationError(
                "ContractUpdateValidator",
                "Specify either stakedAccountId or stakedNodeId, not both.",
            );
        }
    }

    /**
     * `maxAutomaticTokenAssociations` accepts `-1` (HIP-904 — unlimited)
     * or any non-negative integer. Anything else is rejected before the
     * SDK serializes a value the network will refuse.
     */
    private validateMaxAutomaticTokenAssociations(
        options: ContractUpdateOperationOptions,
    ): void {
        const value = options.maxAutomaticTokenAssociations;
        if (value == null) return;

        if (!Number.isInteger(value)) {
            throw validationError(
                "ContractUpdateValidator",
                "maxAutomaticTokenAssociations must be an integer.",
            );
        }

        if (value < -1) {
            throw validationError(
                "ContractUpdateValidator",
                "maxAutomaticTokenAssociations must be -1 (unlimited) or a non-negative integer.",
            );
        }
    }
}
