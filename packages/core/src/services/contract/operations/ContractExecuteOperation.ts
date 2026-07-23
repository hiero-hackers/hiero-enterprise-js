import type BigNumber from "bignumber.js";
import type {
    Long,
    Hbar,
    ContractId,
    ContractFunctionParameters,
} from "@hiero-ledger/sdk";
import { ContractExecuteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { HieroError, HieroErrorCodes } from "../../../errors/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { ContractExecuteValidator } from "../validation/index.js";

/**
 * Low-level options for the `ContractExecute` SDK transaction.
 *
 * Mirrors the surface of `ContractExecuteTransaction`. Callers usually
 * go through `ContractService.executeContract`, which exposes a
 * friendlier shape. Use this directly when you need full control over
 * every field.
 *
 * Exactly one call-target form must be supplied:
 * - `functionName` (with optional ABI-typed `functionParameters`) — the
 *   common path; the SDK encodes the call data for you.
 * - `rawFunctionParameters` — pre-encoded ABI bytes for advanced
 *   callers that build call data themselves.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface ContractExecuteOperationOptions extends TransactionOptions {
    /** Contract to invoke. */
    contractId: string | ContractId;
    /** Gas limit for the call. Required. */
    gas: number | Long;
    /**
     * Name of the contract function to invoke. Combined with
     * `functionParameters` (if provided) via `setFunction(name, params)`.
     * Mutually exclusive with `rawFunctionParameters`.
     */
    functionName?: string;
    /**
     * ABI-typed parameters for the function call. Ignored unless
     * `functionName` is also set.
     */
    functionParameters?: ContractFunctionParameters;
    /**
     * Pre-encoded ABI call data (function selector + arguments).
     * Mutually exclusive with `functionName`.
     */
    rawFunctionParameters?: Uint8Array;
    /**
     * HBAR forwarded to the contract with the call (for `payable`
     * functions). Defaults to `0` when omitted.
     */
    payableAmount?: number | string | Long | BigNumber | Hbar | bigint;
    /**
     * Also return the function's EVM outcome (return data, gas used,
     * error message) on `result.functionResult`. **Costs one extra paid
     * query**: the outcome lives on the transaction *record*, not the
     * receipt, so it is only fetched when this is set.
     */
    withFunctionResult?: boolean;
}

export class ContractExecuteOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: ContractExecuteValidator;

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new ContractExecuteValidator();
    }

    /**
     * Submit a `ContractExecuteTransaction`.
     *
     * @returns The executor's shared fields plus `functionResult` — the
     *   EVM outcome (return data hex, gas used, revert message) when the
     *   call opts in via `withFunctionResult: true`; `null` otherwise
     *   (and when the record carries no function result).
     * @throws HieroError with code `RESULT_MAPPING_FAILED` when the
     *   transaction reached consensus but the opt-in record fetch failed —
     *   the caller must NOT resubmit; the error carries the transaction id
     *   to recover the outcome with.
     */
    async execute(options: ContractExecuteOperationOptions) {
        this.validator.validate(options);

        const tx = this.build(options);

        const results = await this.executor.run(tx, options, {
            type: "ContractExecute",
            serviceName: "ContractService",
            methodName: "executeContract",
            timestamp: new Date(),
        });

        if (!options.withFunctionResult) {
            return { ...results, functionResult: null };
        }

        // The EVM outcome lives on the transaction *record* — a separate,
        // paid query, which is why it is opt-in. Query it directly rather
        // than via response.getRecord(): the SDK method first re-fetches
        // the receipt to await consensus, which the executor has already
        // done — skipping it saves a pointless round-trip before the paid
        // query.
        let record;
        try {
            record = await results.response
                .getRecordQuery(this.context.client)
                .execute(this.context.client);
        } catch (error) {
            // The call reached consensus — only fetching its record
            // failed. A plain rethrow would read as a failed transaction
            // and invite a resubmit; say what actually happened and hand
            // back the transaction id to recover the outcome with.
            const cause =
                error instanceof Error ? error : new Error(String(error));
            throw new HieroError(
                `Transaction ${results.transactionId} reached consensus ` +
                    `with status ${results.status}, but fetching its record ` +
                    `for the function result failed: ${cause.message}. Do ` +
                    `not resubmit — look up the outcome via the transaction id.`,
                {
                    code: HieroErrorCodes.ResultMappingFailed,
                    context: "ContractService.executeContract",
                    transactionId: results.transactionId,
                    cause,
                },
            );
        }

        const fn = record.contractFunctionResult;

        return {
            ...results,
            functionResult: fn
                ? {
                      returnDataHex: `0x${Buffer.from(fn.bytes).toString("hex")}`,
                      gasUsed: fn.gasUsed.toNumber(),
                      errorMessage:
                          fn.errorMessage != null && fn.errorMessage !== ""
                              ? fn.errorMessage
                              : null,
                  }
                : null,
        };
    }

    /** Schedule a `ContractExecuteTransaction` for deferred multi-sig execution. */
    async schedule(
        options: ContractExecuteOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "ContractExecute",
                serviceName: "ContractService",
                methodName: "executeContract",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Construct the `ContractExecuteTransaction` from the caller-provided
     * options.
     *
     * Only setters for fields that were actually provided are invoked so
     * the SDK defaults remain in effect for omitted options.
     */
    private build(
        options: ContractExecuteOperationOptions,
    ): ContractExecuteTransaction {
        const tx = new ContractExecuteTransaction()
            .setContractId(options.contractId)
            .setGas(options.gas);

        if (options.functionName != null && options.functionName !== "") {
            tx.setFunction(options.functionName, options.functionParameters);
        } else {
            tx.setFunctionParameters(options.rawFunctionParameters!);
        }

        if (options.payableAmount != null) {
            tx.setPayableAmount(options.payableAmount);
        }

        return tx;
    }
}
