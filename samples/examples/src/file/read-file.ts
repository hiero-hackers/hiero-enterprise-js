/**
 * Read File — query file contents and metadata from the consensus
 * nodes via `FileService`.
 *
 * Both queries hit the consensus network directly (no mirror-node
 * propagation lag):
 *
 *  - `getFileInfo(fileId)`     — size, expiration, keys, isDeleted,
 *                                 memo, ledger id, projected to a plain
 *                                 object decoupled from SDK primitives.
 *  - `getFileContents(fileId)` — the raw file bytes (zero-length for a
 *                                 deleted file).
 *
 * Demonstrates:
 *  - Reading a small file.
 *  - Reading a large auto-appended file (verifies the tail chunks
 *    reassemble correctly).
 *  - Inspecting metadata on an immutable file.
 *  - Observing the zeroed contents + `isDeleted` flag after a delete.
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/file/read-file.ts
 */

import {
    FileService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

/**
 * Read a small file end-to-end: create → getFileInfo → getFileContents.
 */
async function readSmallFile(fileService: FileService) {
    console.log("=== Read a small file ===\n");

    const payload = "hello, hiero file service";
    const { fileId } = await fileService.createFile({
        contents: payload,
        fileMemo: "small demo",
    });

    const info = await fileService.getFileInfo(fileId);
    const bytes = await fileService.getFileContents(fileId);

    console.log("File ID:", fileId.toString());
    console.log("  - size (info):", info.size.toString(), "bytes");
    console.log("  - memo:", info.fileMemo);
    console.log("  - isDeleted:", info.isDeleted);
    console.log("  - bytes:", Buffer.from(bytes).toString("utf8"));
    console.log();
}

/**
 * Read a large auto-appended file — verify the payload the caller sees
 * matches the payload written (the facade hides the chunk boundary).
 */
async function readLargeFile(fileService: FileService) {
    console.log("=== Read a large (auto-appended) file ===\n");

    // 8 KiB payload — two chunks under the ~4 KiB boundary.
    const size = 8 * 1024;
    const payload = Buffer.alloc(size, 0x62); // "bbbb..."

    const { fileId } = await fileService.createFile({
        contents: payload,
        fileMemo: "8 KiB blob",
    });

    const info = await fileService.getFileInfo(fileId);
    const bytes = await fileService.getFileContents(fileId);

    console.log("File ID:", fileId);
    console.log("  - size (info):", info.size.toString(), "bytes");
    console.log("  - bytes (read back):", bytes.byteLength);
    console.log("  - first byte:", bytes[0]?.toString(16));
    console.log("  - last byte:", bytes[bytes.byteLength - 1]?.toString(16));
    console.log();
}

/**
 * Inspect metadata on an immutable (`keys: []`) file.
 *
 * The `keys` field on the returned info is null (or an empty KeyList)
 * for files created without a mutating key.
 */
async function inspectImmutableFile(fileService: FileService) {
    console.log("=== Inspect an immutable file's metadata ===\n");

    const { fileId } = await fileService.createFile({
        contents: "immutable",
        keys: [],
        fileMemo: "no keys",
    });

    const info = await fileService.getFileInfo(fileId);

    console.log("File ID:", fileId);
    console.log("  - keys:", info.keys ?? "(none — file is immutable)");
    console.log("  - isDeleted:", info.isDeleted);
    console.log("  - memo:", info.fileMemo);
    console.log();
}

/**
 * Read a deleted file. Contents are zeroed and `isDeleted` flips
 * true — the entity itself remains queryable until its expiration
 * window elapses, so the memo is preserved.
 */
async function readDeletedFile(fileService: FileService) {
    console.log("=== Read a deleted file ===\n");

    const { fileId } = await fileService.createFile({
        contents: "delete-me",
        fileMemo: "before deletion",
    });

    await fileService.deleteFile({ fileId });

    const info = await fileService.getFileInfo(fileId);
    const bytes = await fileService.getFileContents(fileId);

    console.log("File ID:", fileId);
    console.log("  - isDeleted:", info.isDeleted);
    console.log("  - size:", info.size.toString(), "bytes");
    console.log("  - memo (preserved):", info.fileMemo);
    console.log("  - bytes length:", bytes.byteLength);
    console.log();
}

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());
    const fileService = new FileService(context);
    try {
        await readSmallFile(fileService);
        await readLargeFile(fileService);
        await inspectImmutableFile(fileService);
        await readDeletedFile(fileService);
        console.log("All file-read scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("read-file sample failed:", error);
    process.exitCode = 1;
});
