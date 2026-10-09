import { validationError } from "../../../errors/index.js";
import type { TokenRevokeKycOperationOptions } from "../operations/TokenRevokeKycOperation.js";

/**
 * Validates `TokenRevokeKycOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenRevokeKycValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenRevokeKycOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
    }

    private validateTokenId(options: TokenRevokeKycOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenRevokeKycValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenRevokeKycValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAccountId(options: TokenRevokeKycOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenRevokeKycValidator",
                "accountId is required.",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenRevokeKycValidator",
                "accountId cannot be empty.",
            );
        }
    }
}
