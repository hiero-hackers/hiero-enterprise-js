import { validationError } from "../../../errors/index.js";
import type { FileUpdateOperationOptions } from "../operations/index.js";

/**
 * Validates `FileUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * **What this validator enforces:**
 *  - `fileId` is present and non-empty.
 *  - The non-clearable `expirationTime` field rejects `null` — TypeScript
 *    blocks this at compile time, but JavaScript callers / `any`-typed
 *    data can still slip a `null` through, and the SDK would silently
 *    drop it.
 *  - At least one field changes — a `FileUpdate` with only `fileId`
 *    still costs network fees but mutates nothing.
 *
 * **Signing rules we do _not_ enforce locally** (network-enforced via
 * `INVALID_SIGNATURE`):
 *  - The file's existing `keys` must sign — supply them via
 *    `additionalSigners` (or `externalSigners`).
 *  - Rotating `keys` to a new key list additionally requires the new
 *    keys to sign.
 */
export class FileUpdateValidator {
    /**
     * @throws {HieroError} If validation fails
     */
    validate(options: FileUpdateOperationOptions): void {
        this.validateFileId(options);
        this.validateNonClearableFields(options);
        this.validateAtLeastOneChange(options);
    }

    private validateFileId(options: FileUpdateOperationOptions): void {
        if (options.fileId == null) {
            throw validationError("FileUpdateValidator", "fileId is required.");
        }

        if (
            typeof options.fileId === "string" &&
            options.fileId.trim().length === 0
        ) {
            throw validationError(
                "FileUpdateValidator",
                "fileId cannot be empty.",
            );
        }
    }

    /**
     * Reject `null` on fields the SDK has no `clearX()` for. Without
     * this guard, a JS caller passing `null` would have it silently
     * dropped by `build()` instead of triggering the clear they
     * expected.
     */
    private validateNonClearableFields(
        options: FileUpdateOperationOptions,
    ): void {
        // Read with a deliberately wide cast — TypeScript blocks `null`
        // at compile time, but JS callers / `any` data can still pass it.
        const wide = options as { expirationTime?: unknown };

        if (wide.expirationTime === null) {
            throw validationError(
                "FileUpdateValidator",
                "expirationTime cannot be null — this field has no clear operation. Omit it to leave unchanged.",
            );
        }
    }

    /**
     * Reject calls that wouldn't change anything on the network.
     *
     * A `FileUpdate` with only `fileId` and no other field still costs
     * network fees but mutates nothing — almost always a programmer
     * bug. Fail loudly instead of silently burning HBAR.
     */
    private validateAtLeastOneChange(
        options: FileUpdateOperationOptions,
    ): void {
        const hasChange =
            options.contents !== undefined ||
            options.keys !== undefined ||
            options.fileMemo !== undefined ||
            options.expirationTime !== undefined;

        if (!hasChange) {
            throw validationError(
                "FileUpdateValidator",
                "updateFile requires at least one field to change. Pass one of: contents, keys, fileMemo, expirationTime.",
            );
        }
    }
}
