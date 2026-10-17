import type { TransactionRecord } from "@hiero-ledger/sdk";
import {
    AccountId,
    AccountRecordsQuery as SdkAccountRecordsQuery,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

const CONTEXT = "AccountService.getAccountRecords";

/**
 * Fetch the transaction records a consensus node still holds for an
 * account (the last few minutes of its transactions). Older history is in
 * the mirror node.
 */
export class AccountRecordsQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    async execute(
        accountId: string | AccountId,
        options: QueryOptions = {},
    ): Promise<TransactionRecord[]> {
        const id = parseAccountId(accountId);
        try {
            const query = new SdkAccountRecordsQuery().setAccountId(id);
            return await this.executor.run(query, options, {
                type: "AccountRecordsQuery",
                serviceName: "AccountService",
                methodName: "getAccountRecords",
                timestamp: new Date(),
            });
        } catch (error) {
            throw normalizeError(error, CONTEXT);
        }
    }
}

/** Resolve the account ID before the query is built, as `INPUT_INVALID`. */
function parseAccountId(accountId: string | AccountId): AccountId {
    if (accountId == null) {
        throw validationError(CONTEXT, "accountId is required.");
    }
    if (typeof accountId !== "string") {
        return accountId;
    }
    try {
        return AccountId.fromString(accountId);
    } catch {
        throw validationError(
            CONTEXT,
            `accountId "${accountId}" is not a valid account ID. Expected "<shard>.<realm>.<num>".`,
        );
    }
}
