import { Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type {
    NftAirdrop,
    TokenAirdropNftOperationOptions,
} from "../operations/TokenAirdropNftOperation.js";

/**
 * Validates `TokenAirdropNftOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenAirdropNftValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenAirdropNftOperationOptions): void {
        this.validateAirdropsList(options);
        options.airdrops.forEach((airdrop, index) => {
            this.validateAirdrop(airdrop, index);
        });
    }

    private validateAirdropsList(
        options: TokenAirdropNftOperationOptions,
    ): void {
        if (options.airdrops == null) {
            throw validationError(
                "TokenAirdropNftValidator",
                "airdrops is required.",
            );
        }

        if (!Array.isArray(options.airdrops)) {
            throw validationError(
                "TokenAirdropNftValidator",
                "airdrops must be an array.",
            );
        }

        if (options.airdrops.length === 0) {
            throw validationError(
                "TokenAirdropNftValidator",
                "airdrops must not be empty.",
            );
        }
    }

    private validateAirdrop(airdrop: NftAirdrop, index: number): void {
        const prefix = `airdrops[${index}]`;
        this.validateTokenId(airdrop, prefix);
        this.validateSerial(airdrop, prefix);
        this.validateAccount(airdrop, "senderAccountId", prefix);
        this.validateAccount(airdrop, "receiverAccountId", prefix);
        this.validateDistinctAccounts(airdrop, prefix);
    }

    private validateTokenId(airdrop: NftAirdrop, prefix: string): void {
        if (airdrop.tokenId == null) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}.tokenId is required.`,
            );
        }

        if (
            typeof airdrop.tokenId === "string" &&
            airdrop.tokenId.trim().length === 0
        ) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}.tokenId cannot be empty.`,
            );
        }
    }

    private validateSerial(airdrop: NftAirdrop, prefix: string): void {
        if (airdrop.serial == null) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}.serial is required.`,
            );
        }

        let isPositiveInteger: boolean;
        if (typeof airdrop.serial === "number") {
            isPositiveInteger =
                Number.isInteger(airdrop.serial) && airdrop.serial > 0;
        } else if (Long.isLong(airdrop.serial)) {
            isPositiveInteger =
                !airdrop.serial.isNegative() && !airdrop.serial.isZero();
        } else {
            isPositiveInteger = false;
        }

        if (!isPositiveInteger) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}.serial must be a positive integer.`,
            );
        }
    }

    private validateAccount(
        airdrop: NftAirdrop,
        field: "senderAccountId" | "receiverAccountId",
        prefix: string,
    ): void {
        const value =
            field === "senderAccountId"
                ? airdrop.senderAccountId
                : airdrop.receiverAccountId;

        if (value == null) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}.${field} is required.`,
            );
        }

        if (typeof value === "string" && value.trim().length === 0) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}.${field} cannot be empty.`,
            );
        }
    }

    private validateDistinctAccounts(
        airdrop: NftAirdrop,
        prefix: string,
    ): void {
        const sender =
            typeof airdrop.senderAccountId === "string"
                ? airdrop.senderAccountId
                : airdrop.senderAccountId.toString();
        const receiver =
            typeof airdrop.receiverAccountId === "string"
                ? airdrop.receiverAccountId
                : airdrop.receiverAccountId.toString();

        if (sender === receiver) {
            throw validationError(
                "TokenAirdropNftValidator",
                `${prefix}: senderAccountId and receiverAccountId must be different.`,
            );
        }
    }
}
