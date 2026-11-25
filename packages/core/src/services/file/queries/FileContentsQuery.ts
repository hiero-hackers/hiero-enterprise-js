import type { FileId } from "@hiero-ledger/sdk";
import {
    FileContentsQuery as SdkFileContentsQuery,
    Status,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

/**
 * Read-only consensus query for file contents.
 *
 * Wraps the SDK's `FileContentsQuery` and returns the raw file bytes.
 * Hits the consensus nodes directly — returns the most current state
 * with no mirror-node propagation lag.
 *
 * Deleted files return a zero-length payload (rather than throwing).
 */
export class FileContentsQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    /**
     * Fetch the current contents of a file from the consensus nodes.
     *
     * @param fileId - The file entity ID (e.g., `"0.0.12345"`)
     * @returns The raw file bytes — empty for a deleted file
     */
    async execute(
        fileId: string | FileId,
        options: QueryOptions = {},
    ): Promise<Uint8Array> {
        if (fileId == null) {
            throw validationError(
                "FileService.getFileContents",
                "fileId is required.",
                Status.InvalidFileId,
            );
        }

        try {
            const query = new SdkFileContentsQuery().setFileId(fileId);
            return await this.executor.run(query, options, {
                type: "FileContentsQuery",
                serviceName: "FileService",
                methodName: "getFileContents",
                timestamp: new Date(),
            });
        } catch (error) {
            throw normalizeError(error, "FileService.getFileContents");
        }
    }
}
