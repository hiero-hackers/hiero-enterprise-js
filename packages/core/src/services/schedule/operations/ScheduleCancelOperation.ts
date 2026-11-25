import type { PrivateKey, ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleDeleteTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { ScheduleCancelValidator } from "../validation/index.js";

/**
 * Options for cancelling a pending scheduled transaction.
 *
 * Requires the `adminKey` that was set when the schedule was originally
 * created via `ScheduleCreateTransaction.setAdminKey()`. Without an admin
 * key the schedule is immutable and cannot be deleted.
 */
export interface ScheduleCancelOptions extends TransactionOptions {
    /** The ID of the schedule entity to cancel. */
    scheduleId: string | ScheduleId;
    /**
     * Private key matching the `adminKey` set at schedule creation time.
     * Automatically added as the first signer before the operator auto-sign.
     */
    adminKey: PrivateKey;
}

export class ScheduleCancelOperation extends BaseOperation<ScheduleCancelOptions> {
    protected readonly type = "ScheduleDelete";
    protected readonly serviceName = "ScheduleService";
    protected readonly methodName = "cancel";
    protected readonly validator = new ScheduleCancelValidator();

    /** Submit a `ScheduleDeleteTransaction` signed by the admin key. */
    async execute(options: ScheduleCancelOptions) {
        // adminKey must co-sign the ScheduleDeleteTransaction — prepend it so
        // the executor freezes and signs before the operator auto-sign
        return await this.run({
            ...options,
            additionalSigners: [
                options.adminKey,
                ...(options.additionalSigners ?? []),
            ],
        });
    }

    protected build(options: ScheduleCancelOptions): ScheduleDeleteTransaction {
        return new ScheduleDeleteTransaction().setScheduleId(
            options.scheduleId,
        );
    }
}
