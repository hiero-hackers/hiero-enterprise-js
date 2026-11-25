import { ContractId, Long, Hbar, Status } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import { validateCallTarget } from "./validateCallTarget.js";
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
        if (options.contractId == null) {
            throw validationError(
                "ContractExecuteValidator",
                "contractId is required.",
                Status.InvalidContractId,
            );
        }

        if (options.contractId === "") {
            throw validationError(
                "ContractExecuteValidator",
                "contractId is required.",
            );
        }

        if (typeof options.contractId === "string") {
            try {
                ContractId.fromString(options.contractId);
            } catch {
                throw validationError(
                    "ContractExecuteValidator",
                    `contractId "${options.contractId}" is not a valid contract ID.`,
                );
            }
        }
    }

    private validateGas(options: ContractExecuteOperationOptions): void {
        if (options.gas == null) {
            throw validationError(
                "ContractExecuteValidator",
                "gas is required.",
                Status.InsufficientGas,
            );
        }

        const isPositive =
            typeof options.gas === "number"
                ? options.gas > 0
                : options.gas.greaterThan(0);
        const isZero =
            typeof options.gas === "number"
                ? options.gas === 0
                : options.gas.isZero();

        if (!isPositive) {
            throw validationError(
                "ContractExecuteValidator",
                "gas must be greater than zero.",
                isZero ? Status.InsufficientGas : undefined,
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
        validateCallTarget("ContractExecuteValidator", options);

        if (options.rawFunctionParameters?.length === 0) {
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
                Status.ContractNegativeValue,
            );
        }
    }
}
