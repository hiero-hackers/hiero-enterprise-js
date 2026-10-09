import type { FileId, Key } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import {
    HieroError,
    HieroErrorCodes,
    validationError,
} from "../../errors/index.js";
import type { QueryOptions, ScheduleOptions } from "../transaction/index.js";
import {
    FileCreateOperation,
    FileAppendOperation,
    FileUpdateOperation,
    FileDeleteOperation,
} from "./operations/index.js";
import type {
    FileCreateOperationOptions,
    FileAppendOperationOptions,
    FileUpdateOperationOptions,
    FileDeleteOperationOptions,
} from "./operations/index.js";
import { FileInfoQuery, FileContentsQuery } from "./queries/index.js";
import type { FileInfoResult } from "./queries/index.js";

/**
 * Per-transaction network limit for `FileCreate` / `FileUpdate` payloads.
 * Anything larger gets split into a leading create/update carrying this
 * many bytes, followed by a `FileAppendTransaction` for the remainder
 * (which the SDK further sub-chunks internally).
 */
const MAX_FILE_TX_BYTES = 4096;

/**
 * Options for creating a file via `FileCreateTransaction`.
 *
 * If `contents` is larger than the per-transaction network limit
 * (~4 KiB), the leading portion is submitted via `FileCreateTransaction`
 * and the remainder appended via `FileAppendTransaction`.
 *
 * If `keys` is omitted, the operator's public key is used — matches the
 * default a simple "upload a file I can later modify" caller expects.
 * Pass an empty array (`keys: []`) for an unmodifiable file.
 */
export type CreateFileOptions = FileCreateOperationOptions;

/**
 * Options for appending content to an existing file via
 * `FileAppendTransaction`. The SDK auto-chunks the payload against
 * `chunkSize` and `maxChunks`.
 */
export type AppendToFileOptions = FileAppendOperationOptions;

/**
 * Options for updating a file via `FileUpdateTransaction`.
 *
 * If `contents` is larger than the per-transaction network limit
 * (~4 KiB), the leading portion is submitted via `FileUpdateTransaction`
 * and the remainder appended via `FileAppendTransaction`.
 */
export type UpdateFileOptions = FileUpdateOperationOptions;

/** Options for deleting a file via `FileDeleteTransaction`. */
export type DeleteFileOptions = FileDeleteOperationOptions;

/** Plain-object result returned by `getFileInfo`. */
export type GetFileInfoResult = FileInfoResult;

/**
 * Service for managing files on the Hiero File Service (HFS).
 *
 * Wraps the underlying `FileCreate*` / `FileAppend*` / `FileUpdate*` /
 * `FileDelete*` SDK surface with validated, observability-aware
 * operations. Listeners registered on the surrounding `HieroContext`
 * see `before` / `after` events for every file transaction submitted
 * here.
 *
 * Operations are organised internally into per-transaction classes
 * under `services/file/operations/`; validators live alongside in
 * `services/file/validation/`. This facade routes typed option objects
 * to the right operation class so callers never have to think about
 * the SDK transaction class hierarchy — or the ~4 KiB per-transaction
 * chunking boundary.
 */
