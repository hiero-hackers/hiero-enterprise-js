import { validationError } from "../../../errors/index.js";
import type { TokenGrantKycOperationOptions } from "../operations/TokenGrantKycOperation.js";

/**
 * Validates `TokenGrantKycOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenGrantKycValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenGrantKycOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
    }

    private validateTokenId(options: TokenGrantKycOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenGrantKycValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenGrantKycValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAccountId(options: TokenGrantKycOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenGrantKycValidator",
                "accountId is required.",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenGrantKycValidator",
                "accountId cannot be empty.",
            );
        }
    }
}
