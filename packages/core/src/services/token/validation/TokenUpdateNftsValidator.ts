import { validationError } from "../../../errors/index.js";
import type { TokenUpdateNftsOperationOptions } from "../operations/TokenUpdateNftsOperation.js";

/**
 * Validates `TokenUpdateNftsOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUpdateNftsValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUpdateNftsOperationOptions): void {
        this.validateTokenId(options);
        this.validateSerialNumbers(options);
        this.validateMetadata(options);
    }

    private validateTokenId(options: TokenUpdateNftsOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateSerialNumbers(
        options: TokenUpdateNftsOperationOptions,
    ): void {
        if (options.serialNumbers == null) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "serialNumbers is required.",
            );
        }

        if (!Array.isArray(options.serialNumbers)) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "serialNumbers must be an array.",
            );
        }

        if (options.serialNumbers.length === 0) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "serialNumbers must not be empty.",
            );
        }

        options.serialNumbers.forEach((serial, index) => {
            if (serial == null) {
                throw validationError(
                    "TokenUpdateNftsValidator",
                    `serialNumbers[${index}] is required.`,
                );
            }
        });
    }

    private validateMetadata(options: TokenUpdateNftsOperationOptions): void {
        if (options.metadata == null) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "metadata is required.",
            );
        }

        if (!(options.metadata instanceof Uint8Array)) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "metadata must be a Uint8Array.",
            );
        }

        if (options.metadata.length === 0) {
            throw validationError(
                "TokenUpdateNftsValidator",
                "metadata cannot be empty.",
            );
        }
    }
}
