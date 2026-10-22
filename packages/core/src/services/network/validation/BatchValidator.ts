import { BatchTransaction, FreezeTransaction } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type { BatchOptions } from "../operations/index.js";

/** Most inner transactions a batch may hold. */
const MAX_INNER_TRANSACTIONS = 25;

/**
 * Validates `BatchOptions` before they reach the SDK.
 */
export class BatchValidator {
    /**
     * @throws {HieroError} If `transactions` is not 1 to 25 frozen,
     *   batch-keyed transactions (none a batch or freeze)
     */
    validate(options: BatchOptions): void {
        if (
            !Array.isArray(options.transactions) ||
            options.transactions.length < 1 ||
            options.transactions.length > MAX_INNER_TRANSACTIONS
        ) {
            throw validationError(
                "BatchValidator",
                `transactions must hold 1 to ${MAX_INNER_TRANSACTIONS} transactions.`,
            );
        }

        options.transactions.forEach((tx, index) => {
            if (
                tx instanceof BatchTransaction ||
                tx instanceof FreezeTransaction
            ) {
                throw validationError(
                    "BatchValidator",
                    `transactions[${index}] is a batch or freeze transaction, which a batch cannot hold.`,
                );
            }

            if (!tx.isFrozen()) {
                throw validationError(
                    "BatchValidator",
                    `transactions[${index}] must be frozen.`,
                );
            }

            if (tx.batchKey == null) {
                throw validationError(
                    "BatchValidator",
                    `transactions[${index}] must have a batch key.`,
                );
            }
        });
    }
}
