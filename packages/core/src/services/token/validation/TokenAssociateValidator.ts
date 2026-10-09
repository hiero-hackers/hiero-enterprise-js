import { validationError } from "../../../errors/index.js";
import type { TokenAssociateOperationOptions } from "../operations/TokenAssociateOperation.js";

/**
 * Validates `TokenAssociateOperationOptions` before they reach the SDK.
 */
export class TokenAssociateValidator {
    validate(options: TokenAssociateOperationOptions): void {
        this.validateAccountId(options);
        this.validateTokenId(options);
    }

    private validateAccountId(options: TokenAssociateOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenAssociateValidator",
                "accountId is required.",
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

    private validateTokenId(options: TokenAssociateOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenAssociateValidator",
                "tokenId is required.",
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
}
