/**
 * Create File — provision entries on the Hiero File Service (HFS).
 *
 * HFS files are versioned byte blobs stored on-ledger. They are used
 * to host smart-contract bytecode, chain-of-custody attestations,
 * schema definitions, notarised documents, and any payload that
 * benefits from consensus-timestamped storage.
 *
 * Demonstrates the create shapes exposed by `FileService.createFile`:
 *
 *  - Empty file  — `createFile()` with no arguments.
 *  - Simple      — string / byte contents with default operator keys.
 *  - Custom key  — an off-operator key controls future modifications
 *                  (both the operator AND the new key must sign create).
 *  - Immutable   — `keys: []` locks the file until expiration.
 *  - With memo + expiration — override the ~91-day default expiry.
 *  - Large payload — auto-chunked via a follow-up `FileAppend`.
 *
 * Run: pnpm tsx src/file/create-file.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { FileService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Simplest possible file: no contents, no custom keys.
 *
 * Calling `createFile()` with no arguments produces an empty file
 * whose only key is the operator's public key — so the operator can
 * later append, update, or delete it.
 */
async function createEmptyFile(fileService: FileService) {
    console.log("=== Create empty file ===\n");

    const { fileId } = await fileService.createFile();

    console.log("File ID:", fileId);
    console.log("  - zero bytes, operator-modifiable");
    console.log();

    return fileId;
}

/**
 * File with initial UTF-8 contents. The `contents` field accepts either
 * a `string` (encoded as UTF-8) or raw `Uint8Array` bytes.
 *
 * With no `keys` override, the operator's public key is used so future
 * updates require only the operator's signature.
 */
async function createSimpleFile(fileService: FileService) {
    console.log("=== Create file with initial contents ===\n");

    const { fileId } = await fileService.createFile({
        contents: "hello, hiero file service",
        fileMemo: "greeting",
    });

    console.log("File ID:", fileId);
    console.log("  - contents: 'hello, hiero file service'");
    console.log("  - operator may later update or delete");
    console.log();

    return fileId;
}

/**
 * File controlled by an off-operator key.
 *
 * Every key in the new file's `keys` list must sign the `FileCreate`
 * transaction — pass the custom key via `additionalSigners`. Later
 * updates / appends / deletes will also require that same key.
 */
async function createCustomKeyedFile(fileService: FileService) {
    console.log("=== Create file with a custom key ===\n");

    const customKey = PrivateKey.generateED25519();

    const { fileId } = await fileService.createFile({
        contents: "signed-only file",
        keys: [customKey.publicKey],
        // The custom key MUST co-sign FileCreate — otherwise the network
        // rejects with INVALID_SIGNATURE.
        additionalSigners: [customKey],
    });

    console.log("File ID:", fileId);
    console.log("  - only the custom key may update or delete");
    console.log();

    return { fileId, customKey };
}

/**
 * Immutable file: `keys: []`.
 *
 * An empty key list produces a file that nobody can update or delete —
 * it lives on the ledger until its expiration is reached. Useful for
 * notarisation, tamper-evident audit records, or bytecode you never
 * want to change.
 */
async function createImmutableFile(fileService: FileService) {
    console.log("=== Create immutable file (keys: []) ===\n");

    const { fileId } = await fileService.createFile({
        contents: "carved in stone",
        keys: [],
        fileMemo: "immutable",
    });

    console.log("File ID:", fileId);
    console.log("  - cannot be updated or deleted");
    console.log();

    return fileId;
}

/**
 * File with a caller-provided expiration.
 *
 * The SDK default expiration is ~91 days from now; override it with
 * an explicit `Date` (or `Timestamp`) up to the network's max window.
 */
async function createFileWithExpiration(fileService: FileService) {
    console.log("=== Create file with custom fileMemo + expiration ===\n");

    // ~90 days out — near the top of the network's auto-renew window
    // (~92 days). Values past that cap trigger AUTORENEW_DURATION_NOT_IN_RANGE.
    const expirationTime = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const { fileId } = await fileService.createFile({
        contents: "long-lived",
        fileMemo: "retention: 90d",
        expirationTime,
    });

    console.log("File ID:", fileId);
    console.log("  - expires at:", expirationTime.toISOString());
    console.log();

    return fileId;
}

/**
 * Large-payload file — beyond the ~4 KiB per-transaction limit.
 *
 * `FileService.createFile` submits the leading chunk via
 * `FileCreateTransaction` and appends the remainder via a follow-up
 * `FileAppendTransaction` (which the SDK further sub-chunks).
 *
 * From the caller's perspective it's a single call — the facade hides
 * the chunk boundary entirely.
 */
async function createLargeFile(fileService: FileService) {
    console.log("=== Create large file (auto-append past 4 KiB) ===\n");

    // 10 KiB payload — three chunks under the ~4 KiB boundary.
    const payload = Buffer.alloc(10 * 1024, 0x61); // "aaaa..."

    const { fileId } = await fileService.createFile({
        contents: payload,
        fileMemo: "10 KiB blob",
    });

    console.log("File ID:", fileId);
    console.log(`  - contents: ${payload.byteLength} bytes (auto-appended)`);
    console.log();

    return fileId;
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const fileService = new FileService(context);
    try {
        await createEmptyFile(fileService);
        await createSimpleFile(fileService);
        await createCustomKeyedFile(fileService);
        await createImmutableFile(fileService);
        await createFileWithExpiration(fileService);
        await createLargeFile(fileService);
        console.log("All file-create scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("create-file sample failed:", error);
    process.exitCode = 1;
});
