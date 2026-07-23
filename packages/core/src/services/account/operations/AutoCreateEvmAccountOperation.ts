import { AccountId, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { HieroError, HieroErrorCodes } from "../../../errors/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";

/**
 * Options for auto-creating a Hollow Account by transferring HBAR to an
 * EVM address that does not yet have a Hiero account ID.
 *
 * Extends `TransactionOptions` for full control over fees, validity window,
 * additional signers, and scheduling.
 */
export interface AutoCreateEvmAccountOptions extends TransactionOptions {
    /** The EVM address to seed (e.g., `"0x1234..."`). */
    evmAddress: string;
    /** HBAR amount to transfer. Accepts a number (HBAR) or an `Hbar` instance. */
    amount: number | Hbar;
}

export class AutoCreateEvmAccountOperation {
    private readonly executor: TransactionExecutor;

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
    }

    /**
     * Auto-create EVM account execute handler.
     *
     * @returns The executor's shared fields plus `accountId` from the
     *   transfer's *child* receipt when the address was cold. A warm
     *   address leaves `accountId` `null` — the transfer landed, nothing
     *   was created.
     * @throws HieroError with code `RESULT_MAPPING_FAILED` when the
     *   transfer reached consensus but the child-receipt lookup failed —
     *   the caller must NOT resubmit; the error carries the transaction id
     *   to recover the outcome with.
     */
    async execute(options: AutoCreateEvmAccountOptions) {
        const results = await this.executor.run(this.build(options), options, {
            type: "AccountAutoCreate",
            serviceName: "AccountService",
            methodName: "autoCreateEvmAccount",
            timestamp: new Date(),
        });

        // The new hollow account id lives on the transfer's child receipt — not
        // populated on the base receipt the executor already fetched.
        let withChildren;
        try {
            withChildren = await results.response
                .getReceiptQuery(this.context.client)
                .setIncludeChildren(true)
                .execute(this.context.client);
        } catch (error) {
            // The transfer reached consensus, so a plain rethrow would read
            // as a failed transfer and invite a retry — a double transfer.
            // But mapping this failure to `accountId: null` would be worse:
            // "couldn't check" is not "warm address, nothing created". The
            // post-consensus error code says exactly what happened: the
            // transfer landed (do not resubmit); recover the outcome via
            // the transaction id.
            const cause =
                error instanceof Error ? error : new Error(String(error));
            throw new HieroError(
                `Transfer ${results.transactionId} reached consensus with ` +
                    `status ${results.status}, but fetching the child receipt ` +
                    `(which carries the created account id) failed: ` +
                    `${cause.message}. Do not resubmit the transfer — look up ` +
                    `the outcome via the transaction id.`,
                {
                    code: HieroErrorCodes.ResultMappingFailed,
                    context: "AccountService.autoCreateEvmAccount",
                    transactionId: results.transactionId,
                    cause,
                },
            );
        }

        // A warm address is not an error: the transfer landed and simply
        // created nothing — `accountId` stays null and the caller checks it.
        const child = withChildren.children.find((c) => c.accountId != null);

        return {
            ...results,
            accountId: child?.accountId ?? null,
        };
    }

    /** Schedule the hollow-account transfer. */
    async schedule(
        options: AutoCreateEvmAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.executor.scheduleRun(
            this.build(options),
            options,
            {
                type: "AccountAutoCreate",
                serviceName: "AccountService",
                methodName: "autoCreateEvmAccount",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Constructs the `TransferTransaction` that seeds the EVM address.
     */
    private build(options: AutoCreateEvmAccountOptions): TransferTransaction {
        const hbarAmount =
            options.amount instanceof Hbar
                ? options.amount
                : new Hbar(options.amount);

        return new TransferTransaction()
            .addHbarTransfer(
                this.context.operatorAccountId,
                hbarAmount.negated(),
            )
            .addHbarTransfer(
                AccountId.fromEvmAddress(0, 0, options.evmAddress),
                hbarAmount,
            );
    }
}
