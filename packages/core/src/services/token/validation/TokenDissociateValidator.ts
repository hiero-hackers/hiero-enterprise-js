import { Status } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TokenDissociateOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenDissociateOperationOptions` before they reach the SDK.
 */
export class TokenDissociateValidator {
    validate(options: TokenDissociateOperationOptions): void {
        this.validateAccountId(options);
        this.validateTokenIds(options);
    }

    private validateAccountId(options: TokenDissociateOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenDissociateValidator",
                "accountId is required.",
                Status.InvalidAccountId,
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenDissociateValidator",
                "accountId cannot be empty.",
            );
        }
    }

    private validateTokenIds(options: TokenDissociateOperationOptions): void {
        if (options.tokenIds == null) {
            throw validationError(
                "TokenDissociateValidator",
                "tokenIds is required.",
            );
        }

        if (!Array.isArray(options.tokenIds)) {
            throw validationError(
                "TokenDissociateValidator",
                "tokenIds must be an array.",
            );
        }

        for (const tokenId of options.tokenIds) {
            if (tokenId == null) {
                throw validationError(
                    "TokenDissociateValidator",
                    "tokenIds entries cannot be null.",
                );
            }

            if (typeof tokenId === "string" && tokenId.trim().length === 0) {
                throw validationError(
                    "TokenDissociateValidator",
                    "tokenIds entries cannot be empty.",
                );
            }
        }
    }
}
