import { AccountType } from "../../../types/index.js";
import { validationError } from "../../../errors/index.js";
import type { CreateAccountOptions } from "../operations/index.js";

/**
 * Validates a built `AccountCreateTransaction` and its options before execution.
 *
 * Separated from the operation so validation logic is independently testable
 * without requiring network interaction.
 */
export class CreateAccountValidator {
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
    validate(options: CreateAccountOptions): void {
        this.validateKeyType(options);
        this.validateKeyOptions(options);
        this.validateAlias(options);
        this.validateInitialBalance(options);
        this.validateStakingOptions(options);
        this.validateMemo(options);
        this.validateAutoRenewPeriod(options);
        this.validateHighVolume(options);
    }

    private validateKeyOptions(options: CreateAccountOptions): void {
        if (options.key != null && options.publicKey != null) {
            throw validationError(
                "CreateAccountValidator",
                "Provide either 'key' (Key) or 'publicKey' (string) — not both.",
            );
        }

        if (options.key == null && options.publicKey == null) {
            throw validationError(
                "CreateAccountValidator",
                "Either 'key' (SDK Key) or 'publicKey' (string) must be provided.",
            );
        }

        if (options.publicKey != null && options.keyType == null) {
            // keyType defaults to ED25519 when not specified
        }

        if (options.key != null && options.alias != null) {
            throw validationError(
                "CreateAccountValidator",
                "alias is not supported when using 'key' directly — alias derivation requires a single ECDSA public key string.",
            );
        }
    }

    private validateAlias(options: CreateAccountOptions): void {
        if (options.alias === true) {
            const keyType = options.keyType ?? AccountType.ED25519;
            if (keyType !== AccountType.ECDSA) {
                throw validationError(
                    "CreateAccountValidator",
                    "alias: true requires keyType AccountType.ECDSA — ed25519 keys cannot derive an EVM alias.",
                );
            }
        }
    }

    private validateInitialBalance(options: CreateAccountOptions): void {
        if (
            typeof options.initialBalance === "number" &&
            options.initialBalance < 0
        ) {
            throw validationError(
                "CreateAccountValidator",
                "Initial balance cannot be negative.",
            );
        }
    }

    private validateStakingOptions(options: CreateAccountOptions): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw validationError(
                "CreateAccountValidator",
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

    private validateMemo(options: CreateAccountOptions): void {
        if (options.memo && Buffer.byteLength(options.memo, "utf8") > 100) {
            throw validationError(
                "CreateAccountValidator",
                `Account memo exceeds 100 bytes (got ${Buffer.byteLength(options.memo, "utf8")}).`,
            );
        }
    }

    private validateAutoRenewPeriod(options: CreateAccountOptions): void {
        if (options.autoRenewPeriod == null) return;

        const MIN_AUTO_RENEW = 2_592_000; // 30 days in seconds
        const MAX_AUTO_RENEW = 7_776_000; // 90 days in seconds

        if (
            options.autoRenewPeriod < MIN_AUTO_RENEW ||
            options.autoRenewPeriod > MAX_AUTO_RENEW
        ) {
            throw validationError(
                "CreateAccountValidator",
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
    private validateHighVolume(options: CreateAccountOptions): void {
        if (options.highVolume === true && options.maxTransactionFee == null) {
            // highVolume without maxTransactionFee uses variable-rate pricing uncapped
        }
    }

    private validateKeyType(options: CreateAccountOptions): void {
        if (
            options.keyType != null &&
            options.keyType !== AccountType.ED25519 &&
            options.keyType !== AccountType.ECDSA
        ) {
            throw validationError(
                "CreateAccountValidator",
                `Invalid keyType "${String(options.keyType)}". Expected AccountType.ED25519 or AccountType.ECDSA.`,
            );
        }
    }
}
