import type { Transaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import type { TransactionEvent } from "../../listeners/index.js";
import { TransactionExecutor } from "./TransactionExecutor.js";
import type { TransactionOptions } from "./TransactionOptions.js";
import type { ScheduleOptions } from "./ScheduleOptions.js";

/**
 * Shared skeleton for an operation that sends one transaction:
 * validate the options, build the transaction, run it through the
 * executor.
 *
 * A subclass names its event, its validator and how to build the
 * transaction, then exposes `execute()` (and `schedule()` when the
 * network allows it) by calling `run()` / `scheduleRun()`.
 */
export abstract class BaseOperation<TOptions extends TransactionOptions> {
    /** Transaction type for the event, e.g. `"TopicCreate"`. */
    protected abstract readonly type: string;
    /** Service name for the event, e.g. `"TopicService"`. */
    protected abstract readonly serviceName: string;
    /** Service method name for the event, e.g. `"createTopic"`. */
    protected abstract readonly methodName: string;
    protected abstract readonly validator: {
        validate(options: TOptions): void;
    };

    private readonly executor: TransactionExecutor;

    constructor(protected readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
    }

    /** Build the SDK transaction from validated options. */
    protected abstract build(options: TOptions): Transaction;

    /** Validate, build and execute the transaction. */
    protected async run(options: TOptions) {
        this.validator.validate(options);
        const tx = this.build(options);
        return await this.executor.run(tx, options, this.event());
    }

    /** Validate, build and schedule the transaction. */
    protected async scheduleRun(
        options: TOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        this.validator.validate(options);
        const tx = this.build(options);
        return await this.executor.scheduleRun(
            tx,
            options,
            this.event(),
            scheduleOptions,
        );
    }

    private event(): TransactionEvent {
        return {
            type: this.type,
            serviceName: this.serviceName,
            methodName: this.methodName,
            timestamp: new Date(),
        };
    }
}
