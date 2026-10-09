import type BigNumber from "bignumber.js";
import { Long, Hbar } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { ContractCreateFlowOperationOptions } from "../operations/index.js";

const MAX_CONTRACT_MEMO_BYTES = 100;

/**
 * Validates `ContractCreateFlowOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractCreateFlowValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the flow.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractCreateFlowOperationOptions): void {
        this.validateBytecode(options);
        this.validateGas(options);
        this.validateInitialBalance(options);
        this.validateMemo(options);
        this.validateStakingMutex(options);
        this.validateMaxChunks(options);
    }

    private validateBytecode(
        options: ContractCreateFlowOperationOptions,
    ): void {
        if (options.bytecode == null) {
            throw validationError(
                "ContractCreateFlowValidator",
                "bytecode is required.",
            );
        }

        const len =
            typeof options.bytecode === "string"
                ? options.bytecode.length
                : options.bytecode.byteLength;

        if (len === 0) {
            throw validationError(
                "ContractCreateFlowValidator",
                "bytecode must not be empty.",
            );
        }
    }

    private validateGas(options: ContractCreateFlowOperationOptions): void {
        if (options.gas == null) {
            throw validationError(
                "ContractCreateFlowValidator",
                "gas is required.",
            );
        }

        const isPositive =
            typeof options.gas === "number"
                ? options.gas > 0
                : options.gas.greaterThan(0);

        if (!isPositive) {
            throw validationError(
                "ContractCreateFlowValidator",
                "gas must be greater than zero.",
            );
        }
    }

    private validateInitialBalance(
        options: ContractCreateFlowOperationOptions,
    ): void {
        const value = options.initialBalance;
        if (value == null) return;

        // The SDK treats a bigint as 0 HBAR, so reject it.
        if (typeof value === "bigint") {
            throw validationError(
                "ContractCreateFlowValidator",
                "initialBalance must be a number, string, Long, BigNumber or Hbar, not a bigint.",
            );
        }

        let isNegative;
        if (typeof value === "number") {
            isNegative = value < 0;
        } else if (typeof value === "string") {
            isNegative = parseFloat(value) < 0;
        } else if (Long.isLong(value)) {
            isNegative = (value as Long).isNegative();
        } else if (value instanceof Hbar) {
            isNegative = value.isNegative();
        } else {
            isNegative = (value as BigNumber).isNegative();
        }

        if (isNegative) {
            throw validationError(
                "ContractCreateFlowValidator",
                "initialBalance must not be negative.",
            );
        }
    }

    private validateMemo(options: ContractCreateFlowOperationOptions): void {
        if (options.contractMemo == null) return;

        const byteLength = Buffer.byteLength(options.contractMemo, "utf8");
        if (byteLength > MAX_CONTRACT_MEMO_BYTES) {
            throw validationError(
                "ContractCreateFlowValidator",
                `contractMemo exceeds ${MAX_CONTRACT_MEMO_BYTES} bytes (got ${byteLength}).`,
            );
        }
    }

    private validateStakingMutex(
        options: ContractCreateFlowOperationOptions,
    ): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw validationError(
                "ContractCreateFlowValidator",
                "Specify either stakedAccountId or stakedNodeId, not both.",
            );
        }
    }

    private validateMaxChunks(
        options: ContractCreateFlowOperationOptions,
    ): void {
        const value = options.maxChunks;
        if (value == null) return;

        if (!Number.isInteger(value) || value <= 0) {
            throw validationError(
                "ContractCreateFlowValidator",
                "maxChunks must be a positive integer.",
            );
        }
    }
}
