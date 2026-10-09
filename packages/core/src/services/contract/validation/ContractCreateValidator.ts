import { Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { ContractCreateOperationOptions } from "../operations/ContractCreateOperation.js";

const MAX_CONTRACT_MEMO_BYTES = 100;

/**
 * Validates `ContractCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractCreateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractCreateOperationOptions): void {
        this.validateBytecodeSource(options);
        this.validateGas(options);
        this.validateInitialBalance(options);
        this.validateMemo(options);
        this.validateStakingMutex(options);
    }

    private validateBytecodeSource(
        options: ContractCreateOperationOptions,
    ): void {
        const hasFileId = options.bytecodeFileId != null;
        const hasBytecode = options.bytecode != null;

        if (!hasFileId && !hasBytecode) {
            throw validationError(
                "ContractCreateValidator",
                "ContractCreate requires either bytecodeFileId or bytecode.",
            );
        }

        if (hasFileId && hasBytecode) {
            throw validationError(
                "ContractCreateValidator",
                "ContractCreate accepts bytecodeFileId or bytecode, not both.",
            );
        }

        if (hasBytecode && options.bytecode!.length === 0) {
            throw validationError(
                "ContractCreateValidator",
                "bytecode must not be empty.",
            );
        }
    }

    private validateGas(options: ContractCreateOperationOptions): void {
        if (options.gas == null) {
            throw validationError(
                "ContractCreateValidator",
                "gas is required.",
            );
        }

        const isPositive =
            typeof options.gas === "number"
                ? options.gas > 0
                : options.gas.greaterThan(0);

        if (!isPositive) {
            throw validationError(
                "ContractCreateValidator",
                "gas must be greater than zero.",
            );
        }
    }

    private validateInitialBalance(
        options: ContractCreateOperationOptions,
    ): void {
        const value = options.initialBalance;
        if (value == null) return;

        if (typeof value === "number" && value < 0) {
            throw validationError(
                "ContractCreateValidator",
                "initialBalance must not be negative.",
            );
        }

        // The SDK treats a bigint as 0 HBAR, so reject it.
        if (typeof value === "bigint") {
            throw validationError(
                "ContractCreateValidator",
                "initialBalance must be a number, string, Long, BigNumber or Hbar, not a bigint.",
            );
        }

        if (Long.isLong(value) && (value as Long).isNegative()) {
            throw validationError(
                "ContractCreateValidator",
                "initialBalance must not be negative.",
            );
        }
    }

    private validateMemo(options: ContractCreateOperationOptions): void {
        if (options.contractMemo == null) return;

        const byteLength = Buffer.byteLength(options.contractMemo, "utf8");
        if (byteLength > MAX_CONTRACT_MEMO_BYTES) {
            throw validationError(
                "ContractCreateValidator",
                `contractMemo exceeds ${MAX_CONTRACT_MEMO_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateStakingMutex(
        options: ContractCreateOperationOptions,
    ): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw validationError(
                "ContractCreateValidator",
                "Specify either stakedAccountId or stakedNodeId, not both.",
            );
        }
    }
}
