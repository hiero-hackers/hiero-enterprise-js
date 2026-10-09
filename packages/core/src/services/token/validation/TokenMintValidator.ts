import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TokenMintOperationOptions } from "../operations/TokenMintOperation.js";

/**
 * Validates `TokenMintOperationOptions` before they reach the SDK.
 */
export class TokenMintValidator {
    validate(options: TokenMintOperationOptions): void {
        this.validateTokenId(options);
        this.validateAmountOrMetadata(options);
        this.validateAmount(options);
        this.validateMetadata(options);
    }

    private validateTokenId(options: TokenMintOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError("TokenMintValidator", "tokenId is required.");
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenMintValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAmountOrMetadata(options: TokenMintOperationOptions): void {
        const hasAmount = options.amount != null;
        const hasMetadata =
            options.metadata != null && options.metadata.length > 0;

        if (!hasAmount && !hasMetadata) {
            throw validationError(
                "TokenMintValidator",
                "Token mint requires either amount (fungible) or metadata (NFT).",
            );
        }

        if (hasAmount && hasMetadata) {
            throw validationError(
                "TokenMintValidator",
                "Token mint requires either amount (fungible) or metadata (NFT).",
            );
        }
    }

    private validateAmount(options: TokenMintOperationOptions): void {
        if (options.amount == null) return;

        let isNegative;
        if (typeof options.amount === "number") {
            isNegative = options.amount < 0;
        } else if (typeof options.amount === "bigint") {
            isNegative = options.amount < 0n;
        } else if (Long.isLong(options.amount)) {
            isNegative = options.amount.isNegative();
        } else {
            // BigNumber
            isNegative = (options.amount as BigNumber).isNegative();
        }

        if (isNegative) {
            throw validationError(
                "TokenMintValidator",
                "amount cannot be negative.",
            );
        }
    }

    private validateMetadata(options: TokenMintOperationOptions): void {
        if (options.metadata != null && options.metadata.length === 0) {
            throw validationError(
                "TokenMintValidator",
                "metadata cannot be an empty array.",
            );
        }
    }
}
