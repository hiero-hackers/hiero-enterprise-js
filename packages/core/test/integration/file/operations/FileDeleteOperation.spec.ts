import { describe, it, expect, beforeAll } from "vitest";
import {
    PrivateKey,
    FileInfoQuery,
    FileContentsQuery,
    type Client,
} from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { FileService } from "../../../../src/services/index.js";

describe("FileDeleteOperation", () => {
    let client: Client;
    let fileService: FileService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        fileService = new FileService(ctx);
    });

    it("deletes an operator-owned file", async () => {
        const { fileId } = await fileService.createFile({
            contents: "to be deleted",
        });

        await fileService.deleteFile({ fileId });

        // After deletion the entity remains but is marked deleted with
        // zero-byte contents.
        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.isDeleted).toBe(true);
        expect(info.size.toNumber()).toBe(0);

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(bytes.byteLength).toBe(0);
    });

    it("deletes a custom-keyed file when the key signs", async () => {
        const customKey = PrivateKey.generateED25519();
        const { fileId } = await fileService.createFile({
            contents: "signed delete",
            keys: [customKey.publicKey],
            // Every key assigned to a new file must sign FileCreate.
            additionalSigners: [customKey],
        });

        // Without the signature the delete fails.
        await expect(fileService.deleteFile({ fileId })).rejects.toThrow();

        // With the signature it succeeds.
        await fileService.deleteFile({
            fileId,
            additionalSigners: [customKey],
        });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.isDeleted).toBe(true);
    });

    it("rejects deletion of an unmodifiable file (keys: [])", async () => {
        const { fileId } = await fileService.createFile({
            contents: "immutable",
            keys: [],
        });

        await expect(fileService.deleteFile({ fileId })).rejects.toThrow();
    });

    it("rejects deletion of a non-existent file", async () => {
        await expect(
            fileService.deleteFile({ fileId: "0.0.999999999" }),
        ).rejects.toThrow();
    });
});
