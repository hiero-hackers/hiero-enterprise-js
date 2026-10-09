import { validationError } from "../../../errors/index.js";
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
        this.validateKeyRotation(options);
        this.validateExpirationTime(options);
        this.validateStakingOptions(options);
        this.validateMemo(options);
        this.validateAutoRenewPeriod(options);
        this.validateHighVolume(options);
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

    private validateAutoRenewPeriod(options: UpdateAccountOptions): void {
        if (options.autoRenewPeriod == null) return;

        const MIN_AUTO_RENEW = 2_592_000; // 30 days in seconds
        const MAX_AUTO_RENEW = 7_776_000; // 90 days in seconds

        if (
            options.autoRenewPeriod < MIN_AUTO_RENEW ||
            options.autoRenewPeriod > MAX_AUTO_RENEW
        ) {
            throw validationError(
                "UpdateAccountValidator",
                `autoRenewPeriod must be between 30 days (${MIN_AUTO_RENEW}s) and 90 days (${MAX_AUTO_RENEW}s), got ${options.autoRenewPeriod}s.`,
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
