import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CustomFixedFee,
    PrivateKey,
    ScheduleId,
    TopicCreateTransaction,
    TopicId,
} from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { topicId: TopicId.fromString("0.0.888") },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TopicCreateOperation (via TopicService)", () => {
    let service: TopicService;
    let run: ReturnType<typeof vi.spyOn>;
    let scheduleRun: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TopicCreateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);
        service = new TopicService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createTopic", () => {
        it("creates a fully public, immutable topic with empty options", async () => {
            const { topicId } = await service.createTopic();

            expect(topicId.toString()).toBe("0.0.888");
            const tx = sentTx();
            const defaults = new TopicCreateTransaction();
            expect(tx).toBeInstanceOf(TopicCreateTransaction);
            expect(tx.getTopicMemo()).toBe(defaults.getTopicMemo());
            expect(tx.getAdminKey()).toBeNull();
            expect(tx.getSubmitKey()).toBeNull();
            expect(tx.getAutoRenewAccountId()).toBeNull();
            expect(tx.getAutoRenewPeriod()).toEqual(
                defaults.getAutoRenewPeriod(),
            );
        });

        it("sets a topicMemo", async () => {
            await service.createTopic({ topicMemo: "audit log" });

            expect(sentTx().getTopicMemo()).toBe("audit log");
        });

        it("sets a submitKey for a private topic", async () => {
            const submitKey = PrivateKey.generateED25519().publicKey;

            await service.createTopic({ submitKey });

            expect(sentTx().getSubmitKey()).toBe(submitKey);
        });

        it("sets adminKey and autoRenewAccountId for a mutable topic", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await service.createTopic({
                adminKey,
                autoRenewAccountId: "0.0.99",
                autoRenewPeriod: 7_000_000,
            });

            const tx = sentTx();
            expect(tx.getAdminKey()).toBe(adminKey);
            expect(tx.getAutoRenewAccountId()?.toString()).toBe("0.0.99");
            expect(tx.getAutoRenewPeriod().seconds.toNumber()).toBe(7_000_000);
        });

        it("sets HIP-991 fee schedule key, exempt keys and custom fees", async () => {
            const feeScheduleKey = PrivateKey.generateED25519().publicKey;
            const exemptKey = PrivateKey.generateED25519().publicKey;
            const fee = new CustomFixedFee()
                .setAmount(10)
                .setFeeCollectorAccountId("0.0.555");

            await service.createTopic({
                feeScheduleKey,
                feeExemptKeys: [exemptKey],
                customFees: [fee],
            });

            const tx = sentTx();
            expect(tx.getFeeScheduleKey()).toBe(feeScheduleKey);
            expect(tx.getFeeExemptKeys()).toEqual([exemptKey]);
            expect(tx.getCustomFees()).toEqual([fee]);
        });

        it("sends the TopicCreate event", async () => {
            await service.createTopic({ transactionMemo: "base memo" });

            expect(run).toHaveBeenCalledWith(
                expect.any(TopicCreateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "TopicCreate",
                    serviceName: "TopicService",
                    methodName: "createTopic",
                }),
            );
        });

        it("rejects when adminKey is set without autoRenewAccountId", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await expect(service.createTopic({ adminKey })).rejects.toThrow(
                /autoRenewAccountId is required/,
            );

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleCreateTopic", () => {
        it("schedules a topic create and returns the scheduleId", async () => {
            const result = await service.scheduleCreateTopic({
                topicMemo: "scheduled topic",
            });

            expect(result.scheduleId.toString()).toBe("0.0.777");
            const tx = scheduleRun.mock.calls[0][0] as TopicCreateTransaction;
            expect(tx).toBeInstanceOf(TopicCreateTransaction);
            expect(tx.getTopicMemo()).toBe("scheduled topic");
            expect(run).not.toHaveBeenCalled();
        });

        it("passes the schedule options to the executor", async () => {
            const scheduleOptions = {
                payerAccountId: "0.0.999",
                scheduleMemo: "deferred topic create",
            };

            await service.scheduleCreateTopic({}, scheduleOptions);

            expect(scheduleRun.mock.calls[0][3]).toEqual(scheduleOptions);
        });
    });
});
