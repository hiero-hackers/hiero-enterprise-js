import type { PrivateKey, Transaction } from "@hiero-ledger/sdk";
import { BatchTransaction } from "@hiero-ledger/sdk";
import { HieroError, HieroErrorCodes } from "../../../errors/index.js";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { BatchValidator } from "../validation/index.js";

/**
 * Options for submitting an atomic batch (`BatchTransaction`, HIP-551).
 * The `TransactionOptions` apply to the outer batch transaction.
 */
export interface BatchOptions extends TransactionOptions {
    /**
     * 1 to 25 SDK transactions, each frozen with a batch key and signed by
     * its own required keys (e.g. built with `batchify(client, batchKey)`).
     */
    transactions: Transaction[];
    /**
     * Private keys whose signatures satisfy the inner batch keys. The
     * operator signs on its own, and `externalSigners` can sign for keys
     * held elsewhere.
     */
    batchKeys?: PrivateKey[];
}

export class BatchOperation extends BaseOperation<BatchOptions> {
    protected readonly type = "AtomicBatch";
    protected readonly serviceName = "NetworkService";
    protected readonly methodName = "submitBatch";
    protected readonly validator = new BatchValidator();

    /**
     * Submit the batch, signed by every batch key.
     *
     * @throws HieroError carrying `innerTransactionIds` when the batch
     *   fails after validation.
     */
    async execute(options: BatchOptions) {
        try {
            const results = await this.run({
                ...options,
                additionalSigners: [
                    ...(options.batchKeys ?? []),
                    ...(options.additionalSigners ?? []),
                ],
            });

            return {
                ...results,
                innerTransactionIds: innerTransactionIds(options),
            };
        } catch (error) {
            // Invalid input never reached the network, so there are no IDs.
            if (
                !(error instanceof HieroError) ||
                error.code === HieroErrorCodes.InputInvalid
            ) {
                throw error;
            }

            throw new HieroError(error.message, {
                code: error.code,
                sdkStatus: error.sdkStatus,
                context: error.context,
                cause: error,
                transactionId: error.transactionId,
                innerTransactionIds: innerTransactionIds(options),
            });
        }
    }

    protected build(options: BatchOptions): BatchTransaction {
        return new BatchTransaction().setInnerTransactions(
            options.transactions,
        );
    }
}

/** The inner transactions' IDs, in batch order. */
function innerTransactionIds(options: BatchOptions): string[] {
    return options.transactions.map((tx) => String(tx.transactionId));
}
