import { validationError } from "../../../errors/index.js";
import type { TokenClaimAirdropOperationOptions } from "../operations/TokenClaimAirdropOperation.js";

/**
 * Validates `TokenClaimAirdropOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenClaimAirdropValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenClaimAirdropOperationOptions): void {
        this.validatePendingAirdropIdsList(options);
        options.pendingAirdropIds.forEach((id, index) => {
            this.validatePendingAirdropId(id, index);
        });
    }

    private validatePendingAirdropIdsList(
        options: TokenClaimAirdropOperationOptions,
    ): void {
        if (options.pendingAirdropIds == null) {
            throw validationError(
                "TokenClaimAirdropValidator",
                "pendingAirdropIds is required.",
            );
        }

        if (!Array.isArray(options.pendingAirdropIds)) {
            throw validationError(
                "TokenClaimAirdropValidator",
                "pendingAirdropIds must be an array.",
            );
        }

        if (options.pendingAirdropIds.length === 0) {
            throw validationError(
                "TokenClaimAirdropValidator",
                "pendingAirdropIds must not be empty.",
            );
        }
    }

    private validatePendingAirdropId(id: unknown, index: number): void {
        const prefix = `pendingAirdropIds[${index}]`;

        if (id == null) {
            throw validationError(
                "TokenClaimAirdropValidator",
                `${prefix} is required.`,
            );
        }
    }
}
