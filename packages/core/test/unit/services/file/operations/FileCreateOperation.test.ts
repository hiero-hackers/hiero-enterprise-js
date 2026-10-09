import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    FileAppendTransaction,
    FileCreateTransaction,
    FileId,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { fileId: FileId.fromString("0.0.555") },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("FileCreateOperation (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor on the given call. */
    const sentTx = (call = 0) => run.mock.calls.at(call)?.[0];

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        context = createMockContext();
        service = new FileService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createFile", () => {
        it("builds a FileCreateTransaction with the operator's key by default", async () => {
            const { fileId } = await service.createFile({
                contents: "hello",
            });

            expect(fileId.toString()).toBe("0.0.555");
            const tx = sentTx() as FileCreateTransaction;
            expect(tx).toBeInstanceOf(FileCreateTransaction);
            expect(tx.contents).toEqual(Buffer.from("hello"));
            expect(tx.keys).toEqual([context.operatorPublicKey]);
            const defaults = new FileCreateTransaction();
            expect(tx.fileMemo).toBe(defaults.fileMemo);
            // No append when contents fit in a single transaction.
            expect(run).toHaveBeenCalledTimes(1);
        });

        it("sets fileMemo, expirationTime and explicit keys", async () => {
            const key = PrivateKey.generateED25519().publicKey;
            const expirationTime = new Date("2099-01-01T00:00:00Z");

            await service.createFile({
                contents: new Uint8Array([1, 2, 3]),
                keys: [key],
                fileMemo: "greeting",
                expirationTime,
            });

            const tx = sentTx() as FileCreateTransaction;
            expect(tx.contents).toEqual(new Uint8Array([1, 2, 3]));
            expect(tx.keys).toEqual([key]);
            expect(tx.fileMemo).toBe("greeting");
            expect(tx.expirationTime.toDate()).toEqual(expirationTime);
        });

        it("keeps an empty keys array (unmodifiable file)", async () => {
            await service.createFile({ contents: "immutable", keys: [] });

            expect((sentTx() as FileCreateTransaction).keys).toEqual([]);
        });

        it("sends the FileCreate event", async () => {
            await service.createFile({
                contents: "x",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(FileCreateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "FileCreate",
                    serviceName: "FileService",
                    methodName: "createFile",
                }),
            );
        });

        it("chains a FileAppendTransaction when contents exceed the per-tx limit", async () => {
            // 4096 (single-tx limit) + 500 spillover.
            const large = Buffer.alloc(4596, 0x61);

            const { fileId } = await service.createFile({ contents: large });

            expect(fileId.toString()).toBe("0.0.555");
            expect(run).toHaveBeenCalledTimes(2);

            // Leading 4096 bytes went into the create.
            const createTx = sentTx(0) as FileCreateTransaction;
            expect(createTx.contents?.byteLength).toBe(4096);

            // Remainder went into the append, keyed by the new fileId.
            const appendTx = sentTx(1) as FileAppendTransaction;
            expect(appendTx).toBeInstanceOf(FileAppendTransaction);
            expect(appendTx.fileId?.toString()).toBe("0.0.555");
            expect(appendTx.contents?.byteLength).toBe(500);
        });

        it("splits a string payload at 4096 UTF-8 bytes for the follow-up append", async () => {
            const large = "x".repeat(4200); // 4200 single-byte chars > 4096

            await service.createFile({ contents: large });

            const createTx = sentTx(0) as FileCreateTransaction;
            expect(createTx.contents?.byteLength).toBe(4096);
            const appendTx = sentTx(1) as FileAppendTransaction;
            expect(appendTx.contents?.byteLength).toBe(4200 - 4096);
        });

        it("propagates validator errors before building a transaction", async () => {
            // Every field is optional today, but we still exercise the
            // validator hookup with a reject-all stub.
            const rejectAll = vi
                .spyOn(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (service as any).createOperation.validator,
                    "validate",
                )
                .mockImplementationOnce(() => {
                    throw new Error("stub validation error");
                });

            await expect(service.createFile({ contents: "x" })).rejects.toThrow(
                /stub validation error/,
            );

            expect(rejectAll).toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
        });

        it("creates an empty file when contents is omitted (SDK parity)", async () => {
            const { fileId } = await service.createFile({});

            expect(fileId.toString()).toBe("0.0.555");
            const tx = sentTx() as FileCreateTransaction;
            expect(tx.contents).toEqual(new FileCreateTransaction().contents);
            // Facade still defaults keys so the file is modifiable.
            expect(tx.keys).toEqual([context.operatorPublicKey]);
            // No append — nothing to chunk.
            expect(run).toHaveBeenCalledTimes(1);
        });

        it("creates an empty operator-modifiable file when called with no arguments", async () => {
            const { fileId } = await service.createFile();

            expect(fileId.toString()).toBe("0.0.555");
            const tx = sentTx() as FileCreateTransaction;
            expect(tx.contents).toEqual(new FileCreateTransaction().contents);
            expect(tx.keys).toEqual([context.operatorPublicKey]);
            expect(run).toHaveBeenCalledTimes(1);
        });

        it("surfaces the created fileId when the follow-up append fails", async () => {
            // FileCreate succeeded, but the FileAppend for the tail chunk
            // fails. The fileId must be on the thrown HieroError so the
            // caller can retry the append or delete the partial file.
            run.mockResolvedValueOnce(receipt as never).mockRejectedValueOnce(
                new Error("append boom"),
            );

            const large = Buffer.alloc(4200, 0x61); // > 4096 → triggers append

            const promise = service.createFile({ contents: large });

            await expect(promise).rejects.toThrow(HieroError);
            await expect(promise).rejects.toMatchObject({
                code: HieroErrorCodes.SdkError,
                context: "FileService.createFile",
                fileId: "0.0.555",
                message: expect.stringMatching(
                    /File 0\.0\.555 was created, but appending the remainder/,
                ),
            });
            // The underlying append failure is kept as `cause`.
            await expect(promise).rejects.toHaveProperty(
                "cause",
                expect.objectContaining({ message: "append boom" }),
            );

            // FileCreate ran, then FileAppend was attempted.
            expect(sentTx(0)).toBeInstanceOf(FileCreateTransaction);
            expect(sentTx(1)).toBeInstanceOf(FileAppendTransaction);
        });
    });
});
