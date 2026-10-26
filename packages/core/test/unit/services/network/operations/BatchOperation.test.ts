import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    BatchTransaction,
    Hbar,
    PrivateKey,
    TransactionId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { NetworkService } from "../../../../../src/services/network/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; the executor, the network step, is stubbed.

const batchKey = PrivateKey.generateED25519();
const batchTransactionId = "0.0.2@1700000000.000000000";

/** A frozen inner transfer with a batch key, as `batchify` leaves it. */
function innerTransfer(validStart: number) {
    return new TransferTransaction()
        .addHbarTransfer("0.0.2", new Hbar(-1))
        .addHbarTransfer("0.0.3", new Hbar(1))
        .setTransactionId(
            TransactionId.fromString(`0.0.2@${validStart}.000000000`),
        )
        .setBatchKey(batchKey.publicKey)
        .freeze();
}

describe("BatchOperation (via NetworkService.submitBatch)", () => {
    let service: NetworkService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as BatchTransaction;

    beforeEach(() => {
        run = vi.spyOn(TransactionExecutor.prototype, "run").mockResolvedValue({
            receipt: {},
            status: "SUCCESS",
            transactionId: batchTransactionId,
        } as never);
        service = new NetworkService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends the inner transactions in one batch and returns their IDs", async () => {
        const transactions = [
            innerTransfer(1700000001),
            innerTransfer(1700000002),
        ];

        const result = await service.submitBatch({
            transactions,
            batchKeys: [batchKey],
        });

        expect(sentTx()).toBeInstanceOf(BatchTransaction);
        expect(sentTx().innerTransactions).toEqual(transactions);
        expect(result).toMatchObject({
            status: "SUCCESS",
            transactionId: batchTransactionId,
            innerTransactionIds: [
                "0.0.2@1700000001.000000000",
                "0.0.2@1700000002.000000000",
            ],
        });
    });

    it("signs the batch with the batch keys and any additional signers", async () => {
        const otherKey = PrivateKey.generateED25519();

        await service.submitBatch({
            transactions: [innerTransfer(1700000001)],
            batchKeys: [batchKey],
            additionalSigners: [otherKey],
            transactionMemo: "batch",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(BatchTransaction),
            expect.objectContaining({
                additionalSigners: [batchKey, otherKey],
                transactionMemo: "batch",
            }),
            expect.objectContaining({
                type: "AtomicBatch",
                serviceName: "NetworkService",
                methodName: "submitBatch",
            }),
        );
    });

    it("puts the inner transaction IDs on the error when the batch fails", async () => {
        run.mockRejectedValue(
            new HieroError("receipt for transaction failed", {
                code: HieroErrorCodes.SdkError,
                sdkStatus: "INNER_TRANSACTION_FAILED",
                context: "NetworkService.submitBatch",
                transactionId: batchTransactionId,
            }),
        );

        await expect(
            service.submitBatch({
                transactions: [innerTransfer(1700000001)],
                batchKeys: [batchKey],
            }),
        ).rejects.toMatchObject({
            code: HieroErrorCodes.SdkError,
            sdkStatus: "INNER_TRANSACTION_FAILED",
            context: "NetworkService.submitBatch",
            transactionId: batchTransactionId,
            innerTransactionIds: ["0.0.2@1700000001.000000000"],
        });
    });

    it("rejects invalid input with INPUT_INVALID before submitting", async () => {
        await expect(
            service.submitBatch({ transactions: [], batchKeys: [batchKey] }),
        ).rejects.toMatchObject({
            code: HieroErrorCodes.InputInvalid,
            innerTransactionIds: undefined,
        });

        expect(run).not.toHaveBeenCalled();
    });
});
