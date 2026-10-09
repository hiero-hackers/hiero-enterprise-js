import { validationError } from "../../../errors/index.js";
import type { TokenUpdateOperationOptions } from "../operations/TokenUpdateOperation.js";

const MAX_TOKEN_NAME_BYTES = 100;
const MAX_TOKEN_SYMBOL_BYTES = 100;
const MAX_TOKEN_MEMO_BYTES = 100;

/**
 * Validates `TokenUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUpdateOperationOptions): void {
        this.validateTokenId(options);
        this.validateName(options);
        this.validateSymbol(options);
        this.validateMemo(options);
        this.validateTreasury(options);
        this.validateAutoRenewAccount(options);
    }

    private validateTokenId(options: TokenUpdateOperationOptions): void {
        if (options.tokenId == null) {
            throw validationError(
                "TokenUpdateValidator",
                "tokenId is required.",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenUpdateValidator",
                "tokenId cannot be empty.",
            );
        }
    }

    private validateName(options: TokenUpdateOperationOptions): void {
        if (options.tokenName == null) return;

        if (options.tokenName.length === 0) {
            throw validationError(
                "TokenUpdateValidator",
                "tokenName cannot be empty.",
            );
        }

        const byteLength = Buffer.byteLength(options.tokenName, "utf8");
        if (byteLength > MAX_TOKEN_NAME_BYTES) {
            throw validationError(
                "TokenUpdateValidator",
                `tokenName exceeds ${MAX_TOKEN_NAME_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateSymbol(options: TokenUpdateOperationOptions): void {
        if (options.tokenSymbol == null) return;

        if (options.tokenSymbol.length === 0) {
            throw validationError(
                "TokenUpdateValidator",
                "tokenSymbol cannot be empty.",
            );
        }

        const byteLength = Buffer.byteLength(options.tokenSymbol, "utf8");
        if (byteLength > MAX_TOKEN_SYMBOL_BYTES) {
            throw validationError(
                "TokenUpdateValidator",
                `tokenSymbol exceeds ${MAX_TOKEN_SYMBOL_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateMemo(options: TokenUpdateOperationOptions): void {
        if (options.tokenMemo == null) return;

        const byteLength = Buffer.byteLength(options.tokenMemo, "utf8");
        if (byteLength > MAX_TOKEN_MEMO_BYTES) {
            throw validationError(
                "TokenUpdateValidator",
                `tokenMemo exceeds ${MAX_TOKEN_MEMO_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateTreasury(options: TokenUpdateOperationOptions): void {
        if (options.treasuryAccountId == null) return;

        if (
            typeof options.treasuryAccountId === "string" &&
            options.treasuryAccountId.trim().length === 0
        ) {
            throw validationError(
                "TokenUpdateValidator",
                "treasuryAccountId cannot be empty.",
            );
        }
    }

    private validateAutoRenewAccount(
        options: TokenUpdateOperationOptions,
    ): void {
        if (options.autoRenewAccountId == null) return;

        if (
            typeof options.autoRenewAccountId === "string" &&
            options.autoRenewAccountId.trim().length === 0
        ) {
            throw validationError(
                "TokenUpdateValidator",
                "autoRenewAccountId cannot be empty.",
            );
        }
    }
}
