import type { FileId } from "@hiero-ledger/sdk";
import { FileDeleteTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { FileDeleteValidator } from "../validation/index.js";

/**
 * Low-level options for the `FileDelete` SDK transaction.
 *
 * Mirrors the surface of `FileDeleteTransaction` 1:1. Deletion clears
 * the file contents to zero bytes and marks the entity as deleted;
 * subsequent `FileContentsQuery` calls return an empty payload and
 * `FileInfoQuery` reports `isDeleted: true`.
 *
 * Signing: every key in the file's `keys` MUST sign — pass them via
 * `additionalSigners`. A file created with an empty `keys` list is
 * only deletable via network expiration.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface FileDeleteOperationOptions extends TransactionOptions {
    fileId: string | FileId;
}

export class FileDeleteOperation extends BaseOperation<FileDeleteOperationOptions> {
    protected readonly type = "FileDelete";
    protected readonly serviceName = "FileService";
    protected readonly methodName = "deleteFile";
    protected readonly validator = new FileDeleteValidator();

    /** Submit a `FileDeleteTransaction`. */
    async execute(options: FileDeleteOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: FileDeleteOperationOptions,
    ): FileDeleteTransaction {
        return new FileDeleteTransaction().setFileId(options.fileId);
    }
}
