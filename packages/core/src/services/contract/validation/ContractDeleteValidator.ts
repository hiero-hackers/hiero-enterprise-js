import { validationError } from "../../../errors/index.js";
import type { ContractDeleteOperationOptions } from "../operations/index.js";

/**
 * Validates `ContractDeleteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractDeleteValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractDeleteOperationOptions): void {
        this.validateContractId(options);
        this.validateTransferTarget(options);
    }

    private validateContractId(options: ContractDeleteOperationOptions): void {
        if (options.contractId == null) {
            throw validationError(
                "ContractDeleteValidator",
                "contractId is required.",
            );
        }

        if (
            typeof options.contractId === "string" &&
            options.contractId.trim().length === 0
        ) {
            throw validationError(
                "ContractDeleteValidator",
                "contractId cannot be empty.",
            );
        }
    }

    /**
     * The network requires a destination for the contract's remaining HBAR
     * balance — exactly one of `transferAccountId` or `transferContractId`
     * must be supplied.
     */
    private validateTransferTarget(
        options: ContractDeleteOperationOptions,
    ): void {
        const hasAccount = options.transferAccountId != null;
        const hasContract = options.transferContractId != null;

        if (hasAccount && hasContract) {
            throw validationError(
                "ContractDeleteValidator",
                "Specify either transferAccountId or transferContractId, not both.",
            );
        }

        if (!hasAccount && !hasContract) {
            throw validationError(
                "ContractDeleteValidator",
                "A transfer target is required: provide either transferAccountId or transferContractId to receive the contract's remaining HBAR balance.",
            );
        }
    }
}
