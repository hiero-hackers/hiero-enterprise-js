import type { NftAllSerialsAllowanceDeletion } from "../operations/DeleteAllNftAllowancesOperation.js";
import { validationError } from "../../../errors/index.js";

/**
 * Validates an array of `NftAllSerialsAllowanceDeletion` entries before
 * building the SDK transaction.
 */
export class DeleteAllNftAllowancesValidator {
    validate(allowances: NftAllSerialsAllowanceDeletion[]): void {
        this.validateAtLeastOneAllowance(allowances);
        this.validateNftAllowances(allowances);
    }

    private validateAtLeastOneAllowance(
        allowances: NftAllSerialsAllowanceDeletion[],
    ): void {
        if (!allowances || allowances.length === 0) {
            throw validationError(
                "DeleteAllNftAllowancesValidator",
                "nftAllowances must be provided with at least one entry.",
            );
        }
    }

    private validateNftAllowances(
        allowances: NftAllSerialsAllowanceDeletion[],
    ): void {
        for (const allowance of allowances) {
            if (!allowance.tokenId) {
                throw validationError(
                    "DeleteAllNftAllowancesValidator",
                    "nftAllowances[].tokenId is required.",
                );
            }

            if (!allowance.ownerAccountId) {
                throw validationError(
                    "DeleteAllNftAllowancesValidator",
                    "nftAllowances[].ownerAccountId is required.",
                );
            }

            if (!allowance.spenderAccountId) {
                throw validationError(
                    "DeleteAllNftAllowancesValidator",
                    "nftAllowances[].spenderAccountId is required.",
                );
            }
        }
    }
}
