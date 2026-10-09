import type BigNumber from "bignumber.js";
import type { TokenId, AccountId, Long } from "@hiero-ledger/sdk";
import { TokenWipeTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenWipeValidator } from "../validation/index.js";
import { HieroError } from "../../../errors/HieroError.js";

/**
 * Low-level options for the `TokenWipeTransaction` SDK transaction.
 *
 * Mirrors SDK props while extending `TransactionOptions`. Exactly one of
 * `amount` (fungible) or `serials` (NFT) must be supplied. The target
 * holder is identified by `accountId` — the wipe key must sign.
 *
 * Note: `TokenWipe` is not whitelisted for scheduling on the network,
 * so no `schedule()` method is exposed.
 */
export interface TokenWipeOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
    amount?: Long | number | BigNumber | bigint;
    serials?: (Long | number)[];
}

export class TokenWipeOperation extends BaseOperation<TokenWipeOperationOptions> {
    protected readonly type = "TokenWipe";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "wipeToken";
    protected readonly validator = new TokenWipeValidator();

    /**
     * Submit a `TokenWipeTransaction`.
     *
     * @returns The executor's shared fields plus the token's new total
     *   supply after the wipe, as a decimal string.
     */
    async execute(options: TokenWipeOperationOptions) {
        const results = await this.run(options);

        if (results.receipt.totalSupply == null) {
            throw new HieroError(
                "TokenWipe receipt did not include totalSupply.",
                {
                    code: "SDK_ERROR",
                    context: "TokenWipeOperation.execute",
                    sdkStatus: results.status,
                    transactionId: results.transactionId,
                },
            );
        }

        return {
            ...results,
            totalSupply: results.receipt.totalSupply.toString(),
        };
    }

    protected build(options: TokenWipeOperationOptions): TokenWipeTransaction {
        const tx = new TokenWipeTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);

        if (options.amount != null) {
            tx.setAmount(options.amount);
        }

        if (options.serials != null && options.serials.length > 0) {
            tx.setSerials(options.serials);
        }

        return tx;
    }
}
