import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CustomFeeLimit,
    CustomFixedFee,
    Long,
    TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed. Chunking happens inside the SDK when the transaction is sent,
// so it is not exercised here.

const receipt = {
    receipt: {
        topicSequenceNumber: Long.fromNumber(1),
        topicRunningHash: new Uint8Array([1, 2, 3, 4]),
    },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TopicMessageSubmitOperation (via TopicService)", () => {
    let service: TopicService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TopicMessageSubmitTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TopicService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("submitMessage", () => {
        it("submits a string message and returns the receipt fields", async () => {
            const result = await service.submitMessage({
                topicId: "0.0.12345",
                message: "hello world",
            });

            // toBe(1) pins the Long → number conversion: an SDK Long would
            // fail identity equality with a primitive.
            expect(result.sequenceNumber).toBe(1);
            expect(result.status).toBe("SUCCESS");
            expect(result.runningHash).toEqual(new Uint8Array([1, 2, 3, 4]));

            const tx = sentTx();
            const defaults = new TopicMessageSubmitTransaction();
            expect(tx).toBeInstanceOf(TopicMessageSubmitTransaction);
            expect(tx.topicId?.toString()).toBe("0.0.12345");
            expect(tx.getMessage()).toEqual(Buffer.from("hello world"));
            expect(tx.getMaxChunks()).toBe(defaults.getMaxChunks());
            expect(tx.getChunkSize()).toBe(defaults.getChunkSize());
            expect(tx.getCustomFeeLimits()).toEqual(
                defaults.getCustomFeeLimits(),
            );
        });

        it("submits a Uint8Array message", async () => {
            const payload = new Uint8Array([10, 20, 30]);

            await service.submitMessage({
                topicId: "0.0.12345",
                message: payload,
            });

            expect(sentTx().getMessage()).toEqual(payload);
        });

        it("sets maxChunks when provided", async () => {
            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                maxChunks: 50,
            });

            expect(sentTx().getMaxChunks()).toBe(50);
        });

        it("sets chunkSize when provided", async () => {
            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                chunkSize: 2048,
            });

            expect(sentTx().getChunkSize()).toBe(2048);
        });

        it("sets customFeeLimits when provided (HIP-991)", async () => {
            const limit = new CustomFeeLimit()
                .setAccountId("0.0.555")
                .setFees([new CustomFixedFee().setAmount(10)]);

            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                customFeeLimits: [limit],
            });

            expect(sentTx().getCustomFeeLimits()).toEqual([limit]);
        });

        it("sends the TopicMessageSubmit event", async () => {
            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TopicMessageSubmitTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "TopicMessageSubmit",
                    serviceName: "TopicService",
                    methodName: "submitMessage",
                }),
            );
        });

        it("rejects an empty topicId before building a transaction", async () => {
            await expect(
                service.submitMessage({
                    topicId: "",
                    message: "x",
                }),
            ).rejects.toThrow(/topicId cannot be empty/);

            expect(run).not.toHaveBeenCalled();
        });

        it("rejects an empty message before building a transaction", async () => {
            await expect(
                service.submitMessage({
                    topicId: "0.0.12345",
                    message: "",
                }),
            ).rejects.toThrow(/message cannot be empty/);

            expect(run).not.toHaveBeenCalled();
        });
    });
});
