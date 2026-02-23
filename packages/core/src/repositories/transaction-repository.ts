import type { TransactionInfo, Page } from "../data/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";

/**
 * Repository for querying transaction data from the mirror node.
 */
export class TransactionRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find all transactions for an account.
     */
    async findByAccount(accountId: string): Promise<Page<TransactionInfo>> {
        return this.mirrorNodeClient.queryTransactionsByAccount(accountId);
    }

    /**
     * Find transactions for an account filtered by type.
     */
    async findByAccountAndType(
        accountId: string,
        transactionType: string,
    ): Promise<Page<TransactionInfo>> {
        return this.mirrorNodeClient.queryTransactionsByAccountAndType(
            accountId,
            transactionType,
        );
    }

    /**
     * Find a specific transaction by ID.
     */
    async findById(transactionId: string): Promise<TransactionInfo> {
        return this.mirrorNodeClient.queryTransaction(transactionId);
    }
}
