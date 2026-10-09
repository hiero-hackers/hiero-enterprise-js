import type BigNumber from "bignumber.js";
import type { TokenId, Long } from "@hiero-ledger/sdk";
import { TokenBurnTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TokenBurnValidator } from "../validation/index.js";
import { HieroError } from "../../../errors/HieroError.js";

/**
 * Low-level options for the `TokenBurnTransaction` SDK transaction.
 *
 * Mirrors SDK props while extending `TransactionOptions`. Exactly one of
 * `amount` (fungible) or `serials` (NFT) must be supplied.
 */
export interface TokenBurnOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    amount?: Long | number | BigNumber | bigint;
    serials?: (Long | number)[];
}

export class TokenBurnOperation extends BaseOperation<TokenBurnOperationOptions> {
    protected readonly type = "TokenBurn";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "burnToken";
    protected readonly validator = new TokenBurnValidator();

    /**
     * Submit a `TokenBurnTransaction`.
     *
     * @returns The executor's shared fields plus the token's new total
     *   supply after the burn (a decimal string — supplies can exceed 2^53).
     */
    async execute(options: TokenBurnOperationOptions) {
        const results = await this.run(options);

        if (results.receipt.totalSupply == null) {
            throw new HieroError(
                "TokenBurn receipt did not include totalSupply.",
                {
                    code: "SDK_ERROR",
                    context: "TokenBurnOperation.execute",
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

    /** Schedule a `TokenBurnTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenBurnOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    protected build(options: TokenBurnOperationOptions): TokenBurnTransaction {
        const tx = new TokenBurnTransaction().setTokenId(options.tokenId);

        if (options.amount != null) {
            tx.setAmount(options.amount);
        }

        if (options.serials != null && options.serials.length > 0) {
            tx.setSerials(options.serials);
        }

        return tx;
    }
}
