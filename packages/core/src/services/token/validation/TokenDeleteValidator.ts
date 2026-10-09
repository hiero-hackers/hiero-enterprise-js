import { validationError } from "../../../errors/index.js";
import type { TokenDeleteOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenDeleteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenDeleteValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenDeleteOperationOptions): void {
        this.validateTokenId(options);
    }

    private validateTokenId(options: TokenDeleteOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenDeleteValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenDeleteValidator",
                "tokenId cannot be empty.",
            );
        }
    }
}
