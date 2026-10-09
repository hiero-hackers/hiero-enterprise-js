import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenDissociateTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TokenDissociateValidator } from "../validation/index.js";

/**
 * Low-level options for token dissociation.
 *
 * Mirrors the surface of `TokenDissociateTransaction`: a single account is
 * dissociated from one or more tokens in a single transaction. Keeps SDK
 * prop types as-is while extending `TransactionOptions`.
 */
export interface TokenDissociateOperationOptions extends TransactionOptions {
    accountId: AccountId | string;
    tokenIds: (TokenId | string)[];
}

export class TokenDissociateOperation extends BaseOperation<TokenDissociateOperationOptions> {
    protected readonly type = "TokenDissociate";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "dissociateToken";
    protected readonly validator = new TokenDissociateValidator();

    /** Submit a `TokenDissociateTransaction`. */
    async execute(options: TokenDissociateOperationOptions) {
        return await this.run(options);
    }

    /** Schedule a `TokenDissociateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenDissociateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    protected build(
        options: TokenDissociateOperationOptions,
    ): TokenDissociateTransaction {
        return new TokenDissociateTransaction()
            .setAccountId(options.accountId)
            .setTokenIds(options.tokenIds);
    }
}
