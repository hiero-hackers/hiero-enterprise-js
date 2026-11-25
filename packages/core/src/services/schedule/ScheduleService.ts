import type { ScheduleId } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import {
    ScheduleSignOperation,
    ScheduleCancelOperation,
} from "./operations/index.js";
import type {
    ScheduleSignOptions,
    ScheduleCancelOptions,
} from "./operations/index.js";
import { ScheduleInfoQuery } from "./queries/index.js";
import type { ScheduleInfoResult } from "./queries/index.js";
import type { QueryOptions } from "../transaction/index.js";

/**
 * Service for interacting with scheduled transactions on the Hiero network.
 *
 * Handles the three post-scheduling operations:
 *   - `sign()`    — add a party's signature to a pending schedule
 *   - `cancel()`  — delete a schedule before it executes (requires adminKey)
 *   - `getInfo()` — query the current state of a schedule entity
 */
export class ScheduleService {
    private readonly signOperation: ScheduleSignOperation;
    private readonly cancelOperation: ScheduleCancelOperation;
    private readonly infoQuery: ScheduleInfoQuery;

    constructor(context: IHieroContext) {
        this.signOperation = new ScheduleSignOperation(context);
        this.cancelOperation = new ScheduleCancelOperation(context);
        this.infoQuery = new ScheduleInfoQuery(context);
    }

    /**
     * Add one or more signatures to a pending scheduled transaction.
     *
     * Each call collects the signatures provided in `additionalSigners`,
     * `externalSigners`, or `legacySignatures`. Once the required threshold
     * is met on-chain, the inner transaction executes automatically.
     *
     * @param options.scheduleId - The schedule entity to sign
     * @param options.additionalSigners - Local private keys to sign with
     * @param options.externalSigners - HSM / KMS / wallet signing functions
     * @param options.legacySignatures - Pre-computed offline signatures
     * @returns The transaction id/status; `scheduledTransactionId`, when
     *   present, is the id for querying the *scheduled* (inner)
     *   transaction's own receipt or record. Its presence does not mean
     *   the schedule executed — check `getInfo(...)`'s `executedAt` (or
     *   the scheduled transaction's receipt) for that
     */
    sign(options: ScheduleSignOptions) {
        return this.signOperation.execute(options);
    }

    /**
     * Cancel a pending scheduled transaction before it executes.
     *
     * Requires the `adminKey` that was set during `ScheduleCreateTransaction`.
     * Schedules created without an admin key are immutable and cannot be
     * cancelled — this method will throw in that case.
     *
     * @param options.scheduleId - The schedule entity to cancel
     * @param options.adminKey - Private key matching the schedule's adminKey
     */
    cancel(options: ScheduleCancelOptions) {
        return this.cancelOperation.execute(options);
    }

    /**
     * Query the current state of a schedule entity.
     *
     * Returns a plain object describing whether the schedule is pending,
     * executed, or cancelled, along with metadata (signers, memo, expiry).
     *
     * @param scheduleId - The schedule entity to query
     * @param options - Optional query options (payer, payment caps, node targeting)
     * @returns A `ScheduleInfoResult` with all schedule metadata
     */
    getInfo(
        scheduleId: string | ScheduleId,
        options?: QueryOptions,
    ): Promise<ScheduleInfoResult> {
        return this.infoQuery.execute(scheduleId, options);
    }
}
