import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TokenWipeOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenWipeOperationOptions` before they reach the SDK.
 */
export class TokenWipeValidator {
    validate(options: TokenWipeOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
        this.validateSerials(options);
        this.validateAmountOrSerials(options);
        this.validateAmount(options);
    }

    private validateTokenId(options: TokenWipeOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError("TokenWipeValidator", "tokenId is required.");
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenWipeValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateAccountId(options: TokenWipeOperationOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "TokenWipeValidator",
                "accountId is required.",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw validationError(
                "TokenWipeValidator",
                "accountId cannot be empty.",
            );
        }
    }

    private validateAmountOrSerials(options: TokenWipeOperationOptions): void {
        const hasAmount = options.amount != null;
        const hasSerials =
            options.serials != null && options.serials.length > 0;

        if (!hasAmount && !hasSerials) {
            throw validationError(
                "TokenWipeValidator",
                "Token wipe requires either amount (fungible) or serials (NFT).",
            );
        }

        if (hasAmount && hasSerials) {
            throw validationError(
                "TokenWipeValidator",
                "Token wipe requires either amount (fungible) or serials (NFT).",
            );
        }
    }

    private validateAmount(options: TokenWipeOperationOptions): void {
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
                "TokenWipeValidator",
                "amount cannot be negative.",
            );
        }
    }

    private validateSerials(options: TokenWipeOperationOptions): void {
        if (options.serials == null) return;

        if (!Array.isArray(options.serials)) {
            throw validationError(
                "TokenWipeValidator",
                "serials must be an array.",
            );
        }

        if (options.serials.length === 0) {
            throw validationError(
                "TokenWipeValidator",
                "serials cannot be an empty array.",
            );
        }

        for (const serial of options.serials) {
            if (serial == null) {
                throw validationError(
                    "TokenWipeValidator",
                    "serials entries cannot be null.",
                );
            }

            const isLong = Long.isLong(serial);
            const isNumber = typeof serial === "number";

            if (!isLong && !isNumber) {
                throw validationError(
                    "TokenWipeValidator",
                    "serials entries must be a number or Long.",
                );
            }

            if (isNumber && !Number.isInteger(serial)) {
                throw validationError(
                    "TokenWipeValidator",
                    "serials entries must be positive integers.",
                );
            }

            const isNonPositive = isLong
                ? serial.isNegative() || serial.isZero()
                : (serial as number) <= 0;

            if (isNonPositive) {
                throw validationError(
                    "TokenWipeValidator",
                    "serials entries must be positive integers.",
                );
            }
        }
    }
}
