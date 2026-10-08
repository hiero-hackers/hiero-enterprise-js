import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AccountId, Hbar, TransactionId } from "@hiero-ledger/sdk";
import { QueryExecutor } from "../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../utils/mock-context.js";
import { HieroError } from "../../../../src/errors/index.js";
import {
    HieroContext,
    type IHieroContext,
} from "../../../../src/context/index.js";
import type { TransactionEvent } from "../../../../src/listeners/index.js";

interface MockQuery {
    setPaymentTransactionId: ReturnType<typeof vi.fn>;
    setMaxQueryPayment: ReturnType<typeof vi.fn>;
    setQueryPayment: ReturnType<typeof vi.fn>;
    setNodeAccountIds: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
}

function buildMockQuery(): MockQuery {
    return {
        setPaymentTransactionId: vi.fn().mockReturnThis(),
        setMaxQueryPayment: vi.fn().mockReturnThis(),
        setQueryPayment: vi.fn().mockReturnThis(),
        setNodeAccountIds: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue("query-result"),
    };
}

const SAMPLE_EVENT: TransactionEvent = {
    type: "NetworkVersionInfoQuery",
    serviceName: "NetworkService",
    methodName: "getNetworkVersionInfo",
    timestamp: new Date(0),
};

describe("QueryExecutor", () => {
    let context: IHieroContext;
    let executor: QueryExecutor;
    let query: MockQuery;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        executor = new QueryExecutor(context);
        query = buildMockQuery();
    });

    describe("applyBaseOptions", () => {
        it("does not call any setters when options are empty", async () => {
            await executor.run(query as never, {}, SAMPLE_EVENT);

            expect(query.setPaymentTransactionId).not.toHaveBeenCalled();
            expect(query.setMaxQueryPayment).not.toHaveBeenCalled();
            expect(query.setQueryPayment).not.toHaveBeenCalled();
            expect(query.setNodeAccountIds).not.toHaveBeenCalled();
        });

        it("sets a payment transaction ID generated from a string payer", async () => {
            await executor.run(
                query as never,
                { payerAccountId: "0.0.500" },
                SAMPLE_EVENT,
            );

            expect(query.setPaymentTransactionId).toHaveBeenCalledTimes(1);
            const txId = query.setPaymentTransactionId.mock
                .calls[0][0] as TransactionId;
            expect(txId).toBeInstanceOf(TransactionId);
            expect(txId.accountId?.toString()).toBe("0.0.500");
        });

        it("sets a payment transaction ID generated from an AccountId payer", async () => {
            const payer = AccountId.fromString("0.0.501");

            await executor.run(
                query as never,
                { payerAccountId: payer },
                SAMPLE_EVENT,
            );

            const txId = query.setPaymentTransactionId.mock
                .calls[0][0] as TransactionId;
            expect(txId.accountId?.toString()).toBe("0.0.501");
        });

        it("coerces a numeric maxQueryPayment into an Hbar", async () => {
            await executor.run(
                query as never,
                { maxQueryPayment: 2 },
                SAMPLE_EVENT,
            );

            const arg = query.setMaxQueryPayment.mock.calls[0][0] as Hbar;
            expect(arg).toBeInstanceOf(Hbar);
            expect(arg.toBigNumber().toNumber()).toBe(2);
        });

        it("passes an Hbar maxQueryPayment through unchanged", async () => {
            const fee = new Hbar(5);

            await executor.run(
                query as never,
                { maxQueryPayment: fee },
                SAMPLE_EVENT,
            );

            expect(query.setMaxQueryPayment).toHaveBeenCalledWith(fee);
        });

        it("coerces a numeric queryPayment into an Hbar", async () => {
            await executor.run(
                query as never,
                { queryPayment: 1 },
                SAMPLE_EVENT,
            );

            const arg = query.setQueryPayment.mock.calls[0][0] as Hbar;
            expect(arg).toBeInstanceOf(Hbar);
            expect(arg.toBigNumber().toNumber()).toBe(1);
        });

        it("converts each string node ID into an AccountId", async () => {
            await executor.run(
                query as never,
                { nodeAccountIds: ["0.0.3", "0.0.4"] },
                SAMPLE_EVENT,
            );

            expect(query.setNodeAccountIds).toHaveBeenCalledTimes(1);
            const ids = query.setNodeAccountIds.mock.calls[0][0] as AccountId[];
            expect(ids).toHaveLength(2);
            expect(ids[0]).toBeInstanceOf(AccountId);
            expect(ids[0].toString()).toBe("0.0.3");
            expect(ids[1].toString()).toBe("0.0.4");
        });

        it("ignores an empty nodeAccountIds array", async () => {
            await executor.run(
                query as never,
                { nodeAccountIds: [] },
                SAMPLE_EVENT,
            );

            expect(query.setNodeAccountIds).not.toHaveBeenCalled();
        });
    });

    describe("lifecycle", () => {
        it("emits before, executes, then emits after with success status", async () => {
            const calls: string[] = [];
            (
                context.emitBeforeTransaction as ReturnType<typeof vi.fn>
            ).mockImplementation(() => {
                calls.push("before");
                return Promise.resolve();
            });
            query.execute.mockImplementation(() => {
                calls.push("execute");
                return Promise.resolve("query-result");
            });
            (
                context.emitAfterTransaction as ReturnType<typeof vi.fn>
            ).mockImplementation(() => {
                calls.push("after");
                return Promise.resolve();
            });

            const result = await executor.run(query as never, {}, SAMPLE_EVENT);

            expect(calls).toEqual(["before", "execute", "after"]);
            expect(result).toBe("query-result");
        });

        it("forwards the event metadata to before emit unchanged", async () => {
            await executor.run(query as never, {}, SAMPLE_EVENT);

            expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
                SAMPLE_EVENT,
            );
        });

        it("enriches the after event with SUCCESS status and duration", async () => {
            await executor.run(query as never, {}, SAMPLE_EVENT);

            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: SAMPLE_EVENT.type,
                    serviceName: SAMPLE_EVENT.serviceName,
                    methodName: SAMPLE_EVENT.methodName,
                    status: "SUCCESS",
                    durationMs: expect.any(Number),
                }),
            );
        });

        it("returns the query's resolved value", async () => {
            query.execute.mockResolvedValueOnce({ custom: "payload" });

            const result = await executor.run(query as never, {}, SAMPLE_EVENT);

            expect(result).toEqual({ custom: "payload" });
        });
    });

    describe("error handling", () => {
        it("normalises a thrown error into HieroError with the service.method context", async () => {
            const original = new Error("query failed");
            query.execute.mockRejectedValueOnce(original);

            await expect(
                executor.run(query as never, {}, SAMPLE_EVENT),
            ).rejects.toBeInstanceOf(HieroError);

            query.execute.mockRejectedValueOnce(original);
            await expect(
                executor.run(query as never, {}, SAMPLE_EVENT),
            ).rejects.toMatchObject({
                context: "NetworkService.getNetworkVersionInfo",
                cause: original,
            });
        });

        it("emits an after event carrying the original error before throwing", async () => {
            const original = new Error("boom");
            query.execute.mockRejectedValueOnce(original);

            await expect(
                executor.run(query as never, {}, SAMPLE_EVENT),
            ).rejects.toThrow();

            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: original,
                    durationMs: expect.any(Number),
                }),
            );
        });

        it("wraps a non-Error rejection into an Error for the after event", async () => {
            query.execute.mockRejectedValueOnce("string failure");

            await expect(
                executor.run(query as never, {}, SAMPLE_EVENT),
            ).rejects.toThrow();

            const afterCall = (
                context.emitAfterTransaction as ReturnType<typeof vi.fn>
            ).mock.calls[0][0];
            expect(afterCall.error).toBeInstanceOf(Error);
            expect((afterCall.error as Error).message).toBe("string failure");
        });
    });

    describe("run() — listener failures", () => {
        let ctx: HieroContext;
        let emitWarning: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.2",
                operatorKeyType: "der",
                operatorKey:
                    "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
            });
            ctx.addTransactionListener({
                onAfterTransaction: () => {
                    throw new Error("listener bug");
                },
            });
            emitWarning = vi
                .spyOn(process, "emitWarning")
                .mockImplementation(() => undefined);
        });

        afterEach(() => {
            emitWarning.mockRestore();
            ctx.close();
        });

        it("emits the after-event once when emitting the success event fails", async () => {
            vi.mocked(context.emitAfterTransaction).mockRejectedValueOnce(
                new Error("listener bug"),
            );

            await executor
                .run(query as never, {}, SAMPLE_EVENT)
                .catch(() => undefined);

            expect(context.emitAfterTransaction).toHaveBeenCalledTimes(1);
        });

        it("returns the result when an onAfterTransaction listener throws", async () => {
            await expect(
                new QueryExecutor(ctx).run(query as never, {}, SAMPLE_EVENT),
            ).resolves.toBe("query-result");
        });

        it("still runs when an onBeforeTransaction listener throws", async () => {
            ctx.addTransactionListener({
                onBeforeTransaction: () => {
                    throw new Error("metrics backend down");
                },
            });

            const result = await new QueryExecutor(ctx).run(
                query as never,
                {},
                SAMPLE_EVENT,
            );

            expect(result).toBe("query-result");
        });

        it("keeps the original error when an onAfterTransaction listener throws", async () => {
            const original = new Error("query exploded");
            query.execute.mockRejectedValueOnce(original);

            await expect(
                new QueryExecutor(ctx).run(query as never, {}, SAMPLE_EVENT),
            ).rejects.toMatchObject({ cause: original });
        });
    });
});
