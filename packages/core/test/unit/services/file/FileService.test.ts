import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionId } from "@hiero-ledger/sdk";
import { FileService } from "../../../../src/services/file/index.js";
import { HieroError, HieroErrorCodes } from "../../../../src/errors/index.js";
import { createMockContext } from "../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../src/context/index.js";

describe("FileService", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new FileService(context);
    });

    describe("createFile with large contents", () => {
        it("wraps append failure in HieroError with fileId when create succeeds but append fails", async () => {
            // Create > 4 KiB payload to trigger split
            const largeContents = Buffer.alloc(5000, "x");

            const mockFileId = { toString: () => "0.0.12345" };
            vi.spyOn(
                service["createOperation"],
                "execute",
            ).mockResolvedValueOnce({
                fileId: mockFileId,
                status: "SUCCESS",
                transactionId: "0.0.2@1700000000.000",
            } as never);

            const appendError = new HieroError("Missing required signatures", {
                code: HieroErrorCodes.SdkError,
                sdkStatus: "INVALID_SIGNATURE",
                transactionId: "0.0.2@1234567890.000",
            });
            vi.spyOn(
                service["appendOperation"],
                "execute",
            ).mockRejectedValueOnce(appendError);

            const error = await service
                .createFile({ contents: largeContents })
                .catch((e) => e);

            expect(error).toBeInstanceOf(HieroError);
            expect(error.message).toContain("0.0.12345");
            expect(error.message).toContain("was created");
            expect(error.message).toContain(
                "appending the remainder of its contents failed",
            );
            expect(error.fileId).toBe("0.0.12345");
            expect(error.transactionId).toBe("0.0.2@1700000000.000");
            expect(error.code).toBe(HieroErrorCodes.SdkError);
            expect(error.context).toBe("FileService.createFile");
            expect(error.cause).toBe(appendError);
        });

        it("does not wrap error when contents fit in single transaction", async () => {
            const smallContents = Buffer.alloc(100, "x");

            const mockFileId = { toString: () => "0.0.12346" };

            const appendSpy = vi.spyOn(service["appendOperation"], "execute");
            vi.spyOn(
                service["createOperation"],
                "execute",
            ).mockResolvedValueOnce({
                fileId: mockFileId,
                status: "SUCCESS",
            } as never);

            const result = await service.createFile({
                contents: smallContents,
            });

            expect(result.fileId).toBe(mockFileId);
            expect(appendSpy).not.toHaveBeenCalled();
        });
    });

    describe("updateFile with large contents", () => {
        it("wraps append failure in HieroError with fileId when update succeeds but append fails", async () => {
            const largeContents = Buffer.alloc(5000, "y");
            const fileId = "0.0.67890";

            vi.spyOn(
                service["updateOperation"],
                "execute",
            ).mockResolvedValueOnce({
                status: "SUCCESS",
                transactionId: "0.0.3@9876543210.000",
            } as never);

            const appendError = new HieroError("Insufficient transaction fee", {
                code: HieroErrorCodes.SdkError,
                sdkStatus: "INSUFFICIENT_TX_FEE",
                transactionId: "0.0.2@1234567890.000",
            });
            vi.spyOn(
                service["appendOperation"],
                "execute",
            ).mockRejectedValueOnce(appendError);

            const error = await service
                .updateFile({ fileId, contents: largeContents })
                .catch((e) => e);

            expect(error).toBeInstanceOf(HieroError);
            expect(error.message).toContain(fileId);
            expect(error.message).toContain("was updated");
            expect(error.message).toContain(
                "appending the remainder of its contents failed",
            );
            expect(error.message).toContain(
                "so the file holds partial contents",
            );
            expect(error.fileId).toBe(fileId);
            expect(error.transactionId).toBe("0.0.3@9876543210.000");
            expect(error.code).toBe(HieroErrorCodes.SdkError);
            expect(error.context).toBe("FileService.updateFile");
            expect(error.cause).toBe(appendError);
        });

        it("does not wrap error when contents fit in single transaction", async () => {
            const smallContents = Buffer.alloc(100, "y");
            const fileId = "0.0.67891";

            const appendSpy = vi.spyOn(service["appendOperation"], "execute");
            vi.spyOn(
                service["updateOperation"],
                "execute",
            ).mockResolvedValueOnce({
                status: "SUCCESS",
            } as never);

            await service.updateFile({ fileId, contents: smallContents });

            expect(appendSpy).not.toHaveBeenCalled();
        });

        it("does not attempt append when contents is undefined", async () => {
            const fileId = "0.0.67892";

            const appendSpy = vi.spyOn(service["appendOperation"], "execute");
            vi.spyOn(
                service["updateOperation"],
                "execute",
            ).mockResolvedValueOnce({
                status: "SUCCESS",
            } as never);

            await service.updateFile({ fileId, fileMemo: "updated memo" });

            expect(appendSpy).not.toHaveBeenCalled();
        });
    });

    describe("content splitting", () => {
        const fileId = { toString: () => "0.0.12347" };

        it("sends exactly 4096 bytes in the create without an append", async () => {
            const contents = Buffer.alloc(4096, "a");
            const create = vi
                .spyOn(service["createOperation"], "execute")
                .mockResolvedValueOnce({ fileId } as never);
            const append = vi.spyOn(service["appendOperation"], "execute");

            await service.createFile({ contents });

            expect(create.mock.calls[0][0].contents).toBe(contents);
            expect(append).not.toHaveBeenCalled();
        });

        it("appends the remainder of 4097 bytes after the create", async () => {
            const contents = Buffer.alloc(4097, "b");
            const create = vi
                .spyOn(service["createOperation"], "execute")
                .mockResolvedValueOnce({ fileId } as never);
            const append = vi
                .spyOn(service["appendOperation"], "execute")
                .mockResolvedValueOnce({} as never);

            await service.createFile({ contents });

            const head = create.mock.calls[0][0].contents as Uint8Array;
            const appended = append.mock.calls[0][0];
            expect(head.byteLength).toBe(4096);
            expect(appended.fileId).toBe(fileId);
            expect((appended.contents as Uint8Array).byteLength).toBe(1);
        });

        it("splits a string by its UTF-8 byte length", async () => {
            // 2049 two-byte characters: 4098 bytes
            const contents = "é".repeat(2049);
            const update = vi
                .spyOn(service["updateOperation"], "execute")
                .mockResolvedValueOnce({} as never);
            const append = vi
                .spyOn(service["appendOperation"], "execute")
                .mockResolvedValueOnce({} as never);

            await service.updateFile({ fileId: "0.0.12347", contents });

            const head = update.mock.calls[0][0].contents as Uint8Array;
            const tail = append.mock.calls[0][0].contents as Uint8Array;
            expect(head.byteLength).toBe(4096);
            expect(tail.byteLength).toBe(2);
            expect(Buffer.concat([head, tail]).toString("utf8")).toBe(contents);
        });
    });

    describe("payer and transactionId with large contents", () => {
        const fileId = { toString: () => "0.0.12347" };
        const transactionId = "0.0.5@1700000000.000000123";

        it("submits the create under the ID and the append as the same payer only", async () => {
            const create = vi
                .spyOn(service["createOperation"], "execute")
                .mockResolvedValueOnce({ fileId } as never);
            const append = vi
                .spyOn(service["appendOperation"], "execute")
                .mockResolvedValueOnce({} as never);

            await service.createFile({
                contents: Buffer.alloc(4097),
                transactionId,
            });

            expect(create.mock.calls[0][0].transactionId).toBe(transactionId);
            // The create's own ID again would be a duplicate transaction.
            expect(append.mock.calls[0][0].transactionId).toBeUndefined();
            expect(append.mock.calls[0][0].payer).toBe("0.0.5");
        });

        it("keeps the payer for the append after an update", async () => {
            vi.spyOn(
                service["updateOperation"],
                "execute",
            ).mockResolvedValueOnce({} as never);
            const append = vi
                .spyOn(service["appendOperation"], "execute")
                .mockResolvedValueOnce({} as never);

            await service.updateFile({
                fileId: "0.0.12347",
                contents: Buffer.alloc(4097),
                transactionId: TransactionId.fromString(transactionId),
            });

            expect(append.mock.calls[0][0].payer).toBe("0.0.5");
        });

        it("passes a payer through to the append", async () => {
            vi.spyOn(
                service["createOperation"],
                "execute",
            ).mockResolvedValueOnce({ fileId } as never);
            const append = vi
                .spyOn(service["appendOperation"], "execute")
                .mockResolvedValueOnce({} as never);

            await service.createFile({
                contents: Buffer.alloc(4097),
                payer: "0.0.5",
            });

            expect(append.mock.calls[0][0].payer).toBe("0.0.5");
        });

        it("leaves the append's payer unset without either", async () => {
            vi.spyOn(
                service["createOperation"],
                "execute",
            ).mockResolvedValueOnce({ fileId } as never);
            const append = vi
                .spyOn(service["appendOperation"], "execute")
                .mockResolvedValueOnce({} as never);

            await service.createFile({ contents: Buffer.alloc(4097) });

            expect(append.mock.calls[0][0].transactionId).toBeUndefined();
            expect(append.mock.calls[0][0].payer).toBeUndefined();
        });
    });

    describe("scheduleUpdateFile", () => {
        it("schedules contents that fit in one transaction", async () => {
            const contents = Buffer.alloc(4096, "c");
            const schedule = vi
                .spyOn(service["updateOperation"], "schedule")
                .mockResolvedValueOnce({} as never);

            await service.scheduleUpdateFile({ fileId: "0.0.12348", contents });

            expect(schedule.mock.calls[0][0].contents).toBe(contents);
        });

        it("rejects contents larger than one transaction before scheduling", async () => {
            const schedule = vi.spyOn(service["updateOperation"], "schedule");

            await expect(
                service.scheduleUpdateFile({
                    fileId: "0.0.12348",
                    contents: Buffer.alloc(4097, "c"),
                }),
            ).rejects.toMatchObject({
                name: "HieroError",
                code: HieroErrorCodes.InputInvalid,
                context: "FileService.scheduleUpdateFile",
            });
            expect(schedule).not.toHaveBeenCalled();
        });
    });

    describe("error normalization", () => {
        it("preserves existing HieroError properties when wrapping append failure", async () => {
            const largeContents = Buffer.alloc(5000, "z");
            const fileId = "0.0.99999";

            vi.spyOn(
                service["updateOperation"],
                "execute",
            ).mockResolvedValueOnce({
                status: "SUCCESS",
                transactionId: "0.0.3@5555555555.000",
            } as never);

            const appendError = new HieroError("INVALID_SIGNATURE", {
                code: HieroErrorCodes.SdkError,
                sdkStatus: "INVALID_SIGNATURE",
                transactionId: "0.0.2@1234567890.000",
            });

            vi.spyOn(
                service["appendOperation"],
                "execute",
            ).mockRejectedValueOnce(appendError);

            await expect(
                service.updateFile({ fileId, contents: largeContents }),
            ).rejects.toMatchObject({
                fileId,
                sdkStatus: "INVALID_SIGNATURE",
                transactionId: "0.0.3@5555555555.000",
                code: HieroErrorCodes.SdkError,
                cause: appendError,
            });
        });
    });
});
