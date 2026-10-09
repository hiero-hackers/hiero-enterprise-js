import type { CustomFee, TokenId } from "@hiero-ledger/sdk";
import { TokenFeeScheduleUpdateTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenFeeScheduleUpdateValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenFeeScheduleUpdateTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenFeeScheduleUpdateTransaction` 1:1. Replaces
 * the token's existing custom fee schedule with the supplied list. Pass
 * an empty `customFees` array to clear all custom fees. The token must
 * have been created with a fee-schedule key, and that fee-schedule key
 * must sign — supply it via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenFeeScheduleUpdate` is not whitelisted for
 * scheduling on the network, so no `schedule()` variant is exposed.
 */
export interface TokenFeeScheduleUpdateOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    customFees: CustomFee[];
}

export class TokenFeeScheduleUpdateOperation extends BaseOperation<TokenFeeScheduleUpdateOperationOptions> {
    protected readonly type = "TokenFeeScheduleUpdate";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "updateTokenFeeSchedule";
    protected readonly validator = new TokenFeeScheduleUpdateValidator();

    /** Submit a `TokenFeeScheduleUpdateTransaction`. */
    async execute(options: TokenFeeScheduleUpdateOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenFeeScheduleUpdateOperationOptions,
    ): TokenFeeScheduleUpdateTransaction {
        return new TokenFeeScheduleUpdateTransaction()
            .setTokenId(options.tokenId)
            .setCustomFees(options.customFees);
    }
}
