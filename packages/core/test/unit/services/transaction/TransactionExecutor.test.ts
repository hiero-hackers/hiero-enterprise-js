import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    Hbar,
    PrivateKey,
    ScheduleCreateTransaction,
    ScheduleId,
    Status,
    Transaction,
    TransactionId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { TransactionExecutor } from "../../../../src/services/transaction/index.js";
import { HieroError } from "../../../../src/errors/index.js";
import { HieroContext } from "../../../../src/context/index.js";
import type { TransactionEvent } from "../../../../src/listeners/index.js";

// Real SDK transactions and a real context; only execute() is faked.

const SAMPLE_EVENT: TransactionEvent = {
    type: "TopicCreateTransaction",
    serviceName: "TopicService",
    methodName: "createTopic",
    timestamp: new Date(0),
};

const TX_ID = "0.0.123@1234567890.000000000";

describe("TransactionExecutor", () => {
    let ctx: HieroContext;
    let executor: TransactionExecutor;
    let tx: TransferTransaction;
    let receipt: { status: Status; scheduleId: ScheduleId };
    let response: {
        transactionId: TransactionId;
        getReceipt: ReturnType<typeof vi.fn>;
        getReceiptQuery: ReturnType<typeof vi.fn>;
    };
    let execute: ReturnType<typeof vi.spyOn>;

    /** The transaction execute() was called on. */
    const executedTx = () => execute.mock.contexts[0] as Transaction;

    beforeEach(() => {
        ctx = new HieroContext({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKeyType: "der",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
        });
        vi.spyOn(ctx, "emitBeforeTransaction");
        vi.spyOn(ctx, "emitAfterTransaction");
        executor = new TransactionExecutor(ctx);
        tx = new TransferTransaction();
        receipt = {
            status: Status.Success,
            scheduleId: ScheduleId.fromString("0.0.777"),
        };
        response = {
            transactionId: TransactionId.fromString(TX_ID),
            getReceipt: vi.fn().mockResolvedValue(receipt),
            getReceiptQuery: vi.fn(),
        };
        execute = vi
            .spyOn(Transaction.prototype, "execute")
            .mockResolvedValue(response as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        ctx.close();
    });

    describe("run() — applyBaseOptions", () => {
        it("applies no setters when options are empty", async () => {
            // Same state as a tx frozen without any options.
            const plain = new TransferTransaction().freezeWith(ctx.client);

            await executor.run(tx, {}, SAMPLE_EVENT);

            expect(tx.maxTransactionFee).toEqual(plain.maxTransactionFee);
            expect(tx.transactionMemo).toBe(plain.transactionMemo);
            expect(tx.transactionValidDuration).toBe(
                plain.transactionValidDuration,
            );
            expect(tx.regenerateTransactionId).toBe(
                plain.regenerateTransactionId,
            );
            expect(tx.highVolume).toBe(plain.highVolume);
        });

        it("forwards maxTransactionFee as-is (number)", async () => {
            await executor.run(tx, { maxTransactionFee: 5 }, SAMPLE_EVENT);

            expect(tx.maxTransactionFee?.toString()).toBe(
                new Hbar(5).toString(),
            );
        });

        it("forwards maxTransactionFee as-is (Hbar)", async () => {
            const fee = new Hbar(2);
            await executor.run(tx, { maxTransactionFee: fee }, SAMPLE_EVENT);

            expect(tx.maxTransactionFee).toBe(fee);
        });

        it("forwards transactionValidDuration", async () => {
            await executor.run(
                tx,
                { transactionValidDuration: 90 },
                SAMPLE_EVENT,
            );

            expect(tx.transactionValidDuration).toBe(90);
        });

        it("forwards transactionMemo", async () => {
            await executor.run(tx, { transactionMemo: "hello" }, SAMPLE_EVENT);

            expect(tx.transactionMemo).toBe("hello");
        });

        it("forwards regenerateTransactionId", async () => {
            await executor.run(
                tx,
                { regenerateTransactionId: false },
                SAMPLE_EVENT,
            );

            expect(tx.regenerateTransactionId).toBe(false);
        });

        it("forwards highVolume", async () => {
            await executor.run(tx, { highVolume: true }, SAMPLE_EVENT);

            expect(tx.highVolume).toBe(true);
        });

        it("converts string node IDs into AccountId instances", async () => {
            await executor.run(
                tx,
                { nodeAccountIds: ["0.0.3", "0.0.4"] },
                SAMPLE_EVENT,
            );

            const ids = tx.nodeAccountIds ?? [];
            expect(ids).toHaveLength(2);
            expect(ids[0]).toBeInstanceOf(AccountId);
            expect(ids.map(String)).toEqual(["0.0.3", "0.0.4"]);
        });

        it("ignores an empty nodeAccountIds array", async () => {
            tx.setNodeAccountIds([AccountId.fromString("0.0.5")]);

            await executor.run(tx, { nodeAccountIds: [] }, SAMPLE_EVENT);

            expect(tx.nodeAccountIds?.map(String)).toEqual(["0.0.5"]);
        });

        it("applies base options before emitting the before-event", async () => {
            let memoAtBefore: string | undefined;
            ctx.addTransactionListener({
                onBeforeTransaction: () => {
                    memoAtBefore = tx.transactionMemo;
                },
            });

            await executor.run(
                tx,
                { transactionMemo: "ordered" },
                SAMPLE_EVENT,
            );

            expect(memoAtBefore).toBe("ordered");
        });
    });

    describe("run() — lifecycle", () => {
        it("freezes before signing, then executes, then fetches the receipt", async () => {
            const order: string[] = [];
            const signer = PrivateKey.generateED25519();
            // signWith() throws on an unfrozen tx, so a signature proves freeze.
            execute.mockImplementationOnce(function (this: Transaction) {
                order.push(
                    this.isFrozen() && signer.publicKey.verifyTransaction(this)
                        ? "execute (frozen, signed)"
                        : "execute",
                );
                return Promise.resolve(response);
            });
            response.getReceipt.mockImplementationOnce(() => {
                order.push("getReceipt");
                return Promise.resolve(receipt);
            });

            await executor.run(
                tx,
                { additionalSigners: [signer], nodeAccountIds: ["0.0.3"] },
                SAMPLE_EVENT,
            );

            expect(order).toEqual(["execute (frozen, signed)", "getReceipt"]);
        });

        it("freezes with the context client", async () => {
            await executor.run(tx, {}, SAMPLE_EVENT);

            expect(tx.isFrozen()).toBe(true);
            expect(tx.transactionId?.accountId?.toString()).toBe("0.0.2");
            expect(execute).toHaveBeenCalledWith(ctx.client);
        });

        it("calls run with the receipt and transaction ID", async () => {
            const result = await executor.run(tx, {}, SAMPLE_EVENT);

            expect(result).toMatchObject({
                receipt,
                transactionId: TX_ID,
                status: "SUCCESS",
            });
        });

        it("emits the chain-truth after-event", async () => {
            await executor.run(tx, {}, SAMPLE_EVENT);

            expect(ctx.emitAfterTransaction).toHaveBeenCalledTimes(1);
        });

        it("fetches the receipt exactly once", async () => {
            await executor.run(tx, {}, SAMPLE_EVENT);

            expect(response.getReceipt).toHaveBeenCalledTimes(1);
            expect(response.getReceipt).toHaveBeenCalledWith(ctx.client);
            expect(response.getReceiptQuery).not.toHaveBeenCalled();
        });

        it("emits before, then after with status and transactionId", async () => {
            await executor.run(tx, {}, SAMPLE_EVENT);

            expect(ctx.emitBeforeTransaction).toHaveBeenCalledWith(
                SAMPLE_EVENT,
            );
            expect(ctx.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: SAMPLE_EVENT.type,
                    serviceName: SAMPLE_EVENT.serviceName,
                    methodName: SAMPLE_EVENT.methodName,
                    transactionId: TX_ID,
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
                tx,
                { additionalSigners: [k1, k2], nodeAccountIds: ["0.0.3"] },
                SAMPLE_EVENT,
            );

            expect(k1.publicKey.verifyTransaction(tx)).toBe(true);
            expect(k2.publicKey.verifyTransaction(tx)).toBe(true);
        });

        it("delegates to signWith for each external signer", async () => {
            const key = PrivateKey.generateED25519();
            const sign = vi.fn((message: Uint8Array) =>
                Promise.resolve(key.sign(message)),
            );

            await executor.run(
                tx,
                {
                    externalSigners: [{ publicKey: key.publicKey, sign }],
                    nodeAccountIds: ["0.0.3"],
                },
                SAMPLE_EVENT,
            );

            expect(sign).toHaveBeenCalledTimes(1);
            expect(key.publicKey.verifyTransaction(tx)).toBe(true);
        });

        it("applies legacy signatures after freeze", async () => {
            const pk = PrivateKey.generateED25519().publicKey;
            const sig = new Uint8Array([9, 9, 9]);

            // _addSignatureLegacy() throws on an unfrozen tx.
            await executor.run(
                tx,
                {
                    legacySignatures: [{ publicKey: pk, signature: sig }],
                    nodeAccountIds: ["0.0.3"],
                },
                SAMPLE_EVENT,
            );

            const [signatures] = tx.getSignatures().getFlatSignatureList();
            expect(signatures.get(pk)).toEqual(sig);
        });

        it("does not call sign / signWith / _addSignatureLegacy when no signers are provided", async () => {
            await executor.run(tx, {}, SAMPLE_EVENT);

            const signatures = tx.getSignatures().getFlatSignatureList();
            expect(signatures.every((m) => m.size === 0)).toBe(true);
        });
    });

    describe("run() — error handling", () => {
        it("normalises a thrown error into HieroError with the service.method context", async () => {
            const original = new Error("boom");
            execute.mockRejectedValueOnce(original);

            const error = await executor
                .run(tx, {}, SAMPLE_EVENT)
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(HieroError);
            expect(error).toMatchObject({
                context: "TopicService.createTopic",
                cause: original,
            });
        });

        it("emits an after event with the original error before throwing", async () => {
            const original = new Error("execute exploded");
            execute.mockRejectedValueOnce(original);

            await expect(executor.run(tx, {}, SAMPLE_EVENT)).rejects.toThrow();

            expect(ctx.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: original,
                    durationMs: expect.any(Number),
                }),
            );
        });

        it("wraps a non-Error rejection into an Error for the after event", async () => {
            execute.mockRejectedValueOnce("string failure");

            await expect(executor.run(tx, {}, SAMPLE_EVENT)).rejects.toThrow();

            const afterCall = vi.mocked(ctx.emitAfterTransaction).mock
                .calls[0][0];
            expect(afterCall.error).toBeInstanceOf(Error);
            expect(afterCall.error?.message).toBe("string failure");
        });
    });

    describe("run() — listener failures", () => {
        beforeEach(() => {
            ctx.addTransactionListener({
                onAfterTransaction: () => {
                    throw new Error("listener bug");
                },
            });
            vi.spyOn(process, "emitWarning").mockImplementation(
                () => undefined,
            );
        });

        it("emits the after-event once when emitting the success event fails", async () => {
            vi.mocked(ctx.emitAfterTransaction).mockRejectedValueOnce(
                new Error("listener bug"),
            );

            await executor.run(tx, {}, SAMPLE_EVENT).catch(() => undefined);

            expect(ctx.emitAfterTransaction).toHaveBeenCalledTimes(1);
        });

        it("returns the result when an onAfterTransaction listener throws", async () => {
            const result = await executor.run(tx, {}, SAMPLE_EVENT);

            expect(result.transactionId).toBe(TX_ID);
        });

        it("still runs when an onBeforeTransaction listener throws", async () => {
            ctx.addTransactionListener({
                onBeforeTransaction: () => {
                    throw new Error("metrics backend down");
                },
            });

            const result = await executor.run(tx, {}, SAMPLE_EVENT);

            expect(result.transactionId).toBe(TX_ID);
        });

        it("keeps the original error when an onAfterTransaction listener throws", async () => {
            const original = new Error("execute exploded");
            execute.mockRejectedValueOnce(original);

            await expect(
                executor.run(tx, {}, SAMPLE_EVENT),
            ).rejects.toMatchObject({ cause: original });
        });
    });

    describe("scheduleRun()", () => {
        /** The ScheduleCreateTransaction that was executed. */
        const scheduleTx = () => executedTx() as ScheduleCreateTransaction;
        let setScheduleMemo: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            // getScheduleMemo throws once frozen, so watch the real setter.
            setScheduleMemo = vi.spyOn(
                ScheduleCreateTransaction.prototype,
                "setScheduleMemo",
            );
        });

        it("wraps the transaction via tx.schedule()", async () => {
            const schedule = vi.spyOn(tx, "schedule");

            await executor.scheduleRun(tx, {}, SAMPLE_EVENT);

            expect(schedule).toHaveBeenCalledTimes(1);
            expect(executedTx()).toBe(schedule.mock.results[0].value);
        });

        it("returns the scheduleId from the receipt", async () => {
            const result = await executor.scheduleRun(tx, {}, SAMPLE_EVENT);

            expect(result.scheduleId.toString()).toBe("0.0.777");
        });

        it("returns the shared fields alongside scheduleId — the ScheduleCreate transaction id is the caller's correlator", async () => {
            const result = await executor.scheduleRun(tx, {}, SAMPLE_EVENT);

            expect(result.transactionId).toBe(TX_ID);
            expect(result.status).toBe("SUCCESS");
            expect(result.receipt).toBe(receipt);
            expect(result.response).toBe(response);
        });

        it("applies the schedule payer when provided as a string", async () => {
            await executor.scheduleRun(tx, {}, SAMPLE_EVENT, {
                payerAccountId: "0.0.501",
            });

            const payer = scheduleTx().payerAccountId;
            expect(payer).toBeInstanceOf(AccountId);
            expect(payer?.toString()).toBe("0.0.501");
        });

        it("applies the schedule payer when provided as an AccountId", async () => {
            const payer = AccountId.fromString("0.0.502");

            await executor.scheduleRun(tx, {}, SAMPLE_EVENT, {
                payerAccountId: payer,
            });

            expect(scheduleTx().payerAccountId).toBe(payer);
        });

        it("applies the schedule admin key when provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await executor.scheduleRun(tx, {}, SAMPLE_EVENT, { adminKey });

            expect(scheduleTx().adminKey).toBe(adminKey);
        });

        it("applies the schedule memo when provided", async () => {
            await executor.scheduleRun(tx, {}, SAMPLE_EVENT, {
                scheduleMemo: "pending multi-sig",
            });

            expect(setScheduleMemo).toHaveBeenCalledWith("pending multi-sig");
        });

        it("does not call any schedule setter when scheduleOptions is empty", async () => {
            await executor.scheduleRun(tx, {}, SAMPLE_EVENT);

            expect(scheduleTx().payerAccountId).toBeNull();
            expect(scheduleTx().adminKey).toBeNull();
            expect(setScheduleMemo).not.toHaveBeenCalled();
        });

        it("delegates to run() — base options are applied to the schedule transaction", async () => {
            await executor.scheduleRun(
                tx,
                { transactionMemo: "outer-memo" },
                SAMPLE_EVENT,
                { scheduleMemo: "inner-memo" },
            );

            // run() applies the options to the schedule wrapper it was handed.
            expect(scheduleTx().transactionMemo).toBe("outer-memo");
            expect(setScheduleMemo).toHaveBeenCalledWith("inner-memo");
            expect(tx.transactionMemo).toBe("");
        });

        it("freezes and executes the schedule wrapper, not the inner tx", async () => {
            await executor.scheduleRun(tx, {}, SAMPLE_EVENT);

            expect(execute).toHaveBeenCalledTimes(1);
            expect(scheduleTx()).toBeInstanceOf(ScheduleCreateTransaction);
            expect(scheduleTx().isFrozen()).toBe(true);
            expect(tx.isFrozen()).toBe(false);
        });
    });
});
