import { AccountType } from "../../../types/index.js";
import { validationError } from "../../../errors/index.js";
import { utf8ByteLength } from "../../../utils/index.js";
import { validateHookCreations } from "../../contract/validation/index.js";
import type { CreateAccountOptions } from "../operations/index.js";

/** A 20-byte EVM address, with or without `0x`. */
const EVM_ADDRESS = /^(0x)?[0-9a-fA-F]{40}$/;

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
        this.validateHighVolume(options);
        validateHookCreations("CreateAccountValidator", "hooks", options.hooks);
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

        // A given EVM address needs no key to derive from, so it may go with `key`
        if (
            options.key != null &&
            options.alias != null &&
            typeof options.alias !== "string"
        ) {
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

        if (
            typeof options.alias === "string" &&
            !EVM_ADDRESS.test(options.alias)
        ) {
            throw validationError(
                "CreateAccountValidator",
                "alias must be an EVM address: 40 hex characters, optionally prefixed with 0x.",
            );
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
        if (options.memo && utf8ByteLength(options.memo) > 100) {
            throw validationError(
                "CreateAccountValidator",
                `Account memo exceeds 100 bytes (got ${utf8ByteLength(options.memo)}).`,
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
