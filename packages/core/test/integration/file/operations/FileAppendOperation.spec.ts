import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey, FileContentsQuery, type Client } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { FileService } from "../../../../src/services/index.js";

describe("FileAppendOperation", () => {
    let client: Client;
    let fileService: FileService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        fileService = new FileService(ctx);
    });

    it("appends bytes to an existing file", async () => {
        const initial = "part one:";
        const { fileId } = await fileService.createFile({ contents: initial });

        await fileService.appendToFile({
            fileId,
            contents: " part two",
        });

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(Buffer.from(bytes).toString("utf8")).toBe("part one: part two");
    });

    it("auto-chunks a large payload across many appends", async () => {
        const { fileId } = await fileService.createFile({
            contents: "header:",
        });

        // 20 KiB — the SDK will sub-chunk this internally against
        // maxChunks * chunkSize.
        const largePayload = Buffer.alloc(20 * 1024, 0x62); // "bbbb..."
        await fileService.appendToFile({
            fileId,
            contents: largePayload,
        });

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(bytes.byteLength).toBe(
            Buffer.from("header:", "utf8").byteLength + largePayload.byteLength,
        );
    });

    it("requires the file's key to sign the append", async () => {
        const customKey = PrivateKey.generateED25519();

        const { fileId } = await fileService.createFile({
            contents: "signed file",
            keys: [customKey.publicKey],
            // Every key assigned to a new file must sign FileCreate.
            additionalSigners: [customKey],
        });

        // Without customKey the append fails.
        await expect(
            fileService.appendToFile({
                fileId,
                contents: " unauthorised tail",
            }),
        ).rejects.toThrow();

        // With customKey it succeeds.
        await fileService.appendToFile({
            fileId,
            contents: " authorised tail",
            additionalSigners: [customKey],
        });

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(Buffer.from(bytes).toString("utf8")).toBe(
            "signed file authorised tail",
        );
    });

    it("rejects an append to a non-existent file", async () => {
        await expect(
            fileService.appendToFile({
                fileId: "0.0.999999999",
                contents: "no such file",
            }),
        ).rejects.toThrow();
    });
});
