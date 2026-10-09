import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    FileId,
    FileInfoQuery as SdkFileInfoQuery,
    KeyList,
    LedgerId,
    Long,
    PrivateKey,
    Query,
    Timestamp,
    type FileInfo,
} from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data built from real SDK values, because FileInfo
// has no public constructor.

const keys = new KeyList([PrivateKey.generateED25519().publicKey]);

function fileInfo(overrides: Partial<FileInfo> = {}): FileInfo {
    return {
        fileId: FileId.fromString("0.0.555"),
        size: Long.fromNumber(1024),
        expirationTime: Timestamp.fromDate(
            new Date("2099-01-02T03:04:05.000Z"),
        ),
        isDeleted: false,
        keys,
        fileMemo: "demo file",
        ledgerId: LedgerId.MAINNET,
        ...overrides,
    } as FileInfo;
}

describe("FileInfoQuery (via FileService)", () => {
    let service: FileService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = (call = 0) =>
        execute.mock.contexts.at(call) as SdkFileInfoQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(fileInfo());
        service = new FileService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("queries the file and projects its info to a plain object", async () => {
        const info = await service.getFileInfo("0.0.555");

        expect(sentQuery()).toBeInstanceOf(SdkFileInfoQuery);
        expect(sentQuery().fileId?.toString()).toBe("0.0.555");
        expect(info).toEqual({
            fileId: "0.0.555",
            size: 1024,
            expirationTime: "2099-01-02T03:04:05.000Z",
            isDeleted: false,
            // Keys pass through as the original SDK reference.
            keys,
            fileMemo: "demo file",
            ledgerId: "mainnet",
        });
        expect(info.keys).toBe(keys);
    });

    it("accepts a FileId instance", async () => {
        const fileId = FileId.fromString("0.0.999");
        execute.mockResolvedValueOnce(fileInfo({ fileId }));

        const info = await service.getFileInfo(fileId);

        expect(sentQuery().fileId?.toString()).toBe("0.0.999");
        expect(info.fileId).toBe("0.0.999");
    });

    it("returns null for optional fields the network leaves unset", async () => {
        execute.mockResolvedValueOnce(
            fileInfo({
                expirationTime: null,
                keys: null,
                ledgerId: null,
            } as unknown as Partial<FileInfo>),
        );

        const info = await service.getFileInfo("0.0.555");

        expect(info.expirationTime).toBeNull();
        expect(info.keys).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("reflects isDeleted when the file has been deleted", async () => {
        execute.mockResolvedValueOnce(
            fileInfo({ isDeleted: true, size: Long.ZERO }),
        );

        const info = await service.getFileInfo("0.0.555");

        expect(info.isDeleted).toBe(true);
        expect(info.size).toBe(0);
    });

    it("normalises network errors with the FileService.getFileInfo context", async () => {
        execute.mockRejectedValueOnce(new Error("boom from network"));

        await expect(service.getFileInfo("0.0.555")).rejects.toMatchObject({
            name: "HieroError",
            context: "FileService.getFileInfo",
            message: "boom from network",
        });
    });

    it("builds a new query for every call", async () => {
        await service.getFileInfo("0.0.1");
        await service.getFileInfo("0.0.2");

        expect(sentQuery(0)).not.toBe(sentQuery(1));
        expect(sentQuery(1).fileId?.toString()).toBe("0.0.2");
    });
});
