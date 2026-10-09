import type { Key, KeyList, FileId, Timestamp } from "@hiero-ledger/sdk";
import { FileUpdateTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { FileUpdateValidator } from "../validation/index.js";

/**
 * Low-level options for the `FileUpdate` SDK transaction.
 *
 * Mirrors the surface of `FileUpdateTransaction`. Callers usually go
 * through `FileService.updateFile`, which additionally chains a
 * `FileAppendTransaction` when the new contents exceed the
 * per-transaction limit.
 *
 * Optional fields follow the three-state convention:
 *
 *  - **omitted (undefined)** — leave the current network value unchanged
 *  - **`null`**               — clear the field on the network (only
 *                               supported on fields explicitly typed
 *                               `T | null`)
 *  - **a value**              — replace the current value
 *
 * `expirationTime` is **not clearable** — the SDK exposes no
 * `clearExpirationTime()` for it. The validator rejects `null` on this
 * field so the caller's intent isn't silently dropped.
 *
 * At least one optional field must be provided alongside `fileId` — a
 * no-op update is rejected by the validator before any network call.
 *
 * **Signing rules** (network-enforced, not by the validator):
 *  - The file's existing `keys` MUST sign — supply them via
 *    `additionalSigners` (or `externalSigners`) if the operator isn't
 *    already one of them.
 *  - Rotating `keys` to a new list additionally requires the new keys
 *    to sign.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface FileUpdateOperationOptions extends TransactionOptions {
    /** File to update. */
    fileId: string | FileId;
    /**
     * Replace the file contents. Sized against the per-transaction limit
     * (~4 KiB); larger payloads should go through `FileService.updateFile`,
     * which chains a `FileAppendTransaction`.
     */
    contents?: Uint8Array | string;
    /**
     * Replace the key list. Pass `[]` to make the file unmodifiable.
     */
    keys?: Key[] | KeyList;
    /** New file memo. `null` clears the memo. */
    fileMemo?: string | null;
    /**
     * Extend the file's expiration. **Not clearable** — passing `null`
     * is rejected by the validator. Omit to leave unchanged.
     */
    expirationTime?: Date | Timestamp;
}

export class FileUpdateOperation extends BaseOperation<FileUpdateOperationOptions> {
    protected readonly type = "FileUpdate";
    protected readonly serviceName = "FileService";
    protected readonly methodName = "updateFile";
    protected readonly validator = new FileUpdateValidator();

    /** Submit a `FileUpdateTransaction`. */
    async execute(options: FileUpdateOperationOptions) {
        return await this.run(options);
    }

    /** Schedule a `FileUpdateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: FileUpdateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    protected build(
        options: FileUpdateOperationOptions,
    ): FileUpdateTransaction {
        const tx = new FileUpdateTransaction().setFileId(options.fileId);

        if (options.contents !== undefined) {
            tx.setContents(options.contents);
        }

        if (options.keys !== undefined) {
            tx.setKeys(options.keys);
        }

        if (options.fileMemo === null) {
            // Empty-string sentinel — the network's canonical way to
            // clear a file memo. The SDK exposes no `clearFileMemo()`.
            tx.setFileMemo("");
        } else if (options.fileMemo !== undefined) {
            tx.setFileMemo(options.fileMemo);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        return tx;
    }
}
