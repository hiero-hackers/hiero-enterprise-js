import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { FileService } from "../../../../src/services/index.js";

describe("FileInfoQuery", () => {
    let fileService: FileService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        fileService = new FileService(ctx);
    });

    it("returns plain-object info for a freshly created file", async () => {
        const contents = "info-query payload";
        const { fileId } = await fileService.createFile({
            contents,
            fileMemo: "integration: info plain",
        });

        const info = await fileService.getFileInfo(fileId);

        expect(info.fileId).toBe(fileId.toString());
        expect(info.fileMemo).toBe("integration: info plain");
        // Size is plain number (not SDK's Long).
        expect(typeof info.size).toBe("number");
        expect(info.size).toBe(Buffer.from(contents, "utf8").byteLength);
        expect(info.isDeleted).toBe(false);
        // Operator-owned defaults ⇒ keys populated.
        expect(info.keys).not.toBeNull();
    });

    it("projects expirationTime to an ISO-8601 string", async () => {
        const { fileId } = await fileService.createFile({
            contents: "with expiration",
        });

        const info = await fileService.getFileInfo(fileId);

        expect(info.expirationTime).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
    });

    it("reports isDeleted: true after deletion (metadata is preserved)", async () => {
        const { fileId } = await fileService.createFile({
            contents: "delete me",
            fileMemo: "was here",
        });

        await fileService.deleteFile({ fileId });

        const info = await fileService.getFileInfo(fileId);
        expect(info.isDeleted).toBe(true);
        expect(info.size).toBe(0);
        // Memo is preserved on deleted entities.
        expect(info.fileMemo).toBe("was here");
    });

    it("exposes the file's keys as-is for a custom-keyed file", async () => {
        const customKey = PrivateKey.generateED25519();

        const { fileId } = await fileService.createFile({
            contents: "keyed",
            keys: [customKey.publicKey],
            // Every key assigned to a new file must sign FileCreate.
            additionalSigners: [customKey],
        });

        const info = await fileService.getFileInfo(fileId);
        expect(info.keys).not.toBeNull();
    });

    it("throws when the file does not exist", async () => {
        await expect(
            fileService.getFileInfo("0.0.999999999"),
        ).rejects.toThrow();
    });
});
