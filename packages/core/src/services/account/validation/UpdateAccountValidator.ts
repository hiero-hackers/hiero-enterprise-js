import { validationError } from "../../../errors/index.js";
import {
    validateHookCreations,
    validateHookIds,
} from "../../contract/validation/hooks.js";
import type { UpdateAccountOptions } from "../operations/index.js";

/**
 * Validates a built `AccountUpdateTransaction` and its options before execution.
 *
 * Separated from the operation so validation logic is independently testable
 * without requiring network interaction.
 */
export class UpdateAccountValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * Called before `build()` so invalid option combinations are caught before
     * any key parsing or SDK construction is attempted.
     *
     * @param options - The original caller-provided options
     * @throws {HieroError} If validation fails
     */
    validate(options: UpdateAccountOptions): void {
        this.validateAccountId(options);
        this.validateKeyRotation(options);
        this.validateExpirationTime(options);
        this.validateStakingOptions(options);
        this.validateMemo(options);
        this.validateHighVolume(options);
        validateHookCreations(
            "UpdateAccountValidator",
            "hooksToCreate",
            options.hooksToCreate,
        );
        validateHookIds(
            "UpdateAccountValidator",
            "hooksToDelete",
            options.hooksToDelete,
        );
    }

    private validateAccountId(options: UpdateAccountOptions): void {
        if (options.accountId == null) {
            throw validationError(
                "UpdateAccountValidator",
                "accountId is required.",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim() === ""
        ) {
            throw validationError(
                "UpdateAccountValidator",
                "accountId cannot be an empty string.",
            );
        }
    }

    private validateKeyRotation(options: UpdateAccountOptions): void {
        if (options.key != null) {
            const hasSigners =
                (options.additionalSigners?.length ?? 0) > 0 ||
                (options.externalSigners?.length ?? 0) > 0;
            if (!hasSigners) {
                throw validationError(
                    "UpdateAccountValidator",
                    "Key rotation requires both the old and new key to sign. " +
                        "Provide the signing keys via 'additionalSigners' or 'externalSigners'.",
                );
            }
        }
    }

    private validateExpirationTime(options: UpdateAccountOptions): void {
        if (options.expirationTime != null) {
            if (options.expirationTime <= new Date()) {
                throw validationError(
                    "UpdateAccountValidator",
                    "expirationTime must be in the future.",
                );
            }
        }
    }

    private validateStakingOptions(options: UpdateAccountOptions): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw validationError(
                "UpdateAccountValidator",
                "stakedAccountId and stakedNodeId are mutually exclusive — set only one.",
            );
        }

        if (
            options.declineStakingReward === true &&
            options.stakedAccountId == null &&
            options.stakedNodeId == null
        ) {
            // declineStakingReward without a staking target has no effect
        }
    }

    private validateMemo(options: UpdateAccountOptions): void {
        if (options.memo && Buffer.byteLength(options.memo, "utf8") > 100) {
            throw validationError(
                "UpdateAccountValidator",
                `Account memo exceeds 100 bytes (got ${Buffer.byteLength(options.memo, "utf8")}).`,
            );
        }
    }

    /**
     * Validates high-volume mode (HIP-1313).
     *
     * Setting highVolume: true routes the transaction through dedicated
     * high-volume throttle capacity with variable-rate pricing.
     * Users should always pair this with a maxTransactionFee to cap costs.
     */
    private validateHighVolume(options: UpdateAccountOptions): void {
        if (options.highVolume === true && options.maxTransactionFee == null) {
            // highVolume without maxTransactionFee uses variable-rate pricing uncapped
        }
    }
}
