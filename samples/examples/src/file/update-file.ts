/**
 * Update File — modify an existing HFS entry.
 *
 * `FileService.updateFile` accepts any subset of `contents`, `keys`,
 * `fileMemo`, and `expirationTime`. The three-state field convention
 * mirrors `updateTopic`:
 *
 *  - omitted (undefined) — leave the field unchanged
 *  - `null`              — clear the field (only on nullable fields)
 *  - a value             — replace the current value
 *
 * `expirationTime` is NOT clearable — it may only be extended.
 *
 * Every key on the file's existing `keys` list must sign the update;
 * rotating `keys` additionally requires the new keys to sign.
 *
 * Run: pnpm tsx src/file/update-file.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { FileService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Provision a fresh operator-modifiable file to operate on. Each
 * scenario uses its own short-lived file so they don't interfere.
 */
async function createOperatorFile(fileService: FileService, contents: string) {
    return await fileService.createFile({
        contents,
        fileMemo: "initial memo",
    });
}

/**
 * Step 1: replace the file memo.
 *
 * Passing a string value updates the memo. Passing `null` would clear
 * it; passing `undefined` (or omitting the field) leaves it untouched.
 */
async function replaceMemo(fileService: FileService) {
    console.log("=== Replace file memo ===\n");

    const { fileId } = await createOperatorFile(fileService, "memo demo");

    await fileService.updateFile({
        fileId,
        fileMemo: "renamed memo",
    });

    console.log("File ID:", fileId);
    console.log("  - memo changed: 'initial memo' → 'renamed memo'");
    console.log();
}

/**
 * Step 2: clear the file memo with `null`.
 *
 * The SDK has no `clearFileMemo()`; the facade routes `null` through
 * `setFileMemo("")`, the network's canonical clear sentinel.
 */
async function clearMemo(fileService: FileService) {
    console.log("=== Clear file memo (null sentinel) ===\n");

    const { fileId } = await createOperatorFile(fileService, "clear demo");

    await fileService.updateFile({
        fileId,
        fileMemo: null,
    });

    console.log("File ID:", fileId);
    console.log("  - memo cleared");
    console.log();
}

/**
 * Step 3: replace file contents.
 *
 * Payloads larger than ~4 KiB are auto-chunked: the leading chunk goes
 * into `FileUpdateTransaction` and the tail into a follow-up
 * `FileAppendTransaction`.
 */
async function replaceContents(fileService: FileService) {
    console.log("=== Replace file contents ===\n");

    const { fileId } = await createOperatorFile(fileService, "old contents");

    await fileService.updateFile({
        fileId,
        contents: "new contents",
    });

    console.log("File ID:", fileId);
    console.log("  - contents replaced");
    console.log();
}

/**
 * Step 4: extend the file's expiration.
 *
 * `expirationTime` is not clearable — passing `null` is rejected by
 * the validator. Passing a `Date` in the future extends the expiry.
 */
async function extendExpiration(fileService: FileService) {
    console.log("=== Extend file expiration ===\n");

    // Create a short-lived file so the extension is meaningful and
    // stays under the network's ~92-day max auto-renew window.
    const { fileId } = await fileService.createFile({
        contents: "expiry demo",
        expirationTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Extend to ~90 days out — comfortably past the initial expiry.
    const expirationTime = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await fileService.updateFile({
        fileId,
        expirationTime,
    });

    console.log("File ID:", fileId);
    console.log("  - new expiration:", expirationTime.toISOString());
    console.log();
}

/**
 * Step 5: rotate the file's key.
 *
 * Both the OLD and NEW keys must sign the rotation. After it, only
 * the new key is required for subsequent updates.
 */
async function rotateFileKey(fileService: FileService) {
    console.log("=== Rotate file key ===\n");

    const oldKey = PrivateKey.generateED25519();
    const newKey = PrivateKey.generateED25519();

    const { fileId } = await fileService.createFile({
        contents: "rotatable",
        keys: [oldKey.publicKey],
        // Custom key must co-sign FileCreate.
        additionalSigners: [oldKey],
    });

    // Both old AND new keys must sign a key rotation.
    await fileService.updateFile({
        fileId,
        keys: [newKey.publicKey],
        additionalSigners: [oldKey, newKey],
    });

    console.log("File ID:", fileId);
    console.log("  - key rotated");

    // Subsequent updates only need the new key.
    await fileService.updateFile({
        fileId,
        fileMemo: "rotated successfully",
        additionalSigners: [newKey],
    });

    console.log("  - subsequent update signed by new key only");
    console.log();
}

/**
 * Step 6: schedule an update for deferred multi-sig execution.
 *
 * `FileUpdate` is the ONLY file transaction on the network's default
 * scheduling whitelist — create / append / delete cannot be scheduled.
 *
 * The scheduled inner transaction is stored on-chain; the missing
 * signatures may be added over time via `ScheduleService.sign`, at
 * which point the file update executes automatically.
 *
 * `contents` on a scheduled update must fit in a single transaction
 * (~4 KiB) — auto-append is not atomically schedulable.
 */
async function scheduleFileUpdate(fileService: FileService) {
    console.log("=== Schedule a file update ===\n");

    const { fileId } = await createOperatorFile(fileService, "schedule demo");

    const { scheduleId } = await fileService.scheduleUpdateFile({
        fileId,
        fileMemo: "scheduled memo change",
    });

    console.log("File ID:", fileId);
    console.log("  - scheduleId:", scheduleId);
    console.log("  - will execute once all required signatures are collected");
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const fileService = new FileService(context);
    try {
        await replaceMemo(fileService);
        await clearMemo(fileService);
        await replaceContents(fileService);
        await extendExpiration(fileService);
        await rotateFileKey(fileService);
        await scheduleFileUpdate(fileService);
        console.log("All file-update scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("update-file sample failed:", error);
    process.exitCode = 1;
});
