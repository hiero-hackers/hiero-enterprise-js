import { validationError } from "../../../errors/index.js";
import type { TokenFeeScheduleUpdateOperationOptions } from "../operations/TokenFeeScheduleUpdateOperation.js";

/**
 * Validates `TokenFeeScheduleUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenFeeScheduleUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenFeeScheduleUpdateOperationOptions): void {
        this.validateTokenId(options);
        this.validateCustomFees(options);
    }

    private validateTokenId(
        options: TokenFeeScheduleUpdateOperationOptions,
    ): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenFeeScheduleUpdateValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenFeeScheduleUpdateValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateCustomFees(
        options: TokenFeeScheduleUpdateOperationOptions,
    ): void {
        if (options.customFees == null) {
            throw validationError(
                "TokenFeeScheduleUpdateValidator",
                "customFees is required. Pass an empty array to clear all custom fees.",
            );
        }

        if (!Array.isArray(options.customFees)) {
            throw validationError(
                "TokenFeeScheduleUpdateValidator",
                "customFees must be an array.",
            );
        }
    }
}
