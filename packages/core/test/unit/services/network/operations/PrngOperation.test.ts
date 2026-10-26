import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    PrngTransaction,
    TransactionRecordQuery,
    TransactionId,
    TransactionResponse,
} from "@hiero-ledger/sdk";
import { NetworkService } from "../../../../../src/services/network/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { HieroErrorCodes } from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/MockContext.js";

// Builds real SDK transactions; the executor and the record lookup, the
// network steps, are stubbed.

const transactionId = TransactionId.fromString("0.0.2@1700000000.000000000");

const result = {
    response: new TransactionResponse({
        nodeId: AccountId.fromString("0.0.3"),
        transactionHash: new Uint8Array(),
        transactionId,
    }),
    receipt: {},
    status: "SUCCESS",
    transactionId: transactionId.toString(),
};

describe("PrngOperation (via NetworkService.generateRandom)", () => {
    let service: NetworkService;
    let run: ReturnType<typeof vi.spyOn>;
    let getRecord: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as PrngTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(result as never);
        getRecord = vi.spyOn(TransactionRecordQuery.prototype, "execute");
        service = new NetworkService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the number from the record when a range is given", async () => {
        getRecord.mockResolvedValue({
            prngNumber: 42,
            prngBytes: null,
        } as never);

        const random = await service.generateRandom({ range: 100 });

        expect(sentTx()).toBeInstanceOf(PrngTransaction);
        expect(sentTx().range).toBe(100);
        expect(random).toMatchObject({
            prngNumber: 42,
            prngBytes: null,
            transactionId: transactionId.toString(),
        });
    });

    it("returns the bytes from the record without a range", async () => {
        const bytes = new Uint8Array(48).fill(7);
        getRecord.mockResolvedValue({
            prngNumber: null,
            prngBytes: bytes,
        } as never);

        const random = await service.generateRandom();

        expect(sentTx().range).toBeNull();
        expect(random.prngBytes).toBe(bytes);
        expect(random.prngNumber).toBeNull();
    });

    it("reports the transaction to the executor with its event", async () => {
        getRecord.mockResolvedValue({
            prngNumber: 1,
            prngBytes: null,
        } as never);

        await service.generateRandom({ range: 2, transactionMemo: "roll" });

        expect(run).toHaveBeenCalledWith(
            expect.any(PrngTransaction),
            expect.objectContaining({ transactionMemo: "roll" }),
            expect.objectContaining({
                type: "UtilPrng",
                serviceName: "NetworkService",
                methodName: "generateRandom",
            }),
        );
    });

    it("throws RESULT_MAPPING_FAILED when the record lookup fails after consensus", async () => {
        getRecord.mockRejectedValue(new Error("record not found"));

        await expect(
            service.generateRandom({ range: 10 }),
        ).rejects.toMatchObject({
            code: HieroErrorCodes.ResultMappingFailed,
            context: "NetworkService.generateRandom",
            transactionId: transactionId.toString(),
        });
    });

    it.each([0, -1, 1.5, 2_147_483_648, NaN])(
        "rejects range %s with INPUT_INVALID before submitting",
        async (range) => {
            await expect(
                service.generateRandom({ range }),
            ).rejects.toMatchObject({
                code: HieroErrorCodes.InputInvalid,
                message: expect.stringContaining("range must be an integer"),
            });
            expect(run).not.toHaveBeenCalled();
        },
    );
});
