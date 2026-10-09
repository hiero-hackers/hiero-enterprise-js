import type { ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleSignTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { ScheduleSignValidator } from "../validation/index.js";

/**
 * Options for adding a signature to a pending scheduled transaction.
 *
 * Extends `TransactionOptions` so every signing pattern is available:
 * local keys (`additionalSigners`), external signers (`externalSigners`),
 * and pre-computed offline signatures (`legacySignatures`).
 */
export interface ScheduleSignOptions extends TransactionOptions {
    /** The ID of the schedule entity to sign (e.g., `"0.0.12345"`). */
    scheduleId: string | ScheduleId;
}

export class ScheduleSignOperation extends BaseOperation<ScheduleSignOptions> {
    protected readonly type = "ScheduleSign";
    protected readonly serviceName = "ScheduleService";
    protected readonly methodName = "sign";
    protected readonly validator = new ScheduleSignValidator();

    /**
     * Schedule sign execute handler.
     *
     * @returns The executor's shared fields plus `scheduledTransactionId`
     *   — the id for querying the *scheduled* (inner) transaction's own
     *   receipt or record when the network reports it.
     */
    async execute(options: ScheduleSignOptions) {
        const results = await this.run(options);
        return {
            ...results,
            scheduledTransactionId:
                results.receipt.scheduledTransactionId ?? null,
        };
    }

    protected build(options: ScheduleSignOptions): ScheduleSignTransaction {
        return new ScheduleSignTransaction().setScheduleId(options.scheduleId);
    }
}
