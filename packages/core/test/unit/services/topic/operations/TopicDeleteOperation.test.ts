import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TopicDeleteTransaction } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TopicDeleteOperation (via TopicService)", () => {
    let service: TopicService;
    let run: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TopicService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("deleteTopic", () => {
        it("builds a TopicDeleteTransaction for the provided topicId", async () => {
            const result = await service.deleteTopic({ topicId: "0.0.12345" });

            expect(result).toBe(receipt);
            const tx = run.mock.calls[0][0] as TopicDeleteTransaction;
            expect(tx).toBeInstanceOf(TopicDeleteTransaction);
            expect(tx.topicId?.toString()).toBe("0.0.12345");
        });

        it("sends the TopicDelete event", async () => {
            await service.deleteTopic({
                topicId: "0.0.12345",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TopicDeleteTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "TopicDelete",
                    serviceName: "TopicService",
                    methodName: "deleteTopic",
                }),
            );
        });

        it("rejects a missing topicId before building a transaction", async () => {
            await expect(
                service.deleteTopic(
                    {} as unknown as Parameters<typeof service.deleteTopic>[0],
                ),
            ).rejects.toThrow(/topicId is required/);

            expect(run).not.toHaveBeenCalled();
        });
    });
});
