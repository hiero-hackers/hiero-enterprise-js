import { validationError } from "../../../errors/index.js";
import type { TokenUnfreezeOperationOptions } from "../operations/TokenUnfreezeOperation.js";

/**
 * Validates `TokenUnfreezeOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUnfreezeValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUnfreezeOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
    }

    private validateTokenId(options: TokenUnfreezeOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenUnfreezeValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenUnfreezeValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAccountId(options: TokenUnfreezeOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenUnfreezeValidator",
                "accountId is required.",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenUnfreezeValidator",
                "accountId cannot be empty.",
            );
        }
    }
}
