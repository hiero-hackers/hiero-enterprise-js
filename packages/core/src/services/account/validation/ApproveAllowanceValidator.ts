import type { ApproveAllowanceOptions } from "../operations/ApproveAllowanceOperation.js";
import { validationError } from "../../../errors/index.js";

/**
 * Validates `ApproveAllowanceOptions` before building the SDK transaction.
 */
export class ApproveAllowanceValidator {
    validate(options: ApproveAllowanceOptions): void {
        this.validateAtLeastOneAllowance(options);
        this.validateHbarAllowances(options);
        this.validateTokenAllowances(options);
        this.validateNftAllowances(options);
    }

    private validateAtLeastOneAllowance(
        options: ApproveAllowanceOptions,
    ): void {
        const hasHbar = (options.hbarAllowances?.length ?? 0) > 0;
        const hasToken = (options.tokenAllowances?.length ?? 0) > 0;
        const hasNft = (options.nftAllowances?.length ?? 0) > 0;

        if (!hasHbar && !hasToken && !hasNft) {
            throw validationError(
                "ApproveAllowanceValidator",
                "At least one allowance must be provided (hbarAllowances, tokenAllowances, or nftAllowances).",
            );
        }
    }

    private validateHbarAllowances(options: ApproveAllowanceOptions): void {
        for (const allowance of options.hbarAllowances ?? []) {
            if (!allowance.ownerAccountId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "hbarAllowances[].ownerAccountId is required.",
                );
            }

            if (!allowance.spenderAccountId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "hbarAllowances[].spenderAccountId is required.",
                );
            }

            if (allowance.amount == null) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "hbarAllowances[].amount is required.",
                );
            }

            if (typeof allowance.amount === "number" && allowance.amount < 0) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "hbarAllowances[].amount cannot be negative.",
                );
            }
        }
    }

    private validateTokenAllowances(options: ApproveAllowanceOptions): void {
        for (const allowance of options.tokenAllowances ?? []) {
            if (!allowance.tokenId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "tokenAllowances[].tokenId is required.",
                );
            }

            if (!allowance.ownerAccountId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "tokenAllowances[].ownerAccountId is required.",
                );
            }

            if (!allowance.spenderAccountId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "tokenAllowances[].spenderAccountId is required.",
                );
            }

            if (allowance.amount == null) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "tokenAllowances[].amount is required.",
                );
            }

            if (Number(allowance.amount) < 0) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "tokenAllowances[].amount cannot be negative.",
                );
            }

            if (
                typeof allowance.amount === "number" &&
                (!Number.isFinite(allowance.amount) ||
                    !Number.isInteger(allowance.amount))
            ) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "tokenAllowances[].amount must be a finite integer.",
                );
            }
        }
    }

    private validateNftAllowances(options: ApproveAllowanceOptions): void {
        for (const allowance of options.nftAllowances ?? []) {
            if (!allowance.tokenId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "nftAllowances[].tokenId is required.",
                );
            }

            if (!allowance.ownerAccountId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "nftAllowances[].ownerAccountId is required.",
                );
            }

            if (!allowance.spenderAccountId) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "nftAllowances[].spenderAccountId is required.",
                );
            }

            const hasSerials =
                allowance.serialNumbers != null &&
                allowance.serialNumbers.length > 0;
            const hasAllSerials = allowance.allSerials === true;

            if (!hasSerials && !hasAllSerials) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "nftAllowances[] must specify either serialNumbers or allSerials: true.",
                );
            }

            if (hasSerials && hasAllSerials) {
                throw validationError(
                    "ApproveAllowanceValidator",
                    "nftAllowances[].serialNumbers and allSerials are mutually exclusive.",
                );
            }

            if (hasSerials) {
                for (const serial of allowance.serialNumbers!) {
                    if (serial <= 0 || !Number.isInteger(serial)) {
                        throw validationError(
                            "ApproveAllowanceValidator",
                            `nftAllowances[].serialNumbers must be positive integers, got ${serial}.`,
                        );
                    }
                }
            }
        }
    }
}
