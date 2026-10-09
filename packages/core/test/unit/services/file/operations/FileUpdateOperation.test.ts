import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    FileAppendTransaction,
    FileUpdateTransaction,
    PrivateKey,
    ScheduleId,
} from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("FileUpdateOperation (via FileService)", () => {
    let service: FileService;
    let run: ReturnType<typeof vi.spyOn>;
    let scheduleRun: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor on the given call. */
    const sentTx = (call = 0) => run.mock.calls.at(call)?.[0];

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);
        service = new FileService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("updateFile", () => {
        it("builds a FileUpdateTransaction touching only changed fields", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: "renamed",
            });

            const tx = sentTx() as FileUpdateTransaction;
            const defaults = new FileUpdateTransaction();
            expect(tx).toBeInstanceOf(FileUpdateTransaction);
            expect(tx.fileId?.toString()).toBe("0.0.555");
            expect(tx.fileMemo).toBe("renamed");
            expect(tx.contents).toEqual(defaults.contents);
            expect(tx.keys).toEqual(defaults.keys);
            expect(tx.expirationTime).toEqual(defaults.expirationTime);
            expect(run).toHaveBeenCalledTimes(1);
        });

        it("writes the empty-string memo sentinel when fileMemo is null", async () => {
            // The operation routes `null` through `setFileMemo("")` — the
            // canonical Hedera clear sentinel.
            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: null,
            });

            expect((sentTx() as FileUpdateTransaction).fileMemo).toBe("");
        });

        it("sets a new keys list", async () => {
            const newKey = PrivateKey.generateED25519().publicKey;

            await service.updateFile({
                fileId: "0.0.555",
                keys: [newKey],
            });

            expect((sentTx() as FileUpdateTransaction).keys).toEqual([newKey]);
        });

        it("sets an empty keys list (rotate to unmodifiable)", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                keys: [],
            });

            expect((sentTx() as FileUpdateTransaction).keys).toEqual([]);
        });

        it("sets expirationTime", async () => {
            const expirationTime = new Date("2099-01-01T00:00:00Z");

            await service.updateFile({
                fileId: "0.0.555",
                expirationTime,
            });

            const tx = sentTx() as FileUpdateTransaction;
            expect(tx.expirationTime?.toDate()).toEqual(expirationTime);
        });

        it("sends contents-only updates that fit in a single tx without appending", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                contents: "small replacement",
            });

            expect((sentTx() as FileUpdateTransaction).contents).toEqual(
                Buffer.from("small replacement"),
            );
            expect(run).toHaveBeenCalledTimes(1);
        });

        it("chains a FileAppendTransaction when contents exceed the per-tx limit", async () => {
            const large = Buffer.alloc(4200, 0x62);

            await service.updateFile({
                fileId: "0.0.555",
                contents: large,
            });

            expect(run).toHaveBeenCalledTimes(2);
            const updateTx = sentTx(0) as FileUpdateTransaction;
            expect(updateTx.contents?.byteLength).toBe(4096);

            const appendTx = sentTx(1) as FileAppendTransaction;
            expect(appendTx).toBeInstanceOf(FileAppendTransaction);
            expect(appendTx.fileId?.toString()).toBe("0.0.555");
            expect(appendTx.contents?.byteLength).toBe(4200 - 4096);
        });

        it("sends the FileUpdate event", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: "x",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(FileUpdateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "FileUpdate",
                    serviceName: "FileService",
                    methodName: "updateFile",
                }),
            );
        });

        it("rejects a no-op update before building a transaction", async () => {
            await expect(
                service.updateFile({ fileId: "0.0.555" }),
            ).rejects.toThrow(
                /updateFile requires at least one field to change/,
            );

            expect(run).not.toHaveBeenCalled();
        });

        it("rejects expirationTime: null before building a transaction", async () => {
            await expect(
                service.updateFile({
                    fileId: "0.0.555",
                    expirationTime: null,
                } as unknown as Parameters<typeof service.updateFile>[0]),
            ).rejects.toThrow(/expirationTime cannot be null/);

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleUpdateFile", () => {
        it("schedules a FileUpdate and returns the scheduleId", async () => {
            const result = await service.scheduleUpdateFile(
                { fileId: "0.0.555", fileMemo: "renamed" },
                { scheduleMemo: "pending approval" },
            );

            expect(result.scheduleId.toString()).toBe("0.0.777");
            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(FileUpdateTransaction);
            expect((tx as FileUpdateTransaction).fileMemo).toBe("renamed");
            expect(scheduleOptions).toEqual({
                scheduleMemo: "pending approval",
            });
            expect(run).not.toHaveBeenCalled();
        });

        it("rejects contents exceeding the per-tx limit (no atomic chunked scheduling)", async () => {
            const large = Buffer.alloc(4097, 0x62);

            const promise = service.scheduleUpdateFile({
                fileId: "0.0.555",
                contents: large,
            });

            await expect(promise).rejects.toThrow(HieroError);
            await expect(promise).rejects.toMatchObject({
                code: HieroErrorCodes.SdkError,
                context: "FileService.scheduleUpdateFile",
                message: expect.stringMatching(
                    /scheduleUpdateFile does not support contents larger than/,
                ),
            });

            expect(scheduleRun).not.toHaveBeenCalled();
        });

        it("passes small contents through (fits in single transaction)", async () => {
            const result = await service.scheduleUpdateFile({
                fileId: "0.0.555",
                contents: "small update",
            });

            expect(result.scheduleId.toString()).toBe("0.0.777");
            const tx = scheduleRun.mock.calls[0][0] as FileUpdateTransaction;
            expect(tx.contents).toEqual(Buffer.from("small update"));
        });

        it("propagates validator errors before building a transaction", async () => {
            await expect(
                service.scheduleUpdateFile({ fileId: "0.0.555" }),
            ).rejects.toThrow(
                /updateFile requires at least one field to change/,
            );

            expect(scheduleRun).not.toHaveBeenCalled();
        });
    });
});
