import { Long } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { MirrorNodeContractQueryOptions } from "../queries/index.js";
import { validateCallTarget } from "./validateCallTarget.js";

/** A 20-byte EVM address, with or without `0x`. */
const EVM_ADDRESS = /^(0x)?[0-9a-fA-F]{40}$/;

/**
 * Validates `MirrorNodeContractQueryOptions` before they reach the SDK.
 *
 * Separated from the query so validation logic is independently
 * testable without requiring network interaction.
 */
export class MirrorContractCallValidator {
    /**
     * Validate the caller-provided options prior to building the query.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: MirrorNodeContractQueryOptions): void {
        this.validateContractId(options);
        validateCallTarget("MirrorContractCallValidator", options);
        this.validateSender(options);
        this.validateAmount("value", options.value, 0);
        this.validateAmount("gasLimit", options.gasLimit, 1);
        this.validateAmount("gasPrice", options.gasPrice, 0);
    }

    private validateContractId(options: MirrorNodeContractQueryOptions): void {
        if (options.contractId == null || options.contractId === "") {
            throw validationError(
                "MirrorContractCallValidator",
                "contractId is required.",
            );
        }
    }

    private validateSender(options: MirrorNodeContractQueryOptions): void {
        if (options.sender != null && options.senderEvmAddress != null) {
            throw validationError(
                "MirrorContractCallValidator",
                "A contract call accepts sender or senderEvmAddress, not both.",
            );
        }

        if (
            options.senderEvmAddress != null &&
            !EVM_ADDRESS.test(options.senderEvmAddress)
        ) {
            throw validationError(
                "MirrorContractCallValidator",
                "senderEvmAddress must be a 20-byte hex EVM address.",
            );
        }
    }

    /** An optional integer of at least `min`. */
    private validateAmount(
        name: string,
        value: number | Long | undefined,
        min: number,
    ): void {
        if (value == null) return;

        const valid = Long.isLong(value)
            ? value.greaterThanOrEqual(min)
            : Number.isSafeInteger(value) && value >= min;

        if (!valid) {
            throw validationError(
                "MirrorContractCallValidator",
                `${name} must be an integer of at least ${min}.`,
            );
        }
    }
}
