import type BigNumber from "bignumber.js";
import { TokenType, TokenSupplyType, Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TokenCreateOperationOptions } from "../operations/TokenCreateOperation.js";

const MAX_TOKEN_NAME_BYTES = 100;
const MAX_TOKEN_SYMBOL_BYTES = 100;
const MAX_TOKEN_MEMO_BYTES = 100;

/**
 * Check if a numeric value is negative across all supported types.
 */
function isNegative(
    value: number | bigint | Long | BigNumber | undefined,
): boolean {
    if (value == null) return false;
    if (typeof value === "number") return value < 0;
    if (typeof value === "bigint") return value < 0n;
    if (Long.isLong(value)) return value.isNegative();
    return (value as BigNumber).isNegative();
}

/**
 * Check if a numeric value equals zero across all supported types.
 *
 * Assumes a non-null value; callers must null-check first.
 */
function isZero(value: number | bigint | Long | BigNumber): boolean {
    if (typeof value === "number") return value === 0;
    if (typeof value === "bigint") return value === 0n;
    if (Long.isLong(value)) return value.isZero();
    return (value as BigNumber).isZero();
}

/**
 * Check if a numeric value is positive (> 0) across all supported types.
 *
 * Assumes a non-null value; callers must null-check first.
 */
function isPositive(value: number | bigint | Long | BigNumber): boolean {
    if (typeof value === "number") return value > 0;
    if (typeof value === "bigint") return value > 0n;
    if (Long.isLong(value)) return value.greaterThan(0);
    return (value as BigNumber).isGreaterThan(0);
}

/**
 * Validates `TokenCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenCreateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenCreateOperationOptions): void {
        this.validateName(options);
        this.validateSymbol(options);
        this.validateTreasury(options);
        this.validateNumericRanges(options);
        this.validateMemo(options);
        this.validateSupplyConstraints(options);
        this.validateNftConstraints(options);
    }

    private validateName(options: TokenCreateOperationOptions): void {
        if (options.tokenName == null || options.tokenName.length === 0) {
            throw validationError(
                "TokenCreateValidator",
                "tokenName is required.",
            );
        }

        const byteLength = Buffer.byteLength(options.tokenName, "utf8");
        if (byteLength > MAX_TOKEN_NAME_BYTES) {
            throw validationError(
                "TokenCreateValidator",
                `tokenName exceeds ${MAX_TOKEN_NAME_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateSymbol(options: TokenCreateOperationOptions): void {
        if (options.tokenSymbol == null || options.tokenSymbol.length === 0) {
            throw validationError(
                "TokenCreateValidator",
                "tokenSymbol is required.",
            );
        }

        const byteLength = Buffer.byteLength(options.tokenSymbol, "utf8");
        if (byteLength > MAX_TOKEN_SYMBOL_BYTES) {
            throw validationError(
                "TokenCreateValidator",
                `tokenSymbol exceeds ${MAX_TOKEN_SYMBOL_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateTreasury(options: TokenCreateOperationOptions): void {
        if (options.treasuryAccountId == null) {
            throw validationError(
                "TokenCreateValidator",
                "treasuryAccountId is required.",
            );
        }

        if (
            typeof options.treasuryAccountId === "string" &&
            options.treasuryAccountId.trim().length === 0
        ) {
            throw validationError(
                "TokenCreateValidator",
                "treasuryAccountId cannot be empty.",
            );
        }
    }

    private validateNumericRanges(options: TokenCreateOperationOptions): void {
        if (isNegative(options.decimals)) {
            throw validationError(
                "TokenCreateValidator",
                "decimals cannot be negative.",
            );
        }

        if (isNegative(options.initialSupply)) {
            throw validationError(
                "TokenCreateValidator",
                "initialSupply cannot be negative.",
            );
        }

        if (isNegative(options.maxSupply)) {
            throw validationError(
                "TokenCreateValidator",
                "maxSupply cannot be negative.",
            );
        }
    }

    private validateMemo(options: TokenCreateOperationOptions): void {
        if (options.tokenMemo == null) return;

        const byteLength = Buffer.byteLength(options.tokenMemo, "utf8");
        if (byteLength > MAX_TOKEN_MEMO_BYTES) {
            throw validationError(
                "TokenCreateValidator",
                `tokenMemo exceeds ${MAX_TOKEN_MEMO_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateSupplyConstraints(
        options: TokenCreateOperationOptions,
    ): void {
        if (options.supplyType !== TokenSupplyType.Finite) return;

        if (options.maxSupply == null) {
            throw validationError(
                "TokenCreateValidator",
                "supplyType Finite requires maxSupply to be set.",
            );
        }

        if (!isPositive(options.maxSupply)) {
            throw validationError(
                "TokenCreateValidator",
                "maxSupply must be greater than 0 for finite supply.",
            );
        }
    }

    private validateNftConstraints(options: TokenCreateOperationOptions): void {
        if (options.tokenType !== TokenType.NonFungibleUnique) return;

        if (options.supplyKey == null) {
            throw validationError(
                "TokenCreateValidator",
                "Non-fungible tokens require a supplyKey — NFTs are minted after collection creation.",
            );
        }

        if (options.decimals != null && !isZero(options.decimals)) {
            throw validationError(
                "TokenCreateValidator",
                "Non-fungible tokens must have decimals: 0.",
            );
        }

        if (options.initialSupply != null && !isZero(options.initialSupply)) {
            throw validationError(
                "TokenCreateValidator",
                "Non-fungible tokens must have initialSupply: 0.",
            );
        }
    }
}
