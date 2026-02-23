/**
 * Event emitted before and after each SDK transaction.
 */
export interface TransactionEvent {
    /** Transaction type, e.g. "AccountCreate", "TokenMint" */
    type: string;
    /** Service class name, e.g. "AccountClient" */
    serviceName: string;
    /** Method name, e.g. "createAccount" */
    methodName: string;
    /** Timestamp when the event was created */
    timestamp: Date;
    /** Transaction ID (available in afterTransaction) */
    transactionId?: string;
    /** Receipt status (available in afterTransaction) */
    status?: string;
    /** Error if the transaction failed (available in afterTransaction) */
    error?: Error;
    /** Duration in milliseconds (available in afterTransaction) */
    durationMs?: number;
}

/**
 * Listener interface for transaction lifecycle events.
 * Register with HieroContext to receive notifications before and after
 * each transaction is executed.
 *
 * @example
 * ```ts
 * const logger: TransactionListener = {
 *     onBeforeTransaction(event) {
 *         console.log(`Starting ${event.type}...`);
 *     },
 *     onAfterTransaction(event) {
 *         console.log(`${event.type} completed in ${event.durationMs}ms`);
 *     },
 * };
 * context.addTransactionListener(logger);
 * ```
 */
export interface TransactionListener {
    /** Called before a transaction is submitted to the network */
    onBeforeTransaction?(event: TransactionEvent): void | Promise<void>;
    /** Called after a transaction completes (success or failure) */
    onAfterTransaction?(event: TransactionEvent): void | Promise<void>;
}
