import { validationError } from "../../../errors/index.js";
import type { TokenRejectOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenRejectOperationOptions` before they reach the SDK.
 */
export class TokenRejectValidator {
    validate(options: TokenRejectOperationOptions): void {
        this.validateOwnerId(options);
        this.validateFungibleTokenIds(options);
        this.validateNftIds(options);
        this.validateAtLeastOneTarget(options);
    }

    private validateOwnerId(options: TokenRejectOperationOptions): void {
        if (options.ownerId == null) {
            throw validationError(
                "TokenRejectValidator",
                "ownerId is required.",
            );
        }

        if (
            typeof options.ownerId === "string" &&
            options.ownerId.trim().length === 0
        ) {
            throw validationError(
                "TokenRejectValidator",
                "ownerId cannot be empty.",
            );
        }
    }

    private validateFungibleTokenIds(
        options: TokenRejectOperationOptions,
    ): void {
        if (options.fungibleTokenIds == null) return;

        if (!Array.isArray(options.fungibleTokenIds)) {
            throw validationError(
                "TokenRejectValidator",
                "fungibleTokenIds must be an array.",
            );
        }

        for (const tokenId of options.fungibleTokenIds) {
            if (tokenId == null) {
                throw validationError(
                    "TokenRejectValidator",
                    "fungibleTokenIds entries cannot be null.",
                );
            }

            if (typeof tokenId === "string" && tokenId.trim().length === 0) {
                throw validationError(
                    "TokenRejectValidator",
                    "fungibleTokenIds entries cannot be empty.",
                );
            }
        }
    }

    private validateNftIds(options: TokenRejectOperationOptions): void {
        if (options.nftIds == null) return;

        if (!Array.isArray(options.nftIds)) {
            throw validationError(
                "TokenRejectValidator",
                "nftIds must be an array.",
            );
        }

        for (const nftId of options.nftIds) {
            if (nftId == null) {
                throw validationError(
                    "TokenRejectValidator",
                    "nftIds entries cannot be null.",
                );
            }
        }
    }

    private validateAtLeastOneTarget(
        options: TokenRejectOperationOptions,
    ): void {
        const hasTokens =
            options.fungibleTokenIds != null &&
            options.fungibleTokenIds.length > 0;
        const hasNfts = options.nftIds != null && options.nftIds.length > 0;

        if (!hasTokens && !hasNfts) {
            throw validationError(
                "TokenRejectValidator",
                "Token reject requires at least one fungibleTokenId or nftId.",
            );
        }
    }
}
