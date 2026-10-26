import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { FileService } from "../../../../src/services/index.js";

describe("FileContentsQuery", () => {
    let fileService: FileService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        fileService = new FileService(ctx);
    });

    it("round-trips a small string payload byte-for-byte", async () => {
        const payload = "hello from FileContentsQuery";
        const { fileId } = await fileService.createFile({ contents: payload });

        const bytes = await fileService.getFileContents(fileId);

        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(Buffer.from(bytes).toString("utf8")).toBe(payload);
    });

    it("round-trips a raw Uint8Array payload byte-for-byte", async () => {
        const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
        const { fileId } = await fileService.createFile({ contents: payload });

        const bytes = await fileService.getFileContents(fileId);

        expect(bytes.byteLength).toBe(payload.byteLength);
        expect(Buffer.from(bytes).equals(Buffer.from(payload))).toBe(true);
    });

    it("returns the full multi-chunk payload for a large file", async () => {
        // 6 KiB — spans the create + auto-append boundary.
        const size = 6 * 1024;
        const payload = Buffer.alloc(size, 0x64); // "dddd..."
        const { fileId } = await fileService.createFile({ contents: payload });

        const bytes = await fileService.getFileContents(fileId);
        expect(bytes.byteLength).toBe(size);
        expect(bytes[0]).toBe(0x64);
        expect(bytes[size - 1]).toBe(0x64);
    });

    it("returns an empty Uint8Array for a deleted file", async () => {
        const { fileId } = await fileService.createFile({
            contents: "will be deleted",
        });
        await fileService.deleteFile({ fileId });

        const bytes = await fileService.getFileContents(fileId);
        expect(bytes.byteLength).toBe(0);
    });

    it("throws when the file does not exist", async () => {
        await expect(
            fileService.getFileContents("0.0.999999999"),
        ).rejects.toThrow();
    });
});
