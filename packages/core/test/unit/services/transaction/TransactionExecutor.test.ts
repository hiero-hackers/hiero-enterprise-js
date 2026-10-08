import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AccountId, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { TransactionExecutor } from "../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../utils/mock-context.js";
import { HieroError } from "../../../../src/errors/index.js";
import {
    buildMockTxBundle,
    reattachMockChain,
    type MockTxBundle,
} from "../../../utils/sdk-mocks.js";
import {
    HieroContext,
    type IHieroContext,
} from "../../../../src/context/index.js";
import type { TransactionEvent } from "../../../../src/listeners/index.js";

const SAMPLE_EVENT: TransactionEvent = {
    type: "TopicCreateTransaction",
    serviceName: "TopicService",
    methodName: "createTopic",
    timestamp: new Date(0),
};

describe("TransactionExecutor", () => {
    let context: IHieroContext;
    let executor: TransactionExecutor;
    let bundle: MockTxBundle;

    beforeEach(() => {
        vi.clearAllMocks();
        bundle = buildMockTxBundle();
        reattachMockChain(bundle);
        context = createMockContext();
        executor = new TransactionExecutor(context);
    });

    describe("run() — applyBaseOptions", () => {
        it("applies no setters when options are empty", async () => {
            await executor.run(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(bundle.tx.setMaxTransactionFee).not.toHaveBeenCalled();
            expect(bundle.tx.setTransactionMemo).not.toHaveBeenCalled();
            expect(
                bundle.tx.setTransactionValidDuration,
            ).not.toHaveBeenCalled();
            expect(bundle.tx.setRegenerateTransactionId).not.toHaveBeenCalled();
            expect(bundle.tx.setHighVolume).not.toHaveBeenCalled();
            expect(bundle.tx.setNodeAccountIds).not.toHaveBeenCalled();
        });

        it("forwards maxTransactionFee as-is (number)", async () => {
            await executor.run(
                bundle.tx as never,
                { maxTransactionFee: 5 },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setMaxTransactionFee).toHaveBeenCalledWith(5);
        });

        it("forwards maxTransactionFee as-is (Hbar)", async () => {
            const fee = new Hbar(2);
            await executor.run(
                bundle.tx as never,
                { maxTransactionFee: fee },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setMaxTransactionFee).toHaveBeenCalledWith(fee);
        });

        it("forwards transactionValidDuration", async () => {
            await executor.run(
                bundle.tx as never,
                { transactionValidDuration: 90 },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setTransactionValidDuration).toHaveBeenCalledWith(
                90,
            );
        });

        it("forwards transactionMemo", async () => {
            await executor.run(
                bundle.tx as never,
                { transactionMemo: "hello" },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setTransactionMemo).toHaveBeenCalledWith("hello");
        });

        it("forwards regenerateTransactionId", async () => {
            await executor.run(
                bundle.tx as never,
                { regenerateTransactionId: false },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setRegenerateTransactionId).toHaveBeenCalledWith(
                false,
            );
        });

        it("forwards highVolume", async () => {
            await executor.run(
                bundle.tx as never,
                { highVolume: true },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setHighVolume).toHaveBeenCalledWith(true);
        });

        it("converts string node IDs into AccountId instances", async () => {
            await executor.run(
                bundle.tx as never,
                { nodeAccountIds: ["0.0.3", "0.0.4"] },
                SAMPLE_EVENT,
            );

            const ids = bundle.tx.setNodeAccountIds.mock
                .calls[0][0] as AccountId[];
            expect(ids).toHaveLength(2);
            expect(ids[0]).toBeInstanceOf(AccountId);
            expect(ids[0].toString()).toBe("0.0.3");
            expect(ids[1].toString()).toBe("0.0.4");
        });

        it("ignores an empty nodeAccountIds array", async () => {
            await executor.run(
                bundle.tx as never,
                { nodeAccountIds: [] },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.setNodeAccountIds).not.toHaveBeenCalled();
        });

        it("applies base options before emitting the before-event", async () => {
            const order: string[] = [];
            bundle.tx.setTransactionMemo.mockImplementationOnce(() => {
                order.push("setMemo");
                return bundle.tx;
            });
            (
                context.emitBeforeTransaction as ReturnType<typeof vi.fn>
            ).mockImplementationOnce(() => {
                order.push("before");
                return Promise.resolve();
            });

            await executor.run(
                bundle.tx as never,
                { transactionMemo: "ordered" },
                SAMPLE_EVENT,
            );

            expect(order).toEqual(["setMemo", "before"]);
        });
    });

    describe("run() — lifecycle", () => {
        it("freezes before signing, then executes, then fetches the receipt", async () => {
            const order: string[] = [];
            bundle.tx.freezeWith.mockImplementationOnce(() => {
                order.push("freeze");
                return bundle.tx;
            });
            bundle.tx.sign.mockImplementationOnce(() => {
                order.push("sign");
                return Promise.resolve();
            });
            bundle.tx.execute.mockImplementationOnce(() => {
                order.push("execute");
                return Promise.resolve(bundle.response);
            });
            bundle.response.getReceipt.mockImplementationOnce(() => {
                order.push("getReceipt");
                return Promise.resolve(bundle.receipt);
            });

            const signer = PrivateKey.generateED25519();
            await executor.run(
                bundle.tx as never,
                { additionalSigners: [signer] },
                SAMPLE_EVENT,
            );

            expect(order).toEqual(["freeze", "sign", "execute", "getReceipt"]);
        });

        it("freezes with the context client", async () => {
            await executor.run(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(bundle.tx.freezeWith).toHaveBeenCalledWith(context.client);
        });

        it("calls run with the receipt and transaction ID", async () => {
            const result = await executor.run(
                bundle.tx as never,
                {},
                SAMPLE_EVENT,
            );

            expect(result).toMatchObject({
                receipt: bundle.receipt,
                transactionId: "0.0.123@1234567890.000000000",
                status: "SUCCESS",
            });
        });

        it("emits the chain-truth after-event", async () => {
            const order: string[] = [];
            (
                context.emitAfterTransaction as ReturnType<typeof vi.fn>
            ).mockImplementation(() => {
                order.push("after-event");
                return Promise.resolve();
            });

            await executor.run(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(order).toEqual(["after-event"]);
        });

        it("fetches the receipt exactly once", async () => {
            await executor.run(bundle.tx as never, {}, SAMPLE_EVENT);
            expect(bundle.response.getReceipt).toHaveBeenCalledTimes(1);
            expect(bundle.response.getReceiptQuery).not.toHaveBeenCalled();
        });

        it("emits before, then after with status and transactionId", async () => {
            await executor.run(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
                SAMPLE_EVENT,
            );
            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: SAMPLE_EVENT.type,
                    serviceName: SAMPLE_EVENT.serviceName,
                    methodName: SAMPLE_EVENT.methodName,
                    transactionId: "0.0.123@1234567890.000000000",
                    status: "SUCCESS",
                    durationMs: expect.any(Number),
                }),
            );
        });
    });

    describe("run() — signers", () => {
        it("signs once per additional signer", async () => {
            const k1 = PrivateKey.generateED25519();
            const k2 = PrivateKey.generateED25519();

            await executor.run(
                bundle.tx as never,
                { additionalSigners: [k1, k2] },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.sign).toHaveBeenCalledTimes(2);
            expect(bundle.tx.sign).toHaveBeenNthCalledWith(1, k1);
            expect(bundle.tx.sign).toHaveBeenNthCalledWith(2, k2);
        });

        it("delegates to signWith for each external signer", async () => {
            const pk = PrivateKey.generateED25519().publicKey;
            const sign = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

            await executor.run(
                bundle.tx as never,
                { externalSigners: [{ publicKey: pk, sign }] },
                SAMPLE_EVENT,
            );

            expect(bundle.tx.signWith).toHaveBeenCalledWith(pk, sign);
        });

        it("applies legacy signatures after freeze", async () => {
            const order: string[] = [];
            bundle.tx.freezeWith.mockImplementationOnce(() => {
                order.push("freeze");
                return bundle.tx;
            });
            bundle.tx._addSignatureLegacy.mockImplementationOnce(() => {
                order.push("legacy");
                return bundle.tx;
            });

            const pk = PrivateKey.generateED25519().publicKey;
            const sig = new Uint8Array([9, 9, 9]);

            await executor.run(
                bundle.tx as never,
                { legacySignatures: [{ publicKey: pk, signature: sig }] },
                SAMPLE_EVENT,
            );

            expect(bundle.tx._addSignatureLegacy).toHaveBeenCalledWith(pk, sig);
            expect(order).toEqual(["freeze", "legacy"]);
        });

        it("does not call sign / signWith / _addSignatureLegacy when no signers are provided", async () => {
            await executor.run(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(bundle.tx.sign).not.toHaveBeenCalled();
            expect(bundle.tx.signWith).not.toHaveBeenCalled();
            expect(bundle.tx._addSignatureLegacy).not.toHaveBeenCalled();
        });
    });

    describe("run() — error handling", () => {
        it("normalises a thrown error into HieroError with the service.method context", async () => {
            const original = new Error("boom");
            bundle.tx.execute.mockRejectedValueOnce(original);

            await expect(
                executor.run(bundle.tx as never, {}, SAMPLE_EVENT),
            ).rejects.toBeInstanceOf(HieroError);

            reattachMockChain(bundle);
            bundle.tx.execute.mockRejectedValueOnce(original);

            await expect(
                executor.run(bundle.tx as never, {}, SAMPLE_EVENT),
            ).rejects.toMatchObject({
                context: "TopicService.createTopic",
                cause: original,
            });
        });

        it("emits an after event with the original error before throwing", async () => {
            const original = new Error("execute exploded");
            bundle.tx.execute.mockRejectedValueOnce(original);

            await expect(
                executor.run(bundle.tx as never, {}, SAMPLE_EVENT),
            ).rejects.toThrow();

            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: original,
                    durationMs: expect.any(Number),
                }),
            );
        });

        it("wraps a non-Error rejection into an Error for the after event", async () => {
            bundle.tx.execute.mockRejectedValueOnce("string failure");

            await expect(
                executor.run(bundle.tx as never, {}, SAMPLE_EVENT),
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
                .run(bundle.tx as never, {}, SAMPLE_EVENT)
                .catch(() => undefined);

            expect(context.emitAfterTransaction).toHaveBeenCalledTimes(1);
        });

        it("returns the result when an onAfterTransaction listener throws", async () => {
            const result = await new TransactionExecutor(ctx).run(
                bundle.tx as never,
                {},
                SAMPLE_EVENT,
            );

            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");
        });

        it("still runs when an onBeforeTransaction listener throws", async () => {
            ctx.addTransactionListener({
                onBeforeTransaction: () => {
                    throw new Error("metrics backend down");
                },
            });

            const result = await new TransactionExecutor(ctx).run(
                bundle.tx as never,
                {},
                SAMPLE_EVENT,
            );

            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");
        });

        it("keeps the original error when an onAfterTransaction listener throws", async () => {
            const original = new Error("execute exploded");
            bundle.tx.execute.mockRejectedValueOnce(original);

            await expect(
                new TransactionExecutor(ctx).run(
                    bundle.tx as never,
                    {},
                    SAMPLE_EVENT,
                ),
            ).rejects.toMatchObject({ cause: original });
        });
    });

    describe("scheduleRun()", () => {
        it("wraps the transaction via tx.schedule()", async () => {
            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(bundle.tx.schedule).toHaveBeenCalledTimes(1);
        });

        it("returns the scheduleId from the receipt", async () => {
            const result = await executor.scheduleRun(
                bundle.tx as never,
                {},
                SAMPLE_EVENT,
            );

            expect(result.scheduleId.toString()).toBe("0.0.777");
        });

        it("returns the shared fields alongside scheduleId — the ScheduleCreate transaction id is the caller's correlator", async () => {
            const result = await executor.scheduleRun(
                bundle.tx as never,
                {},
                SAMPLE_EVENT,
            );

            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");
            expect(result.status).toBe("SUCCESS");
            expect(result.receipt).toBeDefined();
            expect(result.response).toBeDefined();
        });

        it("applies the schedule payer when provided as a string", async () => {
            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT, {
                payerAccountId: "0.0.501",
            });

            expect(bundle.scheduleTx.setPayerAccountId).toHaveBeenCalledTimes(
                1,
            );
            const payer = bundle.scheduleTx.setPayerAccountId.mock
                .calls[0][0] as AccountId;
            expect(payer).toBeInstanceOf(AccountId);
            expect(payer.toString()).toBe("0.0.501");
        });

        it("applies the schedule payer when provided as an AccountId", async () => {
            const payer = AccountId.fromString("0.0.502");

            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT, {
                payerAccountId: payer,
            });

            expect(bundle.scheduleTx.setPayerAccountId).toHaveBeenCalledWith(
                payer,
            );
        });

        it("applies the schedule admin key when provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT, {
                adminKey,
            });

            expect(bundle.scheduleTx.setAdminKey).toHaveBeenCalledWith(
                adminKey,
            );
        });

        it("applies the schedule memo when provided", async () => {
            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT, {
                scheduleMemo: "pending multi-sig",
            });

            expect(bundle.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "pending multi-sig",
            );
        });

        it("does not call any schedule setter when scheduleOptions is empty", async () => {
            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(bundle.scheduleTx.setPayerAccountId).not.toHaveBeenCalled();
            expect(bundle.scheduleTx.setAdminKey).not.toHaveBeenCalled();
            expect(bundle.scheduleTx.setScheduleMemo).not.toHaveBeenCalled();
        });

        it("delegates to run() — base options are applied to the schedule transaction", async () => {
            await executor.scheduleRun(
                bundle.tx as never,
                { transactionMemo: "outer-memo" },
                SAMPLE_EVENT,
                { scheduleMemo: "inner-memo" },
            );

            // The TransactionOptions are forwarded to run() which applies
            // them to whatever transaction it was handed — in this case
            // the schedule wrapper.
            expect(bundle.scheduleTx.setTransactionMemo).toHaveBeenCalledWith(
                "outer-memo",
            );
            expect(bundle.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "inner-memo",
            );
        });

        it("freezes and executes the schedule wrapper, not the inner tx", async () => {
            await executor.scheduleRun(bundle.tx as never, {}, SAMPLE_EVENT);

            expect(bundle.scheduleTx.freezeWith).toHaveBeenCalled();
            expect(bundle.scheduleTx.execute).toHaveBeenCalled();
            // The inner tx is only used to produce the schedule via .schedule()
            expect(bundle.tx.freezeWith).not.toHaveBeenCalled();
            expect(bundle.tx.execute).not.toHaveBeenCalled();
        });
    });
});
