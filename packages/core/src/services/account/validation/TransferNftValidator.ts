import { Status } from "@hiero-ledger/sdk";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { TransferNftOperationOptions } from "../operations/TransferNftOperation.js";

/**
 * Validates inputs to `TransferNftOperation` before building the SDK
 * transaction.
 *
 * Catches common bugs the network would otherwise reject — empty IDs,
 * invalid serials and self transfers.
 */
export class TransferNftValidator {
    /**
     * Validate transfer options before any SDK construction.
     *
     * @param options - The caller-provided transfer options
     * @throws {HieroError} If validation fails
     */
    validate(options: TransferNftOperationOptions): void {
        this.validateTokenId(options.tokenId);
        this.validateSerial(options.serial);
        this.validateAccountId(options.senderAccountId, "senderAccountId");
        this.validateAccountId(options.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            options.senderAccountId,
            options.receiverAccountId,
        );
    }

    private validateAccountId(
        value: string | AccountId | null | undefined,
        paramName: string,
    ): void {
        if (value == null) {
            throw validationError(
                "TransferNftValidator",
                `${paramName} is required.`,
            );
        }

        if (typeof value === "string" && value.trim() === "") {
            throw validationError(
                "TransferNftValidator",
                `${paramName} must not be empty.`,
            );
        }
    }

    private validateTokenId(value: string | TokenId | null | undefined): void {
        if (value == null) {
            throw validationError(
                "TransferNftValidator",
                "tokenId is required.",
            );
        }

        if (typeof value === "string" && value.trim() === "") {
            throw validationError(
                "TransferNftValidator",
                "tokenId must not be empty.",
            );
        }
    }

    private validateDistinctAccounts(
        sender: string | AccountId,
        receiver: string | AccountId,
    ): void {
        if (sender.toString() === receiver.toString()) {
            throw validationError(
                "TransferNftValidator",
                "senderAccountId and receiverAccountId must be different — transferring to self is a no-op.",
                Status.AccountRepeatedInAccountAmounts,
            );
        }
    }

    private validateSerial(serial: number | null | undefined): void {
        if (serial == null) {
            throw validationError(
                "TransferNftValidator",
                "serial is required.",
            );
        }

        if (!Number.isFinite(serial) || !Number.isSafeInteger(serial)) {
            throw validationError(
                "TransferNftValidator",
                "serial must be a safe integer.",
            );
        }

        if (serial <= 0) {
            throw validationError(
                "TransferNftValidator",
                "serial must be positive.",
            );
        }
    }
}
