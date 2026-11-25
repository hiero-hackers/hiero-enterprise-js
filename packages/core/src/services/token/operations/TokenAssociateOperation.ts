import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenAssociateTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TokenAssociateValidator } from "../validation/index.js";

/**
 * Low-level options for token association.
 *
 * Keeps SDK prop types as-is while extending `TransactionOptions`. Set
 * exactly one of `tokenId` and `tokenIds`.
 */
export interface TokenAssociateOperationOptions extends TransactionOptions {
    accountId: AccountId | string;
    /** A single token to associate. */
    tokenId?: TokenId | string;
    /** Several tokens to associate in one transaction. */
    tokenIds?: (TokenId | string)[];
}

export class TokenAssociateOperation extends BaseOperation<TokenAssociateOperationOptions> {
    protected readonly type = "TokenAssociate";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "associateToken";
    protected readonly validator = new TokenAssociateValidator();

    /** Submit a `TokenAssociateTransaction`. */
    async execute(options: TokenAssociateOperationOptions) {
        return await this.run(options);
    }

    /** Schedule a `TokenAssociateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenAssociateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    protected build(
        options: TokenAssociateOperationOptions,
    ): TokenAssociateTransaction {
        return new TokenAssociateTransaction()
            .setAccountId(options.accountId)
            .setTokenIds(options.tokenIds ?? [options.tokenId!]);
    }
}
