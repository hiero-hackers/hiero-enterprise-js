import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CustomFixedFee,
    KeyList,
    PrivateKey,
    TopicUpdateTransaction,
} from "@hiero-ledger/sdk";
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

describe("TopicUpdateOperation (via TopicService)", () => {
    let service: TopicService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TopicUpdateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TopicService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("updateTopic", () => {
        it("builds a TopicUpdateTransaction touching only the changed field", async () => {
            const result = await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "renamed feed",
            });

            expect(result).toBe(receipt);
            const tx = sentTx();
            expect(tx).toBeInstanceOf(TopicUpdateTransaction);
            expect(tx.topicId?.toString()).toBe("0.0.12345");
            expect(tx.topicMemo).toBe("renamed feed");

            // Every other optional field keeps the SDK default.
            const defaults = new TopicUpdateTransaction();
            expect(tx.adminKey).toBe(defaults.adminKey);
            expect(tx.submitKey).toBe(defaults.submitKey);
            expect(tx.getFeeScheduleKey()).toBe(defaults.getFeeScheduleKey());
            expect(tx.getFeeExemptKeys()).toBe(defaults.getFeeExemptKeys());
            expect(tx.autoRenewAccountId).toBe(defaults.autoRenewAccountId);
            expect(tx.autoRenewPeriod).toBe(defaults.autoRenewPeriod);
            expect(tx.getCustomFees()).toBe(defaults.getCustomFees());
            expect(tx.expirationTime).toBe(defaults.expirationTime);
        });

        it("rejects a no-op update (only topicId, no other field) before building a transaction", async () => {
            await expect(
                service.updateTopic({ topicId: "0.0.12345" }),
            ).rejects.toThrow(
                /updateTopic requires at least one field to change/,
            );

            expect(run).not.toHaveBeenCalled();
        });

        it("sets every optional field that is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const submitKey = PrivateKey.generateED25519().publicKey;
            const feeScheduleKey = PrivateKey.generateED25519().publicKey;
            const exemptKey = PrivateKey.generateED25519().publicKey;
            const fee = new CustomFixedFee()
                .setAmount(10)
                .setFeeCollectorAccountId("0.0.555");
            const expirationTime = new Date("2099-01-02T03:04:05.000Z");

            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "renamed",
                adminKey,
                submitKey,
                feeScheduleKey,
                feeExemptKeys: [exemptKey],
                autoRenewAccountId: "0.0.99",
                autoRenewPeriod: 7_776_000,
                customFees: [fee],
                expirationTime,
            });

            const tx = sentTx();
            expect(tx.topicMemo).toBe("renamed");
            expect(tx.adminKey).toBe(adminKey);
            expect(tx.submitKey).toBe(submitKey);
            expect(tx.getFeeScheduleKey()).toBe(feeScheduleKey);
            expect(tx.getFeeExemptKeys()).toEqual([exemptKey]);
            expect(tx.autoRenewAccountId?.toString()).toBe("0.0.99");
            expect(tx.autoRenewPeriod?.seconds.toNumber()).toBe(7_776_000);
            expect(tx.getCustomFees()).toEqual([fee]);
            expect(tx.expirationTime?.toDate()).toEqual(expirationTime);
        });

        it("writes the empty-string memo sentinel when topicMemo is null", async () => {
            // The SDK's `clearTopicMemo()` unsets the field, which is a
            // no-op on the network; `""` is the clear sentinel.
            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: null,
            });

            expect(sentTx().topicMemo).toBe("");
        });

        it("writes an empty KeyList when adminKey is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                adminKey: null,
            });

            const key = sentTx().adminKey;
            expect(key).toBeInstanceOf(KeyList);
            expect((key as KeyList).toArray()).toHaveLength(0);
        });

        it("writes an empty KeyList when submitKey is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                submitKey: null,
            });

            const key = sentTx().submitKey;
            expect(key).toBeInstanceOf(KeyList);
            expect((key as KeyList).toArray()).toHaveLength(0);
        });

        it("writes an empty KeyList when feeScheduleKey is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                feeScheduleKey: null,
            });

            const key = sentTx().getFeeScheduleKey();
            expect(key).toBeInstanceOf(KeyList);
            expect((key as KeyList).toArray()).toHaveLength(0);
        });

        it("writes an empty fee-exempt key list when feeExemptKeys is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                feeExemptKeys: null,
            });

            expect(sentTx().getFeeExemptKeys()).toEqual([]);
        });

        it("writes the 0.0.0 sentinel when autoRenewAccountId is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                autoRenewAccountId: null,
            });

            expect(sentTx().autoRenewAccountId?.toString()).toBe("0.0.0");
        });

        it("writes an empty custom fee list when customFees is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                customFees: null,
            });

            expect(sentTx().getCustomFees()).toEqual([]);
        });

        it("keeps an empty-string memo verbatim (same network effect as null)", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "",
            });

            expect(sentTx().topicMemo).toBe("");
        });

        it("sends the TopicUpdate event", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "renamed",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TopicUpdateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "TopicUpdate",
                    serviceName: "TopicService",
                    methodName: "updateTopic",
                }),
            );
        });

        it("rejects a missing topicId before building a transaction", async () => {
            await expect(
                service.updateTopic(
                    {} as unknown as Parameters<typeof service.updateTopic>[0],
                ),
            ).rejects.toThrow(/topicId is required/);

            expect(run).not.toHaveBeenCalled();
        });
    });
});
