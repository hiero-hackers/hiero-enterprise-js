import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileAppendTransaction } from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("FileAppendOperation (via FileService)", () => {
    let service: FileService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as FileAppendTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new FileService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("appendToFile", () => {
        it("builds a FileAppendTransaction with fileId and contents", async () => {
            const result = await service.appendToFile({
                fileId: "0.0.555",
                contents: "chunk one",
            });

            expect(result).toBe(receipt);
            const tx = sentTx();
            expect(tx).toBeInstanceOf(FileAppendTransaction);
            expect(tx.fileId?.toString()).toBe("0.0.555");
            expect(tx.contents).toEqual(Buffer.from("chunk one"));
        });

        it("sends the FileAppend event", async () => {
            await service.appendToFile({
                fileId: "0.0.555",
                contents: "x",
                transactionMemo: "append memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(FileAppendTransaction),
                expect.objectContaining({ transactionMemo: "append memo" }),
                expect.objectContaining({
                    type: "FileAppend",
                    serviceName: "FileService",
                    methodName: "appendToFile",
                }),
            );
        });

        it("keeps the SDK chunking defaults when tuning fields are omitted", async () => {
            await service.appendToFile({ fileId: "0.0.555", contents: "x" });

            const tx = sentTx();
            const defaults = new FileAppendTransaction();
            expect(tx.maxChunks).toBe(defaults.maxChunks);
            expect(tx.chunkSize).toBe(defaults.chunkSize);
            expect(tx.chunkInterval).toBe(defaults.chunkInterval);
        });

        it("sets the optional chunk-tuning fields", async () => {
            await service.appendToFile({
                fileId: "0.0.555",
                contents: new Uint8Array([1, 2, 3]),
                maxChunks: 30,
                chunkSize: 2048,
                chunkInterval: 25,
            });

            const tx = sentTx();
            expect(tx.contents).toEqual(new Uint8Array([1, 2, 3]));
            expect(tx.maxChunks).toBe(30);
            expect(tx.chunkSize).toBe(2048);
            expect(tx.chunkInterval).toBe(25);
        });

        it("rejects an empty fileId before building a transaction", async () => {
            await expect(
                service.appendToFile({
                    fileId: "",
                    contents: "x",
                }),
            ).rejects.toThrow(/fileId cannot be empty/);

            expect(run).not.toHaveBeenCalled();
        });

        it("rejects a zero/negative maxChunks before building a transaction", async () => {
            await expect(
                service.appendToFile({
                    fileId: "0.0.555",
                    contents: "x",
                    maxChunks: 0,
                }),
            ).rejects.toThrow(/maxChunks must be a positive integer/);

            expect(run).not.toHaveBeenCalled();
        });
    });
});
