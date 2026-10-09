import { validationError } from "../../../errors/index.js";
import type { TokenFreezeOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenFreezeOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenFreezeValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenFreezeOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
    }

    private validateTokenId(options: TokenFreezeOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenFreezeValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenFreezeValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAccountId(options: TokenFreezeOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenFreezeValidator",
                "accountId is required.",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenFreezeValidator",
                "accountId cannot be empty.",
            );
        }
    }
}
