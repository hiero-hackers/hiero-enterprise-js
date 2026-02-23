import {
    FileCreateTransaction,
    FileContentsQuery,
    FileUpdateTransaction,
    FileDeleteTransaction,
    FileAppendTransaction,
    FileInfoQuery,
} from "@hashgraph/sdk";
import type { HieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/** Maximum chunk size for file operations (4KB) */
const MAX_CHUNK_SIZE = 4096;

/**
 * Service for managing files on the Hiero network.
 *
 * Automatically handles chunking for files > 4KB.
 */
export class FileClient {
    private readonly context: HieroContext;

    constructor(context: HieroContext) {
        this.context = context;
    }

    /**
     * Create a new file with the given contents.
     * Automatically chunks large files.
     *
     * @param contents - File contents as a Buffer or Uint8Array
     * @param expirationTime - Optional expiration time
     * @returns The file ID of the created file
     */
    async createFile(
        contents: Uint8Array,
        expirationTime?: Date,
    ): Promise<string> {
        const event: TransactionEvent = {
            type: "FileCreate",
            serviceName: "FileClient",
            methodName: "createFile",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            // If contents fit in a single chunk, create directly
            const firstChunk = contents.slice(0, MAX_CHUNK_SIZE);
            const tx = new FileCreateTransaction().setContents(firstChunk);

            if (expirationTime) {
                tx.setExpirationTime(expirationTime);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const fileId = receipt.fileId!.toString();

            // If there are remaining chunks, append them
            if (contents.length > MAX_CHUNK_SIZE) {
                let offset = MAX_CHUNK_SIZE;
                while (offset < contents.length) {
                    const chunk = contents.slice(
                        offset,
                        offset + MAX_CHUNK_SIZE,
                    );
                    await new FileAppendTransaction()
                        .setFileId(fileId)
                        .setContents(chunk)
                        .execute(this.context.client);
                    offset += MAX_CHUNK_SIZE;
                }
            }

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return fileId;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "FileClient.createFile");
        }
    }

    /**
     * Read the contents of a file.
     *
     * @param fileId - The file to read
     * @returns The file contents
     */
    async readFile(fileId: string): Promise<Uint8Array> {
        try {
            return await new FileContentsQuery()
                .setFileId(fileId)
                .execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, "FileClient.readFile");
        }
    }

    /**
     * Update the contents of a file.
     *
     * @param fileId - The file to update
     * @param contents - The new file contents
     */
    async updateFile(fileId: string, contents: Uint8Array): Promise<void> {
        const event: TransactionEvent = {
            type: "FileUpdate",
            serviceName: "FileClient",
            methodName: "updateFile",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const response = await new FileUpdateTransaction()
                .setFileId(fileId)
                .setContents(contents)
                .execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "FileClient.updateFile");
        }
    }

    /**
     * Delete a file.
     *
     * @param fileId - The file to delete
     */
    async deleteFile(fileId: string): Promise<void> {
        const event: TransactionEvent = {
            type: "FileDelete",
            serviceName: "FileClient",
            methodName: "deleteFile",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const response = await new FileDeleteTransaction()
                .setFileId(fileId)
                .execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "FileClient.deleteFile");
        }
    }

    /**
     * Update the expiration time of a file.
     *
     * @param fileId - The file to update
     * @param expirationTime - The new expiration time
     */
    async updateExpirationTime(
        fileId: string,
        expirationTime: Date,
    ): Promise<void> {
        try {
            await new FileUpdateTransaction()
                .setFileId(fileId)
                .setExpirationTime(expirationTime)
                .execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, "FileClient.updateExpirationTime");
        }
    }

    /**
     * Check if a file has been deleted.
     *
     * @param fileId - The file to check
     * @returns true if the file is deleted
     */
    async isDeleted(fileId: string): Promise<boolean> {
        try {
            const info = await new FileInfoQuery()
                .setFileId(fileId)
                .execute(this.context.client);
            return info.isDeleted;
        } catch (error) {
            throw normalizeError(error, "FileClient.isDeleted");
        }
    }

    /**
     * Get the size of a file in bytes.
     *
     * @param fileId - The file to check
     * @returns The file size
     */
    async getSize(fileId: string): Promise<number> {
        try {
            const info = await new FileInfoQuery()
                .setFileId(fileId)
                .execute(this.context.client);
            return info.size.toNumber();
        } catch (error) {
            throw normalizeError(error, "FileClient.getSize");
        }
    }

    /**
     * Get the expiration time of a file.
     *
     * @param fileId - The file to check
     * @returns The expiration time
     */
    async getExpirationTime(fileId: string): Promise<Date> {
        try {
            const info = await new FileInfoQuery()
                .setFileId(fileId)
                .execute(this.context.client);
            return info.expirationTime!.toDate();
        } catch (error) {
            throw normalizeError(error, "FileClient.getExpirationTime");
        }
    }
}
