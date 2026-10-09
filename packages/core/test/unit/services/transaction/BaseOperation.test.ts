import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScheduleId, TopicDeleteTransaction } from "@hiero-ledger/sdk";
import {
    BaseOperation,
    TransactionExecutor,
} from "../../../../src/services/transaction/index.js";
import type {
    ScheduleOptions,
    TransactionOptions,
} from "../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../utils/mock-context.js";

// A minimal subclass building a real SDK transaction; only the executor,
// which sends it, is stubbed.

interface SampleOptions extends TransactionOptions {
    topicId: string;
}

class SampleOperation extends BaseOperation<SampleOptions> {
    protected readonly type = "TopicDelete";
    protected readonly serviceName = "SampleService";
    protected readonly methodName = "deleteSample";
    protected readonly validator = {
        validate(options: SampleOptions) {
            if (!options.topicId) throw new Error("topicId is required");
        },
    };

    async execute(options: SampleOptions) {
        return await this.run(options);
    }

    async schedule(options: SampleOptions, scheduleOptions?: ScheduleOptions) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    protected build(options: SampleOptions) {
        return new TopicDeleteTransaction().setTopicId(options.topicId);
    }
}

const result = { status: "SUCCESS", transactionId: "0.0.2@1.0" };
const scheduled = { scheduleId: ScheduleId.fromString("0.0.777") };

describe("BaseOperation", () => {
    let operation: SampleOperation;
    let run: ReturnType<typeof vi.spyOn>;
    let scheduleRun: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(result as never);
        scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue(scheduled as never);
        operation = new SampleOperation(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("run", () => {
        it("sends the built transaction, the options and the event", async () => {
            const options = { topicId: "0.0.5", transactionMemo: "memo" };

            await expect(operation.execute(options)).resolves.toBe(result);

            const [tx, sentOptions, event] = run.mock.calls[0];
            expect(tx).toBeInstanceOf(TopicDeleteTransaction);
            expect((tx as TopicDeleteTransaction).topicId?.toString()).toBe(
                "0.0.5",
            );
            expect(sentOptions).toBe(options);
            expect(event).toEqual({
                type: "TopicDelete",
                serviceName: "SampleService",
                methodName: "deleteSample",
                timestamp: expect.any(Date),
            });
        });

        it("rejects invalid options before sending", async () => {
            await expect(operation.execute({ topicId: "" })).rejects.toThrow(
                /topicId is required/,
            );

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleRun", () => {
        it("sends the built transaction, the event and the schedule options", async () => {
            const options = { topicId: "0.0.5" };
            const scheduleOptions = { scheduleMemo: "later" };

            await expect(
                operation.schedule(options, scheduleOptions),
            ).resolves.toBe(scheduled);

            expect(scheduleRun).toHaveBeenCalledWith(
                expect.any(TopicDeleteTransaction),
                options,
                {
                    type: "TopicDelete",
                    serviceName: "SampleService",
                    methodName: "deleteSample",
                    timestamp: expect.any(Date),
                },
                scheduleOptions,
            );
        });

        it("rejects invalid options before scheduling", async () => {
            await expect(operation.schedule({ topicId: "" })).rejects.toThrow(
                /topicId is required/,
            );

            expect(scheduleRun).not.toHaveBeenCalled();
        });
    });
});
