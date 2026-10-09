import { Long, Hbar } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { ContractExecuteOperationOptions } from "../operations/index.js";

/**
 * Validates `ContractExecuteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractExecuteValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractExecuteOperationOptions): void {
        this.validateContractId(options);
        this.validateGas(options);
        this.validateCallTarget(options);
        this.validatePayableAmount(options);
    }

    private validateContractId(options: ContractExecuteOperationOptions): void {
        if (options.contractId == null || options.contractId === "") {
            throw validationError(
                "ContractExecuteValidator",
                "contractId is required.",
            );
        }
    }

    private validateGas(options: ContractExecuteOperationOptions): void {
        if (options.gas == null) {
            throw validationError(
                "ContractExecuteValidator",
                "gas is required.",
            );
        }

        const isPositive =
            typeof options.gas === "number"
                ? options.gas > 0
                : options.gas.greaterThan(0);

        if (!isPositive) {
            throw validationError(
                "ContractExecuteValidator",
                "gas must be greater than zero.",
            );
        }
    }

    /**
     * Exactly one call-target form must be supplied:
     * - `functionName` (with optional ABI-typed `functionParameters`), OR
     * - `rawFunctionParameters` (pre-encoded ABI bytes).
     *
     * Mixing them is ambiguous (the SDK's `setFunction` and
     * `setFunctionParameters` would overwrite each other).
     */
    private validateCallTarget(options: ContractExecuteOperationOptions): void {
        const hasFunctionName =
            options.functionName != null && options.functionName !== "";
        const hasRawParameters = options.rawFunctionParameters != null;

        if (!hasFunctionName && !hasRawParameters) {
            throw validationError(
                "ContractExecuteValidator",
                "ContractExecute requires either functionName or rawFunctionParameters.",
            );
        }

        if (hasFunctionName && hasRawParameters) {
            throw validationError(
                "ContractExecuteValidator",
                "ContractExecute accepts functionName or rawFunctionParameters, not both.",
            );
        }

        if (hasRawParameters && options.rawFunctionParameters!.length === 0) {
            throw validationError(
                "ContractExecuteValidator",
                "rawFunctionParameters must not be empty.",
            );
        }
    }

    private validatePayableAmount(
        options: ContractExecuteOperationOptions,
    ): void {
        const value = options.payableAmount;
        if (value == null) return;

        // The SDK treats a bigint as 0 HBAR, so reject it.
        if (typeof value === "bigint") {
            throw validationError(
                "ContractExecuteValidator",
                "payableAmount must be a number, string, Long, BigNumber or Hbar, not a bigint.",
            );
        }

        let isNegative: boolean;
        if (typeof value === "number") {
            isNegative = value < 0;
        } else if (typeof value === "string") {
            isNegative = parseFloat(value) < 0;
        } else if (Long.isLong(value)) {
            isNegative = value.isNegative();
        } else if (value instanceof Hbar) {
            isNegative = value.isNegative();
        } else {
            isNegative = value.isNegative();
        }

        if (isNegative) {
            throw validationError(
                "ContractExecuteValidator",
                "payableAmount must not be negative.",
            );
        }
    }
}
