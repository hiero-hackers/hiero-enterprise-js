import type { AccountInfo, Balance } from "../data/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";

/**
 * Repository for querying account data from the mirror node.
 */
export class AccountRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find account information by account ID.
     */
    async findByAccountId(accountId: string): Promise<AccountInfo> {
        return this.mirrorNodeClient.queryAccount(accountId);
    }

    /**
     * Find account information by EVM alias.
     */
    async findByAlias(alias: string): Promise<AccountInfo> {
        return this.mirrorNodeClient.queryAccount(alias);
    }

    /**
     * Get the balance of an account.
     */
    async getBalance(accountId: string): Promise<Balance> {
        return this.mirrorNodeClient.queryAccountBalance(accountId);
    }
}
