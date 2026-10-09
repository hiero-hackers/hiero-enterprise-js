import type { NftAllowanceDeletion } from "../operations/DeleteAllowanceOperation.js";
import { validationError } from "../../../errors/index.js";

/**
 * Validates an array of `NftAllowanceDeletion` entries before building the
 * SDK transaction.
 */
export class DeleteAllowanceValidator {
    validate(allowances: NftAllowanceDeletion[]): void {
        this.validateAtLeastOneAllowance(allowances);
        this.validateNftAllowances(allowances);
    }

    private validateAtLeastOneAllowance(
        allowances: NftAllowanceDeletion[],
    ): void {
        if (!allowances || allowances.length === 0) {
            throw validationError(
                "DeleteAllowanceValidator",
                "nftAllowances must be provided with at least one entry.",
            );
        }
    }

    private validateNftAllowances(allowances: NftAllowanceDeletion[]): void {
        for (const allowance of allowances) {
            if (!allowance.tokenId) {
                throw validationError(
                    "DeleteAllowanceValidator",
                    "nftAllowances[].tokenId is required.",
                );
            }

            if (!allowance.ownerAccountId) {
                throw validationError(
                    "DeleteAllowanceValidator",
                    "nftAllowances[].ownerAccountId is required.",
                );
            }

            if (
                !allowance.serialNumbers ||
                allowance.serialNumbers.length === 0
            ) {
                throw validationError(
                    "DeleteAllowanceValidator",
                    "nftAllowances[].serialNumbers must contain at least one entry.",
                );
            }

            for (const serial of allowance.serialNumbers) {
                if (serial <= 0 || !Number.isInteger(serial)) {
                    throw validationError(
                        "DeleteAllowanceValidator",
                        `nftAllowances[].serialNumbers must be positive integers, got ${serial}.`,
                    );
                }
            }
        }
    }
}
