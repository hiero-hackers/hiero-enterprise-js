import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenUnfreezeTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenUnfreezeValidator } from "../validation/index.js";

/**
 * Options for the `TokenUnfreezeTransaction` SDK transaction.

 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenUnfreeze` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenUnfreezeOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
}

export class TokenUnfreezeOperation extends BaseOperation<TokenUnfreezeOperationOptions> {
    protected readonly type = "TokenUnfreeze";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "unfreezeToken";
    protected readonly validator = new TokenUnfreezeValidator();

    /** Submit a `TokenUnfreezeTransaction`. */
    async execute(options: TokenUnfreezeOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenUnfreezeOperationOptions,
    ): TokenUnfreezeTransaction {
        return new TokenUnfreezeTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);
    }
}