export class FileService {
    private readonly createOperation: FileCreateOperation;
    private readonly appendOperation: FileAppendOperation;
    private readonly updateOperation: FileUpdateOperation;
    private readonly deleteOperation: FileDeleteOperation;
    private readonly infoQuery: FileInfoQuery;
    private readonly contentsQuery: FileContentsQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new FileCreateOperation(context);
        this.appendOperation = new FileAppendOperation(context);
        this.updateOperation = new FileUpdateOperation(context);
        this.deleteOperation = new FileDeleteOperation(context);
        this.infoQuery = new FileInfoQuery(context);
        this.contentsQuery = new FileContentsQuery(context);
    }

    /**
     * Create a file with the given contents.
     *
     * `options` itself is optional — calling `createFile()` with no
     * arguments creates an empty, operator-modifiable file (SDK parity).
     *
     * `contents` is optional — omitting it creates an empty file
     *
     * If `contents` exceeds the per-transaction network limit
     * (~4 KiB) they are automatically split.
     * The leading chunk is submitted via `FileCreateTransaction`,
     * and the remainder is appended via a single `FileAppendTransaction`
     * (which the SDK further sub-chunks internally).
     *
     * If `keys` is omitted the file is created with `[operatorPublicKey]`
     * so the operator can later update or delete it. Pass `keys: []`
     * for an unmodifiable file.
     *
     * `FileCreate` is not whitelisted for scheduling on the network, so
     * no `scheduleCreateFile` variant is exposed.
     *
     * **Signing**: any non-operator key placed in `keys` must ALSO sign
     * the `FileCreate` transaction — supply their private keys via
     * `additionalSigners` (inherited from `TransactionOptions`), otherwise
     * the network rejects with `INVALID_SIGNATURE`.
     *
     * **Partial-create recovery**: if the leading `FileCreate` succeeds
     * but a follow-up `FileAppend` for oversized payloads fails, the
     * thrown `HieroError` carries the already-provisioned `fileId` so
     * callers can retry the append or delete the partial file.
     *
     * @param options.contents - Initial file contents (UTF-8 string or raw bytes); omit for an empty file
     * @param options.keys - Keys required to later modify or delete the file; defaults to `[operatorPublicKey]`, pass `[]` for immutable. Every non-operator key here must also sign the create via `additionalSigners`.
     * @param options.fileMemo - Short memo attached to the file entity
     * @param options.expirationTime - Expiration timestamp; SDK default is ~91 days from now
     * @returns The new file's entity ID (e.g., `"0.0.12345"`)
     *
     * @example
     * ```typescript
     * // Empty, operator-modifiable file
     * const emptyId = await fileService.createFile();
     *
     * // File with initial contents
     * const fileId = await fileService.createFile({
     *     contents: Buffer.from("hello", "utf8"),
     *     fileMemo: "greeting",
     * });
     *
     * // Custom-keyed file — customKey must co-sign FileCreate
     * const customKey = PrivateKey.generateED25519();
     * const fileId = await fileService.createFile({
     *     contents: "signed",
     *     keys: [customKey.publicKey],
     *     additionalSigners: [customKey],
     * });
     * ```
     */
    async createFile(options: CreateFileOptions = {}) {
        const [head, tail] = splitContents(options.contents);
        const keys = options.keys ?? [this.context.operatorPublicKey as Key];

        const result = await this.createOperation.execute({
            ...options,
            contents: head,
            keys,
        });

        if (result.fileId == null) {
            throw new HieroError(
                "FileCreate receipt did not include a fileId.",
                {
                    code: HieroErrorCodes.SdkError,
                    context: "FileService.createFile",
                },
            );
        }

        if (tail !== null) {
            try {
                await this.appendOperation.execute({
                    ...options,
                    fileId: result.fileId,
                    contents: tail,
                });
            } catch (error) {
                // FileCreate already succeeded on-chain — the caller
                // needs the fileId to retry the append or delete the
                // partial file. Surface it on the thrown error.
                const cause = error as Error;
                throw new HieroError(
                    `File ${result.fileId} was created, but appending the remainder of its contents failed: ${cause.message}`,
                    {
                        code: HieroErrorCodes.SdkError,
                        context: "FileService.createFile",
                        cause,
                        fileId: result.fileId.toString(),
                    },
                );
            }
        }

        return result;
    }

    /**
     * Append content to an existing file. The SDK auto-chunks the
     * payload — no size cap beyond what `maxChunks * chunkSize` allows.
     *
     * Every key in the file's `keys` list must sign — pass them via
     * `additionalSigners` if the operator isn't already one of them.
     *
     * `FileAppend` is not whitelisted for scheduling on the network, so
     * no `scheduleAppendToFile` variant is exposed.
     *
     * @param options.fileId - File to append to (required)
     * @param options.contents - Payload to append (UTF-8 string or raw bytes, required)
     * @param options.maxChunks - Max chunks the SDK will produce (SDK default 20)
     * @param options.chunkSize - Bytes per chunk (SDK default 4096)
     * @param options.chunkInterval - Milliseconds to wait between chunks
     */
    async appendToFile(options: AppendToFileOptions) {
        return await this.appendOperation.execute(options);
    }

    /**
     * Update file properties. Any subset of `contents`, `keys`,
     * `fileMemo`, or `expirationTime` may be supplied — see
     * `UpdateFileOptions` for the three-state (undefined / null / value)
     * convention.
     *
     * When `contents` exceeds the per-transaction network limit
     * (~4 KiB), the leading chunk goes into the `FileUpdate` and the
     * remainder into a single follow-up `FileAppendTransaction`.
     *
     * Every key in the file's existing `keys` must sign; rotating
     * `keys` to a new list additionally requires the new keys to sign.
     * Pass all required keys via `additionalSigners`.
     *
     * @param options.fileId - File to update (required)
     * @param options.contents - Replace the file contents (auto-appended if larger than the per-tx limit)
     * @param options.keys - Replace the key list; pass `[]` to make the file unmodifiable
     * @param options.fileMemo - New file memo, or `null` to clear
     * @param options.expirationTime - Extend the file's expiration (not clearable)
     */
    async updateFile(options: UpdateFileOptions) {
        if (options.contents === undefined) {
            return await this.updateOperation.execute(options);
        }

        const [head, tail] = splitContents(options.contents);

        // The update transaction is the logical write the caller asked for;
        // any append is an internal continuation of the same contents.
        const result = await this.updateOperation.execute({
            ...options,
            contents: head,
        });

        if (tail !== null) {
            await this.appendOperation.execute({
                ...options,
                fileId: options.fileId,
                contents: tail,
            });
        }
        return result;
    }

    /**
     * Schedule a `FileUpdateTransaction` for deferred multi-sig execution.
     *
     * `FileUpdate` is the only file transaction currently in the network's
     * default `scheduling.whitelist` — `FileCreate`, `FileAppend`, and
     * `FileDelete` are rejected with `SCHEDULED_TRANSACTION_NOT_IN_WHITELIST`
     * on mainnet / testnet, which is why this facade exposes no
     * `scheduleCreateFile` / `scheduleDeleteFile` counterparts.
     *
     * `contents` must fit in a single transaction (~4 KiB) — auto-append
     * cannot be atomically scheduled. Rejects larger payloads before any
     * network call.
     *
     * @param options - Same fields as `updateFile` (with the per-tx `contents` cap)
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleUpdateFile(
        options: UpdateFileOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        if (options.contents !== undefined) {
            const [, tail] = splitContents(options.contents);
            if (tail !== null) {
                throw validationError(
                    "FileService.scheduleUpdateFile",
                    "scheduleUpdateFile does not support contents larger than the per-transaction network limit " +
                        `(~${MAX_FILE_TX_BYTES} bytes). Update the file directly and schedule follow-up updates instead.`,
                );
            }
        }

        return await this.updateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Delete a file. Contents are zeroed and the entity is marked
     * `isDeleted: true` for the remainder of its expiration window.
     *
     * Every key in the file's `keys` list must sign — pass them via
     * `additionalSigners`. A file created with an empty `keys` list is
     * only deletable via network expiration.
     *
     * `FileDelete` is not whitelisted for scheduling on the network, so
     * no `scheduleDeleteFile` variant is exposed.
     *
     * @param options.fileId - File to delete (required)
     */
    async deleteFile(options: DeleteFileOptions) {
        return await this.deleteOperation.execute(options);
    }

    /**
     * Fetch the current contents of a file from the consensus nodes.
     * Returns a zero-length payload for deleted files.
     *
     * Hits the consensus nodes directly — no mirror-node propagation
     * lag.
     *
     * @param fileId - The file entity ID (e.g., `"0.0.12345"`)
     * @param options - Optional query options (payer, payment caps, node targeting)
     * @returns The raw file bytes — empty for a deleted file
     */
    async getFileContents(
        fileId: string | FileId,
        options?: QueryOptions,
    ): Promise<Uint8Array> {
        return await this.contentsQuery.execute(fileId, options);
    }

    /**
     * Fetch a file's metadata (size, expiration, keys, `isDeleted`,
     * memo, ledger) as a plain object decoupled from SDK primitives.
     *
     * Hits the consensus nodes directly — no mirror-node propagation
     * lag.
     *
     * @param fileId - The file entity ID (e.g., `"0.0.12345"`)
     * @param options - Optional query options (payer, payment caps, node targeting)
     * @returns Plain-object file info — never `null`; throws if the file does not exist
     */
    async getFileInfo(
        fileId: string | FileId,
        options?: QueryOptions,
    ): Promise<GetFileInfoResult> {
        return await this.infoQuery.execute(fileId, options);
    }
}

/**
 * Split `contents` into the leading chunk that fits inside a single
 * `FileCreate` / `FileUpdate` transaction and the remainder that should
 * be appended.
 *
 */
function splitContents(
    contents: Uint8Array | string | undefined,
): [Uint8Array | string | undefined, Uint8Array | string | null] {
    if (contents == null) {
        return [contents, null];
    }

    if (typeof contents === "string") {
        const encoded = Buffer.from(contents, "utf8");
        if (encoded.byteLength <= MAX_FILE_TX_BYTES) {
            return [contents, null];
        }
        return [
            encoded.subarray(0, MAX_FILE_TX_BYTES),
            encoded.subarray(MAX_FILE_TX_BYTES),
        ];
    }

    if (contents.byteLength <= MAX_FILE_TX_BYTES) {
        return [contents, null];
    }
    return [
        contents.subarray(0, MAX_FILE_TX_BYTES),
        contents.subarray(MAX_FILE_TX_BYTES),
    ];
}
