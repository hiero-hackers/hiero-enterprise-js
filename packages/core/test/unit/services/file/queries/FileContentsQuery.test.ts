import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    FileContentsQuery as SdkFileContentsQuery,
    FileId,
    Query,
} from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.

describe("FileContentsQuery (via FileService)", () => {
    let service: FileService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = (call = 0) =>
        execute.mock.contexts.at(call) as SdkFileContentsQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(new Uint8Array([1]));
        service = new FileService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("fetches raw file bytes and returns them unchanged", async () => {
        const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        execute.mockResolvedValueOnce(payload);

        const bytes = await service.getFileContents("0.0.555");

        expect(sentQuery()).toBeInstanceOf(SdkFileContentsQuery);
        expect(sentQuery().fileId?.toString()).toBe("0.0.555");
        expect(bytes).toBe(payload);
    });

    it("accepts a FileId instance", async () => {
        await service.getFileContents(FileId.fromString("0.0.999"));

        expect(sentQuery().fileId?.toString()).toBe("0.0.999");
    });

    it("returns an empty Uint8Array for a deleted file", async () => {
        execute.mockResolvedValueOnce(new Uint8Array());

        const bytes = await service.getFileContents("0.0.555");

        expect(bytes.byteLength).toBe(0);
    });

    it("normalises network errors with the FileService.getFileContents context", async () => {
        execute.mockRejectedValueOnce(new Error("boom from network"));

        await expect(service.getFileContents("0.0.555")).rejects.toMatchObject({
            name: "HieroError",
            context: "FileService.getFileContents",
            message: "boom from network",
        });
    });

    it("builds a new query for every call", async () => {
        await service.getFileContents("0.0.1");
        await service.getFileContents("0.0.2");

        expect(sentQuery(0)).not.toBe(sentQuery(1));
        expect(sentQuery(1).fileId?.toString()).toBe("0.0.2");
    });
});
