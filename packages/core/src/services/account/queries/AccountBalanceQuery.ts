import type { AccountId } from "@hiero-ledger/sdk";
import { AccountBalanceQuery as SdkAccountBalanceQuery } from "@hiero-ledger/sdk";
import type { Balance } from "../../../types/index.js";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

export class AccountBalanceQuery {
    constructor(private readonly context: IHieroContext) {}

    /** Get account balance execute handler. */
    async execute(accountId: string | AccountId): Promise<Balance> {
        try {
            const balance = await new SdkAccountBalanceQuery()
                .setAccountId(accountId)
                .execute(this.context.client);

            const tokens = [];
            if (balance.tokens) {
                for (const [tokenId, amount] of balance.tokens) {
                    tokens.push({
                        tokenId: tokenId.toString(),
                        balance: amount.toString(),
                        decimals: balance.tokenDecimals?.get(tokenId) ?? 0,
                    });
                }
            }

            return {
                accountId: accountId.toString(),
                tinybars: balance.hbars.toTinybars().toString(),
                tokens,
            };
        } catch (error) {
            throw normalizeError(error, "AccountService.getAccountBalance");
        }
    }
}
