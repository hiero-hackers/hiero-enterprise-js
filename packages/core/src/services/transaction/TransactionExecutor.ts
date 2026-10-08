import type {
    Transaction,
    TransactionReceipt,
    TransactionResponse,
} from "@hiero-ledger/sdk";
import { AccountId } from "@hiero-ledger/sdk";
import { type IHieroContext } from "../../context/index.js";
import type { TransactionEvent } from "../../listeners/index.js";
import { HieroError, normalizeError } from "../../errors/index.js";
import type { TransactionOptions } from "./TransactionOptions.js";
import type { ScheduleOptions } from "./ScheduleOptions.js";

/**
 * Owns the full transaction lifecycle shared across all service operations:
 * applying base options, optional freeze, additional signers, execute,
 * receipt fetch, and before/after event emission.
 *
 */
export class TransactionExecutor {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Execute a pre-built transaction through the full lifecycle.
     *
     * @param tx - The built (but not yet executed) transaction.
     * @param options - Base transaction options (fees, signers, etc.).
     * @param event - Event metadata emitted before and after execution.
     */
    async run(
        tx: Transaction,
        options: TransactionOptions,
        event: TransactionEvent,
    ) {
        // Apply base SDK options before any signing or execution
        this.applyBaseOptions(tx, options);

        // Emit the "before transaction" event before any execution occurs.
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        let response: TransactionResponse;
        let receipt: TransactionReceipt;
        try {
            // Always freeze before signing or execution
            tx.freezeWith(this.context.client);

            // Apply offline signatures after freeze (requires stable tx hash)
            this.applyLegacySignatures(tx, options);

            await this.applySigners(tx, options);

            // execute() auto-signs with the operator key via the client
            response = await tx.execute(this.context.client);

            // Fetch the receipt so the after-event carries a real chain
            receipt = await response.getReceipt(this.context.client);
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(
                error,
                `${event.serviceName}.${event.methodName}`,
            );
        }

        const transactionId = response.transactionId.toString();
        const status = receipt.status.toString();

        // Emit after the transaction has reached consensus.
        await this.context.emitAfterTransaction({
            ...event,
            transactionId,
            status,
            durationMs: Date.now() - start,
        });

        return { response, receipt, transactionId, status };
    }

    /**
     * Wrap a pre-built transaction in a `ScheduleCreateTransaction` and
     * submit it for deferred multi-sig execution.
     *
     * The inner transaction is stored on-chain and can collect signatures
     * from other parties before it executes automatically.
     *
     * @param tx - The inner transaction to schedule.
     * @param options - Base transaction options applied to the ScheduleCreateTransaction.
     * @param event - Event metadata emitted before and after execution.
     * @param scheduleOptions - Schedule-specific options (payer, admin key, memo).
     */
    async scheduleRun(
        tx: Transaction,
        options: TransactionOptions,
        event: TransactionEvent,
        scheduleOptions: ScheduleOptions = {},
    ) {
        // tx.schedule() wraps the inner transaction in a ScheduleCreateTransaction
        const scheduleTx = tx.schedule();

        if (scheduleOptions.payerAccountId != null) {
            const payerId =
                typeof scheduleOptions.payerAccountId === "string"
                    ? AccountId.fromString(scheduleOptions.payerAccountId)
                    : scheduleOptions.payerAccountId;
            scheduleTx.setPayerAccountId(payerId);
        }

        if (scheduleOptions.adminKey != null) {
            scheduleTx.setAdminKey(scheduleOptions.adminKey);
        }

        if (scheduleOptions.scheduleMemo != null) {
            scheduleTx.setScheduleMemo(scheduleOptions.scheduleMemo);
        }

        const result = await this.run(scheduleTx, options, event);

        if (!result.receipt.scheduleId) {
            throw new HieroError(
                "Schedule creation failed — no scheduleId returned in receipt.",
                {
                    code: "SDK_ERROR",
                    context: `${event.serviceName}.${event.methodName}`,
                    sdkStatus: result.status,
                    transactionId: result.transactionId,
                },
            );
        }

        // Shared fields plus scheduleId — same shape rule as run(), so a
        // scheduled write also hands back the ScheduleCreate transaction id
        // the caller needs to correlate with an explorer or the mirror node.
        return {
            ...result,
            scheduleId: result.receipt.scheduleId,
        };
    }

    /**
     * Apply the base `TransactionOptions` fields to the SDK transaction before
     * it is frozen or executed.
     */
    private applyBaseOptions(
        tx: Transaction,
        options: TransactionOptions,
    ): void {
        if (options.maxTransactionFee != null) {
            tx.setMaxTransactionFee(options.maxTransactionFee);
        }

        if (options.transactionValidDuration != null) {
            tx.setTransactionValidDuration(options.transactionValidDuration);
        }

        if (options.transactionMemo != null) {
            tx.setTransactionMemo(options.transactionMemo);
        }

        if (options.regenerateTransactionId != null) {
            tx.setRegenerateTransactionId(options.regenerateTransactionId);
        }

        if (options.highVolume != null) {
            tx.setHighVolume(options.highVolume);
        }

        if (options.nodeAccountIds?.length) {
            // Convert string IDs to AccountId objects as required by the SDK
            tx.setNodeAccountIds(
                options.nodeAccountIds.map((id) => AccountId.fromString(id)),
            );
        }
    }

    /**
     * Apply pre-computed offline signatures. Must be called after freeze.
     */
    private applyLegacySignatures(
        tx: Transaction,
        options: TransactionOptions,
    ): void {
        if (options.legacySignatures) {
            for (const { publicKey, signature } of options.legacySignatures) {
                tx._addSignatureLegacy(publicKey, signature);
            }
        }
    }

    /**
     * Apply additional private key signers and external (HSM/KMS) signers.
     * Called after freeze, before execute.
     */
    private async applySigners(
        tx: Transaction,
        options: TransactionOptions,
    ): Promise<void> {
        for (const key of options.additionalSigners ?? []) {
            await tx.sign(key);
        }

        for (const { publicKey, sign } of options.externalSigners ?? []) {
            await tx.signWith(publicKey, sign);
        }
    }
}
