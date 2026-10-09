import type BigNumber from "bignumber.js";
import type { TokenId, Long } from "@hiero-ledger/sdk";
import { TokenMintTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TokenMintValidator } from "../validation/index.js";
import { HieroError } from "../../../errors/HieroError.js";

export interface TokenMintOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    amount?: Long | number | BigNumber | bigint;
    metadata?: Uint8Array[];
}

export class TokenMintOperation extends BaseOperation<TokenMintOperationOptions> {
    protected readonly type = "TokenMint";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "mintToken";
    protected readonly validator = new TokenMintValidator();

    /**
     * Submit a `TokenMintTransaction`.
     */
    async execute(options: TokenMintOperationOptions) {
        const results = await this.run(options);

        if (results.receipt.totalSupply == null) {
            throw new HieroError(
                "TokenMint receipt did not include totalSupply.",
                {
                    code: "SDK_ERROR",
                    context: "TokenMintOperation.execute",
                    sdkStatus: results.status,
                    transactionId: results.transactionId,
                },
            );
        }

        return {
            ...results,
            serials: results.receipt.serials.map((serial) => serial.toNumber()),
            totalSupply: results.receipt.totalSupply.toString(),
        };
    }

    /** Schedule a `TokenMintTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenMintOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    protected build(options: TokenMintOperationOptions): TokenMintTransaction {
        const tx = new TokenMintTransaction().setTokenId(options.tokenId);

        if (options.amount != null) {
            tx.setAmount(options.amount);
        }

        if (options.metadata != null && options.metadata.length > 0) {
            tx.setMetadata(options.metadata);
        }

        return tx;
    }
}
