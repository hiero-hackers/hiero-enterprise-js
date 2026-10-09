import type { TokenId } from "@hiero-ledger/sdk";
import { TokenDeleteTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenDeleteValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenDeleteTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenDeleteTransaction` 1:1. Deletion marks the
 * token as deleted on the network; the token's admin key must sign the
 * transaction (supply it via `additionalSigners`).
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenDelete` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenDeleteOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
}

export class TokenDeleteOperation extends BaseOperation<TokenDeleteOperationOptions> {
    protected readonly type = "TokenDelete";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "deleteToken";
    protected readonly validator = new TokenDeleteValidator();

    /** Submit a `TokenDeleteTransaction`. */
    async execute(options: TokenDeleteOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenDeleteOperationOptions,
    ): TokenDeleteTransaction {
        return new TokenDeleteTransaction().setTokenId(options.tokenId);
    }
}
