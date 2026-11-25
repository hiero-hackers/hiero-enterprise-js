import type { FileId, KeyList } from "@hiero-ledger/sdk";
import { FileInfoQuery as SdkFileInfoQuery, Status } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

/**
 * A plain-object representation of a file's current consensus-node
 * state.
 *
 * Maps the SDK's `FileInfo` to JS-friendly types so callers are not
 * coupled to SDK primitives like `Long`, `Timestamp`, and `KeyList`.
 *
 * Returned by `FileService.getFileInfo`.
 */
export interface FileInfoResult {
    /** The file entity ID (e.g., `"0.0.12345"`). */
    fileId: string;
    /** Number of bytes stored in the file (0 for a deleted file). */
    size: number;
    /**
     * ISO-8601 timestamp at which the file expires and is auto-deleted,
     * or `null` if the file has no expiration set.
     */
    expirationTime: string | null;
    /**
     * Whether the file has been deleted. Deleted files retain their
     * metadata for the remainder of their expiration window but have
     * zero-byte contents.
     */
    isDeleted: boolean;
    /**
     * Keys required to modify or delete the file. Any one of these
     * keys may sign a delete; all of them must sign an update. `null`
     * for files created with an empty key list (unmodifiable).
     */
    keys: KeyList | null;
    /** Short memo attached to the file entity. */
    fileMemo: string;
    /** Ledger this file lives on (mainnet / testnet / previewnet), as a hex string. */
    ledgerId: string | null;
}

/**
 * Read-only consensus query for file state.
 *
 * Wraps the SDK's `FileInfoQuery` and projects the result to a plain
 * `FileInfoResult` object decoupled from SDK primitives. Hits the
 * consensus nodes directly — returns the most current state with no
 * mirror-node propagation lag.
 */
export class FileInfoQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    /**
     * Fetch the current state of a file from the consensus nodes.
     *
     * @param fileId - The file entity ID (e.g., `"0.0.12345"`)
     * @returns Plain-object file info — never `null`; throws if the
     *          file does not exist or the network rejects the query
     */
    async execute(
        fileId: string | FileId,
        options: QueryOptions = {},
    ): Promise<FileInfoResult> {
        if (fileId == null) {
            throw validationError(
                "FileService.getFileInfo",
                "fileId is required.",
                Status.InvalidFileId,
            );
        }

        try {
            const query = new SdkFileInfoQuery().setFileId(fileId);
            const info = await this.executor.run(query, options, {
                type: "FileInfoQuery",
                serviceName: "FileService",
                methodName: "getFileInfo",
                timestamp: new Date(),
            });
            return {
                fileId: info.fileId.toString(),
                size: info.size.toNumber(),
                expirationTime: info.expirationTime
                    ? info.expirationTime.toDate().toISOString()
                    : null,
                isDeleted: info.isDeleted,
                keys: info.keys ?? null,
                fileMemo: info.fileMemo,
                ledgerId: info.ledgerId?.toString() ?? null,
            };
        } catch (error) {
            throw normalizeError(error, "FileService.getFileInfo");
        }
    }
}
