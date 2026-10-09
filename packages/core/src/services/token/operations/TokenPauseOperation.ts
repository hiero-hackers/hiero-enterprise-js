import type { TokenId } from "@hiero-ledger/sdk";
import { TokenPauseTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenPauseValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenPauseTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenPauseTransaction` 1:1. Pausing a token
 * blocks all transfers, mints, burns, wipes, freezes, unfreezes, grant /
 * revoke KYC, and other operations on that token network-wide until it
 * is unpaused. The token must have been created with a pause key, and
 * that pause key must sign — supply it via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenPause` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenPauseOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
}

export class TokenPauseOperation extends BaseOperation<TokenPauseOperationOptions> {
    protected readonly type = "TokenPause";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "pauseToken";
    protected readonly validator = new TokenPauseValidator();

    /** Submit a `TokenPauseTransaction`. */
    async execute(options: TokenPauseOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenPauseOperationOptions,
    ): TokenPauseTransaction {
        return new TokenPauseTransaction().setTokenId(options.tokenId);
    }
}
