import { validationError } from "../../../errors/index.js";
import type { TokenUnpauseOperationOptions } from "../operations/TokenUnpauseOperation.js";

/**
 * Validates `TokenUnpauseOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUnpauseValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUnpauseOperationOptions): void {
        this.validateTokenId(options);
    }

    private validateTokenId(options: TokenUnpauseOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenUnpauseValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenUnpauseValidator",
                "tokenId cannot be empty.",
            );
        }
    }
}
