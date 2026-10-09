import { validationError } from "../../../errors/index.js";
import type { TokenCancelAirdropOperationOptions } from "../operations/TokenCancelAirdropOperation.js";

/**
 * Validates `TokenCancelAirdropOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenCancelAirdropValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenCancelAirdropOperationOptions): void {
        this.validatePendingAirdropIdsList(options);
        options.pendingAirdropIds.forEach((id, index) => {
            this.validatePendingAirdropId(id, index);
        });
    }

    private validatePendingAirdropIdsList(
        options: TokenCancelAirdropOperationOptions,
    ): void {
        if (options.pendingAirdropIds == null) {
            throw validationError(
                "TokenCancelAirdropValidator",
                "pendingAirdropIds is required.",
            );
        }

        if (!Array.isArray(options.pendingAirdropIds)) {
            throw validationError(
                "TokenCancelAirdropValidator",
                "pendingAirdropIds must be an array.",
            );
        }

        if (options.pendingAirdropIds.length === 0) {
            throw validationError(
                "TokenCancelAirdropValidator",
                "pendingAirdropIds must not be empty.",
            );
        }
    }

    private validatePendingAirdropId(id: unknown, index: number): void {
        const prefix = `pendingAirdropIds[${index}]`;

        if (id == null) {
            throw validationError(
                "TokenCancelAirdropValidator",
                `${prefix} is required.`,
            );
        }
    }
}
