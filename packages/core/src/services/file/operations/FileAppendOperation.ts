import type { FileId } from "@hiero-ledger/sdk";
import { FileAppendTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { FileAppendValidator } from "../validation/index.js";

/**
 * Low-level options for the `FileAppend` SDK transaction.
 *
 * Mirrors the surface of `FileAppendTransaction`. Callers usually go
 * through `FileService.appendToFile` — or, for the initial-create + grow
 * flow, through `FileService.createFile`, which chains an append after
 * the create when contents exceed the per-transaction limit.
 *
 * **Chunking is handled by the SDK.** Contents larger than `chunkSize`
 * bytes (default 4096) are automatically split into multiple sequential
 * chunk transactions, up to `maxChunks` (default 20). The returned
 * receipt corresponds to the **first** chunk; the SDK waits for each
 * chunk's receipt internally.
 *
 * Signing: every key in the file's `keys` MUST sign — pass them via
 * `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. `FileAppend` is not exposed for scheduling here.
 */
export interface FileAppendOperationOptions extends TransactionOptions {
    /** File to append to. */
    fileId: string | FileId;
    /** Content to append. Split into chunks automatically by the SDK. */
    contents: Uint8Array | string;
    /**
     * Maximum number of chunks the SDK is allowed to split the append
     * into. Defaults to 20 on the SDK side. Increase for very large
     * payloads.
     */
    maxChunks?: number;
    /**
     * Chunk size in bytes. Defaults to 4096 on the SDK side. Reduce
     * when many signers are needed (each chunk is a separate
     * transaction requiring the full signature set).
     */
    chunkSize?: number;
    /** Delay in milliseconds between successive chunk submissions. */
    chunkInterval?: number;
}

export class FileAppendOperation extends BaseOperation<FileAppendOperationOptions> {
    protected readonly type = "FileAppend";
    protected readonly serviceName = "FileService";
    protected readonly methodName = "appendToFile";
    protected readonly validator = new FileAppendValidator();

    /** Submit a `FileAppendTransaction`. */
    async execute(options: FileAppendOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: FileAppendOperationOptions,
    ): FileAppendTransaction {
        const tx = new FileAppendTransaction()
            .setFileId(options.fileId)
            .setContents(options.contents);

        if (options.maxChunks != null) {
            tx.setMaxChunks(options.maxChunks);
        }

        if (options.chunkSize != null) {
            tx.setChunkSize(options.chunkSize);
        }

        if (options.chunkInterval != null) {
            tx.setChunkInterval(options.chunkInterval);
        }

        return tx;
    }
}
