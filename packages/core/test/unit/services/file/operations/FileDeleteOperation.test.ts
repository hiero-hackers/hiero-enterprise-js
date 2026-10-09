import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileDeleteTransaction } from "@hiero-ledger/sdk";
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

describe("FileDeleteOperation (via FileService)", () => {
    let service: FileService;
    let run: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new FileService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("deleteFile", () => {
        it("builds a FileDeleteTransaction for the provided fileId", async () => {
            const result = await service.deleteFile({ fileId: "0.0.555" });

            expect(result).toBe(receipt);
            const tx = run.mock.calls[0][0] as FileDeleteTransaction;
            expect(tx).toBeInstanceOf(FileDeleteTransaction);
            expect(tx.fileId?.toString()).toBe("0.0.555");
        });

        it("sends the FileDelete event", async () => {
            await service.deleteFile({
                fileId: "0.0.555",
                transactionMemo: "delete memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(FileDeleteTransaction),
                expect.objectContaining({ transactionMemo: "delete memo" }),
                expect.objectContaining({
                    type: "FileDelete",
                    serviceName: "FileService",
                    methodName: "deleteFile",
                }),
            );
        });

        it("rejects a missing fileId before building a transaction", async () => {
            await expect(
                service.deleteFile(
                    {} as unknown as Parameters<typeof service.deleteFile>[0],
                ),
            ).rejects.toThrow(/fileId is required/);

            expect(run).not.toHaveBeenCalled();
        });
    });
});
