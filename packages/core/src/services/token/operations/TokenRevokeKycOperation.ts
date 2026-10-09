import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenRevokeKycTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenRevokeKycValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenRevokeKycTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenRevokeKycTransaction` 1:1. Revoking KYC
 * marks `accountId` as no longer KYC-approved for the given token,
 * preventing further token transfers until KYC is re-granted. The token's
 * KYC key must sign (supply it via `additionalSigners`). The target
 * account must already be associated with the token.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenRevokeKyc` is not whitelisted for scheduling on
 * the network, so no `schedule()` variant is exposed.
 */
export interface TokenRevokeKycOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
}

export class TokenRevokeKycOperation extends BaseOperation<TokenRevokeKycOperationOptions> {
    protected readonly type = "TokenRevokeKyc";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "revokeKycToken";
    protected readonly validator = new TokenRevokeKycValidator();

    /** Submit a `TokenRevokeKycTransaction`. */
    async execute(options: TokenRevokeKycOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenRevokeKycOperationOptions,
    ): TokenRevokeKycTransaction {
        return new TokenRevokeKycTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);
    }
}
