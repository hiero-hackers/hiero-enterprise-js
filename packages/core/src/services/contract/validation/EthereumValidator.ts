import { EthereumTransactionData, FileId, Hbar } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { EthereumOperationOptions } from "../operations/index.js";

/**
 * Validates `EthereumOperationOptions` before they reach the SDK.
 */
export class EthereumValidator {
    /**
     * @throws {HieroError} If `ethereumData` is missing, empty or unsigned,
     *   `callDataFileId` is not a file ID, or `maxGasAllowance` is negative
     */
    validate(options: EthereumOperationOptions): void {
        this.validateEthereumData(options);
        this.validateCallDataFileId(options);
        this.validateMaxGasAllowance(options);
    }

    private validateEthereumData(options: EthereumOperationOptions): void {
        const data = options.ethereumData;
        if (data == null) {
            throw validationError(
                "EthereumValidator",
                "ethereumData is required.",
            );
        }
        if (data instanceof EthereumTransactionData) {
            if (!data.isSigned()) {
                throw validationError(
                    "EthereumValidator",
                    "ethereumData is not signed. Call `.sign(key)` first, or pass the signed bytes.",
                );
            }
            return;
        }
        if (!(data instanceof Uint8Array) || data.length === 0) {
            throw validationError(
                "EthereumValidator",
                "ethereumData must be non-empty bytes or a signed EthereumTransactionData.",
            );
        }
    }

    private validateCallDataFileId(options: EthereumOperationOptions): void {
        if (typeof options.callDataFileId !== "string") return;
        try {
            FileId.fromString(options.callDataFileId);
        } catch {
            throw validationError(
                "EthereumValidator",
                `callDataFileId "${options.callDataFileId}" is not a valid file ID. Expected "<shard>.<realm>.<num>".`,
            );
        }
    }

    private validateMaxGasAllowance(options: EthereumOperationOptions): void {
        const allowance = options.maxGasAllowance;
        if (allowance == null) return;
        const negative =
            allowance instanceof Hbar
                ? allowance.isNegative()
                : !Number.isFinite(allowance) || allowance < 0;
        if (negative) {
            throw validationError(
                "EthereumValidator",
                `maxGasAllowance must be a non-negative amount of HBAR, got ${allowance.toString()}.`,
            );
        }
    }
}
