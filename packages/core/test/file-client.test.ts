import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { FileClient } from "../src/services/file-client.js";
import {
    FileCreateTransaction,
    FileContentsQuery,
    FileUpdateTransaction,
    FileDeleteTransaction,
    FileAppendTransaction,
    FileInfoQuery,
} from "@hashgraph/sdk";

vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    const mockTx = {
        setContents: vi.fn().mockReturnThis(),
        setExpirationTime: vi.fn().mockReturnThis(),
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890.000000000" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                fileId: { toString: () => "0.0.999" },
            }),
        }),
    };

    const mockContentsQuery = {
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };

    const mockInfoQuery = {
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            isDeleted: true,
            size: { toNumber: () => 1024 },
            expirationTime: { toDate: () => new Date("2030-01-01T00:00:00Z") },
        }),
    };

    return {
        ...actual,
        FileCreateTransaction: vi.fn(() => ({ ...mockTx })),
        FileAppendTransaction: vi.fn(() => ({ ...mockTx })),
        FileUpdateTransaction: vi.fn(() => ({ ...mockTx })),
        FileDeleteTransaction: vi.fn(() => ({ ...mockTx })),
        FileContentsQuery: vi.fn(() => ({ ...mockContentsQuery })),
        FileInfoQuery: vi.fn(() => ({ ...mockInfoQuery })),
    };
});

describe("FileClient", () => {
    let context: HieroContext;
    let client: FileClient;

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208", // Dummy ED25519 DER
        });
        client = new FileClient(context);
    });

    describe("createFile", () => {
        it("creates a file under 4KB without chunking", async () => {
            const contents = new Uint8Array(100); // 100 bytes
            const expires = new Date();

            const fileId = await client.createFile(contents, expires);

            expect(fileId).toBe("0.0.999");

            const createMock = vi.mocked(FileCreateTransaction).mock.results[0]
                .value;
            expect(createMock.setContents).toHaveBeenCalledWith(contents);
            expect(createMock.setExpirationTime).toHaveBeenCalledWith(expires);
            expect(createMock.execute).toHaveBeenCalledWith(context.client);

            expect(FileAppendTransaction).not.toHaveBeenCalled();
        });

        it("creates a file over 4KB using chunking", async () => {
            const contents = new Uint8Array(5000); // Exceeds 4096 bytes

            await client.createFile(contents);

            // Create step
            const createMock = vi.mocked(FileCreateTransaction).mock.results[0]
                .value;
            expect(createMock.setContents).toHaveBeenCalledWith(
                contents.slice(0, 4096),
            );

            // Append step
            expect(FileAppendTransaction).toHaveBeenCalledTimes(1);
            const appendMock = vi.mocked(FileAppendTransaction).mock.results[0]
                .value;
            expect(appendMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(appendMock.setContents).toHaveBeenCalledWith(
                contents.slice(4096),
            );
            expect(appendMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("readFile", () => {
        it("reads file contents", async () => {
            const contents = await client.readFile("0.0.999");

            expect(contents).toEqual(new Uint8Array([1, 2, 3]));

            const queryMock =
                vi.mocked(FileContentsQuery).mock.results[0].value;
            expect(queryMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(queryMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("updateFile", () => {
        it("updates file contents", async () => {
            const contents = new Uint8Array([4, 5, 6]);
            await client.updateFile("0.0.999", contents);

            const txMock = vi.mocked(FileUpdateTransaction).mock.results[0]
                .value;
            expect(txMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setContents).toHaveBeenCalledWith(contents);
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("deleteFile", () => {
        it("deletes a file", async () => {
            await client.deleteFile("0.0.999");

            const txMock = vi.mocked(FileDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("updateExpirationTime", () => {
        it("updates the expiration time", async () => {
            const date = new Date("2030-01-01T00:00:00Z");
            await client.updateExpirationTime("0.0.999", date);

            const txMock = vi.mocked(FileUpdateTransaction).mock.results[0]
                .value;
            expect(txMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setExpirationTime).toHaveBeenCalledWith(date);
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("isDeleted", () => {
        it("checks if file is deleted", async () => {
            const result = await client.isDeleted("0.0.999");
            expect(result).toBe(true);

            const queryMock = vi.mocked(FileInfoQuery).mock.results[0].value;
            expect(queryMock.setFileId).toHaveBeenCalledWith("0.0.999");
        });
    });

    describe("getSize", () => {
        it("gets file size", async () => {
            const result = await client.getSize("0.0.999");
            expect(result).toBe(1024);

            const queryMock = vi.mocked(FileInfoQuery).mock.results[0].value;
            expect(queryMock.setFileId).toHaveBeenCalledWith("0.0.999");
        });
    });

    describe("getExpirationTime", () => {
        it("gets file expiration time", async () => {
            const result = await client.getExpirationTime("0.0.999");
            expect(result).toEqual(new Date("2030-01-01T00:00:00Z"));

            const queryMock = vi.mocked(FileInfoQuery).mock.results[0].value;
            expect(queryMock.setFileId).toHaveBeenCalledWith("0.0.999");
        });
    });
});
