import type { Query } from "@hiero-ledger/sdk";
import { AccountId, Hbar, Status, TransactionId } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import type { TransactionEvent } from "../../listeners/index.js";
import { normalizeError } from "../../errors/index.js";
import type { QueryOptions } from "./QueryOptions.js";

/**
 * Owns the full query lifecycle shared across all SDK consensus-node queries:
 * applying base options (payer, payment cap, node targeting), executing the
 * query, normalising any error into a `HieroError`, and emitting before/after
 * lifecycle events.
 *
 * Sibling of `TransactionExecutor` — same observability surface, but for
 * queries (which don't produce receipts or transaction IDs of their own).
 */
export class QueryExecutor {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Execute a pre-built query through the full lifecycle.
     *
     * @param query - The built (but not yet executed) query.
     * @param options - Base query options (payer, payment caps, node targeting).
     * @param event - Event metadata emitted before and after execution.
     * @returns The query result, typed by the query's response type.
     */
    async run<TResult>(
        query: Query<TResult>,
        options: QueryOptions,
        event: TransactionEvent,
    ): Promise<TResult> {
        this.applyBaseOptions(query, options);

        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        let result: TResult;
        try {
            result = await query.execute(this.context.client);
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

        // Emit the "after transaction" event now that the query has already succeeded.
        await this.context.emitAfterTransaction({
            ...event,
            status: Status.Success.toString(),
            durationMs: Date.now() - start,
        });

        return result;
    }

    /**
     * Apply the base `QueryOptions` fields to the SDK query before execution.
     */
    private applyBaseOptions(
        query: Query<unknown>,
        options: QueryOptions,
    ): void {
        if (options.payerAccountId != null) {
            const payerId =
                typeof options.payerAccountId === "string"
                    ? AccountId.fromString(options.payerAccountId)
                    : options.payerAccountId;
            // The SDK pays for a query via a payment transaction whose payer
            // is encoded in the transaction ID — overriding it here makes the
            // chosen account fund the read.
            query.setPaymentTransactionId(TransactionId.generate(payerId));
        }

        if (options.maxQueryPayment != null) {
            query.setMaxQueryPayment(toHbar(options.maxQueryPayment));
        }

        if (options.queryPayment != null) {
            query.setQueryPayment(toHbar(options.queryPayment));
        }

        if (options.nodeAccountIds?.length) {
            query.setNodeAccountIds(
                options.nodeAccountIds.map((id) => AccountId.fromString(id)),
            );
        }
    }
}

/**
 * Coerce a number (HBAR units) into an `Hbar` instance. The SDK's
 * `Query.setMaxQueryPayment` / `setQueryPayment` only accept `Hbar`,
 * unlike `Transaction.setMaxTransactionFee` which accepts both.
 */
function toHbar(amount: number | Hbar): Hbar {
    return typeof amount === "number" ? new Hbar(amount) : amount;
}
