import type {
    TransactionInfo,
    Page,
    TransactionQuery,
    TransactionLookupQuery,
} from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Repository for querying transaction data from the mirror node.
 *
 * `findByAccount` accepts a {@link TransactionQuery} that bundles `limit`,
 * `order`, `timestamp` (point-in-time or range, for time-series), and
 * `transactionType` into one call. It returns a continuable {@link Page};
 * walk multiple pages with the `collectAll` / `paginate` helpers, or
 * `Page.next()` directly.
 */
export class TransactionRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find transactions with bundled filters. Omit `accountId` to search
     * network-wide — e.g. the largest transfers of the day or every
     * contract call in a window, regardless of account.
     *
     * @example
     * // All CRYPTOTRANSFERs network-wide in a 24h window:
     * repo.find({
     *   transactionType: "CRYPTOTRANSFER",
     *   timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
     *   limit: 100,
     * });
     */
    find(options?: TransactionQuery): Promise<Page<TransactionInfo>> {
        return this.mirrorNodeClient.queryTransactions(options);
    }

    /**
     * Find transactions for an account, optionally filtered by type and/or a
     * consensus-timestamp window.
     *
     * @example
     * // Token mints for an account within a time window, newest first:
     * repo.findByAccount("0.0.123", {
     *   transactionType: "TOKENMINT",
     *   timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
     *   order: "desc",
     * });
     */
    findByAccount(
        accountId: string,
        options?: TransactionQuery,
    ): Promise<Page<TransactionInfo>> {
        return this.mirrorNodeClient.queryTransactionsByAccount(
            accountId,
            options,
        );
    }

    /**
     * Find a specific transaction by ID — pass `{ nonce }` or
     * `{ scheduled: true }` to select a child or scheduled execution.
     * Returns the first row; use {@link findAllById} for all of them.
     * Takes the mirror form (`0.0.5-1700000000-000000123`) or the SDK's
     * (`0.0.5@1700000000.000000123`).
     */
    findById(
        transactionId: string,
        options?: TransactionLookupQuery,
    ): Promise<TransactionInfo> {
        return this.mirrorNodeClient.queryTransaction(transactionId, options);
    }

    /**
     * Find every row the mirror node returns for a transaction ID: parent
     * and child transactions, or a schedule create and its scheduled
     * execution.
     *
     * @example
     * // The SCHEDULECREATE and the scheduled execution it triggered:
     * const rows = await repo.findAllById("0.0.123-1700000000-000000001");
     * const executed = rows.find((row) => row.scheduled);
     */
    findAllById(
        transactionId: string,
        options?: TransactionLookupQuery,
    ): Promise<TransactionInfo[]> {
        return this.mirrorNodeClient.queryTransactionRows(
            transactionId,
            options,
        );
    }
}
