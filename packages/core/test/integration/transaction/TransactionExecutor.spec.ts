import { describe, it, expect, beforeAll, vi } from "vitest";
import {
    Hbar,
    TopicCreateTransaction,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../utils/Env.js";
import { AccountService } from "../../../src/services/index.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../utils/IntegrationFixtures.js";
import { TransactionExecutor } from "../../../src/services/transaction/index.js";
import type { HieroContext } from "../../../src/context/index.js";

describe("TransactionExecutor [Integration]", () => {
    let context: HieroContext;
    let executor: TransactionExecutor;
    let accountService: AccountService;
    let scheduleReceiver: TestAccount;

    beforeAll(async () => {
        context = setupIntegrationTestEnv();
        executor = new TransactionExecutor(context);
        accountService = new AccountService(context);
        // A bare account that will receive the scheduled HBAR transfer.
        scheduleReceiver = await createTestAccount(accountService, 0);
    });

    describe("run()", () => {
        it("executes a transaction end-to-end and returns the receipt-derived topicId", async () => {
            const tx = new TopicCreateTransaction().setTopicMemo(
                "executor integration",
            );

            const result = await executor.run(
                tx,
                {},
                {
                    type: "TopicCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "createTopic",
                    timestamp: new Date(),
                },
            );

            expect(result.receipt.topicId!.toString()).toMatch(/^0\.0\.\d+$/);
        });

        it("emits before and after lifecycle events with SUCCESS status", async () => {
            const before = vi.fn();
            const after = vi.fn();
            context.addTransactionListener({
                onBeforeTransaction: before,
                onAfterTransaction: after,
            });

            const tx = new TopicCreateTransaction().setTopicMemo(
                "executor events",
            );

            await executor.run(
                tx,
                {},
                {
                    type: "TopicCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "createTopic",
                    timestamp: new Date(),
                },
            );

            expect(before).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TopicCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "createTopic",
                }),
            );
            expect(after).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TopicCreateTransaction",
                    status: "SUCCESS",
                    transactionId: expect.stringMatching(/^0\.0\.\d+@/),
                    durationMs: expect.any(Number),
                }),
            );
        });
    });

    describe("scheduleRun()", () => {
        it("wraps a transaction in a schedule and returns the schedule ID", async () => {
            // `TransferTransaction` is in the network's scheduled-transaction whitelist
            const inner = new TransferTransaction()
                .addHbarTransfer(context.operatorAccountId!, new Hbar(-1))
                .addHbarTransfer(scheduleReceiver.accountId, new Hbar(1));

            const result = await executor.scheduleRun(
                inner,
                {},
                {
                    type: "ScheduleCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "scheduleTransferHbar",
                    timestamp: new Date(),
                },
                { scheduleMemo: "executor integration schedule" },
            );

            expect(result.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
        });
    });
});
