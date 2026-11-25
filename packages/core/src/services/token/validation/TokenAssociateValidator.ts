import { Status } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TokenAssociateOperationOptions } from "../operations/TokenAssociateOperation.js";

/**
 * Validates `TokenAssociateOperationOptions` before they reach the SDK.
 */
export class TokenAssociateValidator {
    validate(options: TokenAssociateOperationOptions): void {
        this.validateAccountId(options);
        this.validateTokens(options);
    }

    private validateAccountId(options: TokenAssociateOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenAssociateValidator",
                "accountId is required.",
                Status.InvalidAccountId,
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenAssociateValidator",
                "accountId cannot be empty.",
            );
        }
    }

    private validateTokens(options: TokenAssociateOperationOptions): void {
        if (options.tokenId != null && options.tokenIds != null) {
            throw validationError(
                "TokenAssociateValidator",
                "Set either tokenId or tokenIds, not both.",
            );
        }

        if (options.tokenIds != null) {
            this.validateTokenIds(options.tokenIds);

            return;
        }

        if (options.tokenId == null) {
            throw validationError(
                "TokenAssociateValidator",
                "tokenId or tokenIds is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenAssociateValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateTokenIds(tokenIds: unknown): void {
        if (!Array.isArray(tokenIds)) {
            throw validationError(
                "TokenAssociateValidator",
                "tokenIds must be an array.",
            );
        }

        for (const tokenId of tokenIds) {
            if (tokenId == null) {
                throw validationError(
                    "TokenAssociateValidator",
                    "tokenIds entries cannot be null.",
                );
            }

            if (typeof tokenId === "string" && tokenId.trim().length === 0) {
                throw validationError(
                    "TokenAssociateValidator",
                    "tokenIds entries cannot be empty.",
                );
            }
        }
    }
}
