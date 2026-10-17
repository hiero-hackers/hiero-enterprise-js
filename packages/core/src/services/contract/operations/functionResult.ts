import type { TransactionResponse } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { HieroError, HieroErrorCodes } from "../../../errors/index.js";

/**
 * Fetch the record of a contract transaction that reached consensus and
 * return its EVM outcome (return data hex, gas used, revert message), or
 * `null` when the record carries none.
 *
 * Queries the record directly rather than via `response.getRecord()`: the
 * SDK method first re-fetches the receipt, which the executor has already
 * awaited.
 *
 * @throws HieroError with code `RESULT_MAPPING_FAILED` when the record
 *   fetch fails; the transaction landed, so the caller must not resubmit.
 */
export async function fetchFunctionResult(
    context: IHieroContext,
    results: {
        response: TransactionResponse;
        status: string;
        transactionId: string;
    },
    errorContext: string,
) {
    let record;
    try {
        record = await results.response
            .getRecordQuery(context.client)
            .execute(context.client);
    } catch (error) {
        // A plain rethrow would read as a failed transaction and invite a
        // resubmit; say what happened and hand back the transaction id.
        const reason = error instanceof Error ? error.message : String(error);
        throw new HieroError(
            `Transaction ${results.transactionId} reached consensus ` +
                `with status ${results.status}, but fetching its record ` +
                `for the function result failed: ${reason}. Do ` +
                `not resubmit — look up the outcome via the transaction id.`,
            {
                code: HieroErrorCodes.ResultMappingFailed,
                context: errorContext,
                transactionId: results.transactionId,
                cause: error,
            },
        );
    }

    const fn = record.contractFunctionResult;
    return fn
        ? {
              returnDataHex: `0x${Buffer.from(fn.bytes).toString("hex")}`,
              gasUsed: fn.gasUsed.toNumber(),
              errorMessage:
                  fn.errorMessage != null && fn.errorMessage !== ""
                      ? fn.errorMessage
                      : null,
          }
        : null;
}
