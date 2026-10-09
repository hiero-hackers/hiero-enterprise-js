import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TokenBurnOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenBurnOperationOptions` before they reach the SDK.
 */
export class TokenBurnValidator {
    validate(options: TokenBurnOperationOptions): void {
        this.validateTokenId(options);
        this.validateSerials(options);
        this.validateAmountOrSerials(options);
        this.validateAmount(options);
    }

    private validateTokenId(options: TokenBurnOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError("TokenBurnValidator", "tokenId is required.");
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenBurnValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAmountOrSerials(options: TokenBurnOperationOptions): void {
        const hasAmount = options.amount != null;
        const hasSerials =
            options.serials != null && options.serials.length > 0;

        if (!hasAmount && !hasSerials) {
            throw validationError(
                "TokenBurnValidator",
                "Token burn requires either amount (fungible) or serials (NFT).",
            );
        }

        if (hasAmount && hasSerials) {
            throw validationError(
                "TokenBurnValidator",
                "Token burn requires either amount (fungible) or serials (NFT).",
            );
        }
    }

    private validateAmount(options: TokenBurnOperationOptions): void {
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
                "TokenBurnValidator",
                "amount cannot be negative.",
            );
        }
    }

    private validateSerials(options: TokenBurnOperationOptions): void {
        if (options.serials == null) return;

        if (!Array.isArray(options.serials)) {
            throw validationError(
                "TokenBurnValidator",
                "serials must be an array.",
            );
        }

        if (options.serials.length === 0) {
            throw validationError(
                "TokenBurnValidator",
                "serials cannot be an empty array.",
            );
        }

        for (const serial of options.serials) {
            if (serial == null) {
                throw validationError(
                    "TokenBurnValidator",
                    "serials entries cannot be null.",
                );
            }

            const isLong = Long.isLong(serial);
            const isNumber = typeof serial === "number";

            if (!isLong && !isNumber) {
                throw validationError(
                    "TokenBurnValidator",
                    "serials entries must be a number or Long.",
                );
            }

            if (isNumber && !Number.isInteger(serial)) {
                throw validationError(
                    "TokenBurnValidator",
                    "serials entries must be positive integers.",
                );
            }

            const isNonPositive = isLong
                ? serial.isNegative() || serial.isZero()
                : (serial as number) <= 0;

            if (isNonPositive) {
                throw validationError(
                    "TokenBurnValidator",
                    "serials entries must be positive integers.",
                );
            }
        }
    }
}
