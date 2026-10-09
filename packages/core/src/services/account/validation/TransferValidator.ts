import type { AccountId, TokenId, Hbar } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";

/**
 * Validates inputs to `TransferOperation` methods before building the SDK
 * transaction.
 *
 * Catches common bugs the network would otherwise reject (or silently accept)
 * — empty IDs, non-positive amounts, non-integer token amounts, and self
 * transfers.
 */
export class TransferValidator {
    validateHbarTransfer(params: {
        receiverAccountId: string | AccountId;
        senderAccountId: string | AccountId;
        amount: number | Hbar;
    }): void {
        this.validateAccountId(params.senderAccountId, "senderAccountId");
        this.validateAccountId(params.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            params.senderAccountId,
            params.receiverAccountId,
        );
        this.validateHbarAmount(params.amount);
    }

    validateTokenTransfer(params: {
        tokenId: string | TokenId;
        receiverAccountId: string | AccountId;
        senderAccountId: string | AccountId;
        amount: number;
        expectedDecimals?: number;
    }): void {
        this.validateTokenId(params.tokenId);
        this.validateAccountId(params.senderAccountId, "senderAccountId");
        this.validateAccountId(params.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            params.senderAccountId,
            params.receiverAccountId,
        );
        this.validateTokenAmount(params.amount);
        if (params.expectedDecimals !== undefined) {
            this.validateExpectedDecimals(params.expectedDecimals);
        }
    }

    validateNftTransfer(params: {
        tokenId: string | TokenId;
        serial: number;
        receiverAccountId: string | AccountId;
        senderAccountId: string | AccountId;
    }): void {
        this.validateTokenId(params.tokenId);
        this.validateSerial(params.serial);
        this.validateAccountId(params.senderAccountId, "senderAccountId");
        this.validateAccountId(params.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            params.senderAccountId,
            params.receiverAccountId,
        );
    }

    private validateAccountId(
        value: string | AccountId | null | undefined,
        paramName: string,
    ): void {
        if (value == null) {
            throw validationError(
                "TransferValidator",
                `${paramName} is required.`,
            );
        }
        if (typeof value === "string" && value.trim() === "") {
            throw validationError(
                "TransferValidator",
                `${paramName} must not be empty.`,
            );
        }
    }

    private validateTokenId(value: string | TokenId | null | undefined): void {
        if (value == null) {
            throw validationError("TransferValidator", "tokenId is required.");
        }
        if (typeof value === "string" && value.trim() === "") {
            throw validationError(
                "TransferValidator",
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
                "TransferValidator",
                "senderAccountId and receiverAccountId must be different — transferring to self is a no-op.",
            );
        }
    }

    private validateHbarAmount(amount: number | Hbar | null | undefined): void {
        if (amount == null) {
            throw validationError("TransferValidator", "amount is required.");
        }

        if (typeof amount === "number") {
            if (!Number.isFinite(amount)) {
                throw validationError(
                    "TransferValidator",
                    "amount must be a finite number.",
                );
            }
            if (amount <= 0) {
                throw validationError(
                    "TransferValidator",
                    "amount must be positive.",
                );
            }
            return;
        }

        // Hbar instance — compare tinybars via BigInt for precision.
        let tinybars: bigint;
        try {
            tinybars = BigInt(amount.toTinybars().toString());
        } catch {
            throw validationError(
                "TransferValidator",
                "amount is not a valid Hbar value.",
            );
        }
        if (tinybars <= 0n) {
            throw validationError(
                "TransferValidator",
                "amount must be positive.",
            );
        }
    }

    private validateTokenAmount(amount: number | null | undefined): void {
        if (amount == null) {
            throw validationError("TransferValidator", "amount is required.");
        }
        if (!Number.isFinite(amount) || !Number.isSafeInteger(amount)) {
            throw validationError(
                "TransferValidator",
                "amount must be a safe integer.",
            );
        }
        if (amount <= 0) {
            throw validationError(
                "TransferValidator",
                "amount must be positive.",
            );
        }
    }

    private validateSerial(serial: number | null | undefined): void {
        if (serial == null) {
            throw validationError("TransferValidator", "serial is required.");
        }
        if (!Number.isFinite(serial) || !Number.isSafeInteger(serial)) {
            throw validationError(
                "TransferValidator",
                "serial must be a safe integer.",
            );
        }
        if (serial <= 0) {
            throw validationError(
                "TransferValidator",
                "serial must be positive.",
            );
        }
    }

    private validateExpectedDecimals(decimals: number): void {
        if (!Number.isFinite(decimals) || !Number.isInteger(decimals)) {
            throw validationError(
                "TransferValidator",
                "expectedDecimals must be a finite integer.",
            );
        }
        if (decimals < 0) {
            throw validationError(
                "TransferValidator",
                "expectedDecimals cannot be negative.",
            );
        }
    }
}
