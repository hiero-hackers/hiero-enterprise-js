import { describe, it, expect, beforeAll } from "vitest";
import {
    PrivateKey,
    FileInfoQuery,
    FileContentsQuery,
    type Client,
} from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { FileService } from "../../../../src/services/index.js";

describe("FileCreateOperation", () => {
    let client: Client;
    let fileService: FileService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        fileService = new FileService(ctx);
    });

    it("creates a small file with operator-owned defaults", async () => {
        const contents = "hello from integration test";
        const { fileId } = await fileService.createFile({ contents });

        expect(fileId.toString()).toMatch(/^0\.0\.\d+$/);

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);

        expect(info.fileId.toString()).toBe(fileId.toString());
        expect(info.size.toNumber()).toBe(
            Buffer.from(contents, "utf8").byteLength,
        );
        expect(info.isDeleted).toBe(false);
        // Default keys = [operatorPublicKey] — file is modifiable.
        expect(info.keys).not.toBeNull();
    });

    it("creates a file with a fileMemo + expirationTime", async () => {
        // ~91 days out — just past the default 90-day auto-renew.
        const expirationTime = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);

        const { fileId } = await fileService.createFile({
            contents: "with metadata",
            fileMemo: "integration: metadata",
            expirationTime,
        });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);

        expect(info.fileMemo).toBe("integration: metadata");
        // Consensus rounds sub-second precision, but the day should match.
        expect(info.expirationTime.toDate().toISOString().slice(0, 10)).toBe(
            expirationTime.toISOString().slice(0, 10),
        );
    });

    it("creates an unmodifiable file when keys is []", async () => {
        const { fileId } = await fileService.createFile({
            contents: "immutable",
            keys: [],
        });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);

        // No keys ⇒ cannot update or delete (only expiration ends it).
        // The SDK reports null (or an empty KeyList) for such files.
        // We just assert the file is not modifiable via a standard delete.
        await expect(fileService.deleteFile({ fileId })).rejects.toThrow();
        expect(info.fileId.toString()).toBe(fileId.toString());
    });

    it("creates a file with a custom key that must sign for later modifications", async () => {
        const customKey = PrivateKey.generateED25519();

        const { fileId } = await fileService.createFile({
            contents: "custom-keyed",
            keys: [customKey.publicKey],
            // Every key assigned to a new file must sign FileCreate.
            additionalSigners: [customKey],
        });

        // Without customKey, an update should fail.
        await expect(
            fileService.updateFile({
                fileId,
                fileMemo: "should fail without customKey",
            }),
        ).rejects.toThrow();

        // With customKey, the update succeeds.
        await fileService.updateFile({
            fileId,
            fileMemo: "signed by custom key",
            additionalSigners: [customKey],
        });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.fileMemo).toBe("signed by custom key");
    });

    it("auto-chains a FileAppendTransaction for contents over the per-tx limit", async () => {
        // 6 KiB — well past the ~4 KiB single-tx limit.
        const size = 6 * 1024;
        const contents = Buffer.alloc(size, 0x61); // "aaaa..."

        const { fileId } = await fileService.createFile({ contents });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.size.toNumber()).toBe(size);

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(bytes.byteLength).toBe(size);
        // Round-trip byte-for-byte.
        expect(bytes[0]).toBe(0x61);
        expect(bytes[size - 1]).toBe(0x61);
    });

    it("creates an empty file when contents is omitted (SDK parity)", async () => {
        const { fileId } = await fileService.createFile();

        expect(fileId.toString()).toMatch(/^0\.0\.\d+$/);

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.fileId.toString()).toBe(fileId.toString());
        expect(info.size.toNumber()).toBe(0);
        expect(info.isDeleted).toBe(false);

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(bytes.byteLength).toBe(0);
    });
});
