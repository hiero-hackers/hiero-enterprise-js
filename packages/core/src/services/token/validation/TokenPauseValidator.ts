import { validationError } from "../../../errors/index.js";
import type { TokenPauseOperationOptions } from "../operations/TokenPauseOperation.js";

/**
 * Validates `TokenPauseOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenPauseValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenPauseOperationOptions): void {
        this.validateTokenId(options);
    }

    private validateTokenId(options: TokenPauseOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenPauseValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenPauseValidator",
                "tokenId cannot be empty.",
            );
        }
    }
}
