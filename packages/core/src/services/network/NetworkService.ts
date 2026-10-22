import type {
    FeeEstimate,
    NetworkVersionInfo,
    NodeAddressBook,
    TransactionReceipt,
    TransactionRecord,
} from "@hiero-ledger/sdk";
import {
    AddressBookQuery,
    FeeEstimateMode,
    FeeEstimateQuery,
    FileId,
    Transaction,
    NetworkVersionInfoQuery,
    TransactionId,
    TransactionReceiptQuery,
    TransactionRecordQuery,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import { normalizeError, validationError } from "../../errors/index.js";
import type { QueryOptions } from "../transaction/index.js";
import { QueryExecutor } from "../transaction/index.js";
import { PrngOperation } from "./operations/index.js";
import type { PrngOptions } from "./operations/index.js";

/** Options for fetching the network's node address book. */
export interface GetAddressBookOptions {
    /** Address book file to read: `0.0.102` (default) or `0.0.101`. */
    fileId?: string | FileId;
    /** Return at most this many nodes. */
    limit?: number;
}

/** Options for estimating a transaction's fee. */
export interface EstimateFeeOptions {
    /**
     * `FeeEstimateMode.INTRINSIC` (default) prices the payload alone;
     * `FeeEstimateMode.STATE` also uses the mirror node's latest state.
     */
    mode?: (typeof FeeEstimateMode)[keyof typeof FeeEstimateMode];
    /** High-volume throttle utilization in basis points, 0 to 10000 (default 0). */
    highVolumeThrottle?: number;
}

/** One extra charge within a fee component. Amounts are in tinycents. */
export interface FeeExtraEstimate {
    /** Name of the extra, e.g. `"SIGNATURES"` */
    name: string;
    /** Units included in the base fee */
    included: number;
    /** Units the transaction uses */
    count: number;
    /** Units charged beyond the included ones */
    charged: number;
    /** Fee per charged unit in tinycents — decimal string */
    feePerUnit: string;
    /** Fee for the charged units in tinycents — decimal string */
    subtotal: string;
}

/** A node or service fee component. Amounts are in tinycents. */
export interface FeeComponentEstimate {
    /** Base fee in tinycents — decimal string */
    base: string;
    /** Extra charges on top of the base fee */
    extras: FeeExtraEstimate[];
}

/**
 * A transaction's estimated fee (HIP-1261). Amounts are in **tinycents**
 * (1/100,000,000 of a US cent), not tinybars; convert with the exchange rate.
 */
export interface FeeEstimateResult {
    /** Network fee: the node fee times `multiplier` */
    network: {
        multiplier: number;
        /** Network fee in tinycents — decimal string */
        subtotal: string;
    };
    /** Fee paid to the submitting node */
    node: FeeComponentEstimate;
    /** Fee for executing the transaction */
    service: FeeComponentEstimate;
    /** High-volume pricing multiplier (HIP-1313); 1 when none applies */
    highVolumeMultiplier: number;
    /** Sum of the network, node and service fees in tinycents — decimal string */
    total: string;
}

/**
 * Options for fetching a transaction receipt.
 *
 * Extends the common {@link QueryOptions} (payer, payment caps, node
 * targeting) with the fields specific to receipt queries.
 */
export interface GetTransactionReceiptOptions extends QueryOptions {
    /**
     * The transaction whose receipt should be fetched. Accepts either a
     * canonical string ID (`"0.0.123@1700000000.000000000"`) or a
     * `TransactionId` instance.
     */
    transactionId: string | TransactionId;
    /**
     * Also fetch the receipts of any child transactions spawned by the
     * original transaction (e.g., contract calls that trigger transfers,
     * scheduled transactions).
     */
    includeChildren?: boolean;
    /**
     * Also fetch receipts of duplicate submissions of the same transaction
     * ID across different nodes.
     */
    includeDuplicates?: boolean;
}

/**
 * Options for fetching a transaction record (identical surface to
 * {@link GetTransactionReceiptOptions}).
 */
export type GetTransactionRecordOptions = GetTransactionReceiptOptions;

/**
 * Resolve a caller-supplied transaction ID before any query is built.
 *
 * The SDK's `TransactionId.fromString` throws a raw `TypeError` for
 * malformed strings (e.g. `"abc"`), so string input is parsed here and
 * rejected as `INPUT_INVALID`, like the other input validators.
 *
 * @param transactionId - String or `TransactionId` from the options
 * @param context - The `NetworkService` method validating the input
 * @returns The parsed `TransactionId`
 */
function parseTransactionId(
    transactionId: string | TransactionId,
    context: string,
): TransactionId {
    if (transactionId == null) {
        throw validationError(context, "transactionId is required.");
    }
    if (typeof transactionId !== "string") {
        return transactionId;
    }
    try {
        return TransactionId.fromString(transactionId);
    } catch {
        throw validationError(
            context,
            `transactionId "${transactionId}" is not a valid transaction ID. Expected "<shard>.<realm>.<num>@<seconds>.<nanos>".`,
        );
    }
}

/** Convert an SDK fee component to plain data. */
function toFeeComponent(fee: FeeEstimate): FeeComponentEstimate {
    return {
        base: fee.base.toString(),
        extras: fee.extras.map((extra) => ({
            name: extra.name,
            included: extra.included,
            count: extra.count,
            charged: extra.charged,
            feePerUnit: extra.feePerUnit.toString(),
            subtotal: extra.subtotal.toString(),
        })),
    };
}

/**
 * Public facade for cross-cutting network calls: receipt / record
 * retrieval, network version info, pseudo-random numbers, the node address
 * book and fee estimates.
 *
 * Use this when you need to query the outcome of a transaction whose
 * `TransactionResponse` you do not have (e.g., submitted out-of-band, by
 * another process, or by a UI), or when you need to inspect the running
 * HAPI / protobuf version of the network.
 *
 * @example
 * ```ts
 * const networkService = new NetworkService(context);
 *
 * // Poll for the receipt of a transaction submitted elsewhere
 * const receipt = await networkService.getTransactionReceipt({
 *     transactionId: "0.0.1234@1700000000.000000000",
 * });
 *
 * // Inspect what the network is running
 * const version = await networkService.getNetworkVersionInfo();
 * console.log(version.servicesVersion.major);
 * ```
 */
export class NetworkService {
    private readonly queryExecutor: QueryExecutor;
    private readonly prngOperation: PrngOperation;

    constructor(private readonly context: IHieroContext) {
        this.queryExecutor = new QueryExecutor(context);
        this.prngOperation = new PrngOperation(context);
    }

    /**
     * Get a pseudo-random value from the network (`PrngTransaction`,
     * HIP-351), read from the transaction's record. There is no scheduled
     * variant: a scheduled PRNG's value lands in the scheduled execution's
     * record, not this call's.
     *
     * @param options.range - Upper bound (exclusive) for an integer in
     *   `[0, range)`, from 1 to 2147483647; omit it for 384 bits of bytes
     * @returns The executor result plus `prngNumber` (with `range`) or
     *   `prngBytes` (without); the other is `null`
     *
     * @example
     * ```ts
     * const { prngNumber } = await networkService.generateRandom({ range: 100 });
     * ```
     */
    async generateRandom(options?: PrngOptions) {
        return await this.prngOperation.execute(options);
    }

    /**
     * Fetch the receipt for a transaction by its ID.
     *
     * Polls until the receipt is available or the SDK's retry budget is
     * exhausted. Failures (including `RECEIPT_NOT_FOUND` and consensus
     * status errors) are normalised to `HieroError`.
     *
     * @param options.transactionId - Transaction whose receipt to fetch (string or `TransactionId`)
     * @param options.includeChildren - Also fetch receipts of child transactions
     * @param options.includeDuplicates - Also fetch duplicate receipts across nodes
     */
    async getTransactionReceipt(
        options: GetTransactionReceiptOptions,
    ): Promise<TransactionReceipt> {
        const txId = parseTransactionId(
            options.transactionId,
            "NetworkService.getTransactionReceipt",
        );

        const query = new TransactionReceiptQuery().setTransactionId(txId);

        if (options.includeChildren != null) {
            query.setIncludeChildren(options.includeChildren);
        }
        if (options.includeDuplicates != null) {
            query.setIncludeDuplicates(options.includeDuplicates);
        }

        return await this.queryExecutor.run(query, options, {
            type: "TransactionReceiptQuery",
            serviceName: "NetworkService",
            methodName: "getTransactionReceipt",
            timestamp: new Date(),
            transactionId: txId.toString(),
        });
    }

    /**
     * Fetch the full record for a transaction by its ID.
     *
     * Records include the receipt plus fees, transfers, token transfers,
     * contract function results, and child records — everything the
     * network has to say about a transaction.
     *
     * Note: records are not retained indefinitely. For transactions older
     * than the network's record retention window, use the mirror node
     * (`TransactionRepository.findById`).
     *
     * @param options.transactionId - Transaction whose record to fetch (string or `TransactionId`)
     * @param options.includeChildren - Also fetch child transaction records
     * @param options.includeDuplicates - Also fetch duplicate records across nodes
     */
    async getTransactionRecord(
        options: GetTransactionRecordOptions,
    ): Promise<TransactionRecord> {
        const txId = parseTransactionId(
            options.transactionId,
            "NetworkService.getTransactionRecord",
        );

        const query = new TransactionRecordQuery().setTransactionId(txId);

        if (options.includeChildren != null) {
            query.setIncludeChildren(options.includeChildren);
        }
        if (options.includeDuplicates != null) {
            query.setIncludeDuplicates(options.includeDuplicates);
        }

        return await this.queryExecutor.run(query, options, {
            type: "TransactionRecordQuery",
            serviceName: "NetworkService",
            methodName: "getTransactionRecord",
            timestamp: new Date(),
            transactionId: txId.toString(),
        });
    }

    /**
     * Fetch the HAPI and protobuf versions the network is running.
     *
     * Useful for diagnostics, health checks, and detecting compatibility
     * issues against custom / local networks.
     *
     * @param options - Optional query options (payer, payment caps, node targeting).
     */
    async getNetworkVersionInfo(
        options: QueryOptions = {},
    ): Promise<NetworkVersionInfo> {
        const query = new NetworkVersionInfoQuery();

        return await this.queryExecutor.run(query, options, {
            type: "NetworkVersionInfoQuery",
            serviceName: "NetworkService",
            methodName: "getNetworkVersionInfo",
            timestamp: new Date(),
        });
    }

    /**
     * Fetch the node address book from the mirror node's gRPC API: each
     * consensus node's ID, account, description, endpoints (IP or domain
     * name, and port) and public key.
     * Custom networks need `mirrorNetwork` set in the config.
     *
     * @param options.fileId - `0.0.102` (default) or `0.0.101`
     * @param options.limit - Return at most this many nodes
     * @returns The SDK `NodeAddressBook`
     */
    async getAddressBook(
        options: GetAddressBookOptions = {},
    ): Promise<NodeAddressBook> {
        const context = "NetworkService.getAddressBook";
        if (
            options.limit != null &&
            (!Number.isInteger(options.limit) || options.limit < 1)
        ) {
            throw validationError(
                context,
                `limit must be an integer >= 1, got ${options.limit}.`,
            );
        }
        // The mirror node serves only the two address book files.
        const fileId = options.fileId ?? FileId.ADDRESS_BOOK;
        const num = fileId.toString().split(".")[2];
        if (num !== "101" && num !== "102") {
            throw validationError(
                context,
                `fileId must be the address book file 0.0.101 or 0.0.102, got "${fileId.toString()}".`,
            );
        }

        // A mirror-node stream, not a paid consensus query, so it skips
        // QueryExecutor (like the mirror-backed balance queries).
        const query = new AddressBookQuery().setFileId(fileId);
        if (options.limit != null) {
            query.setLimit(options.limit);
        }
        try {
            return await query.execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, context);
        }
    }

    /**
     * Estimate a transaction's fee from the mirror node
     * (`POST /api/v1/network/fees`, HIP-1261) without submitting it.
     *
     * A copy is estimated, so the transaction is not frozen in place; an
     * unfrozen copy is frozen with the client's operator as payer. An
     * unsigned transaction under-counts signature costs: sign it first, or
     * expect the charged fee to be higher. A mirror-node REST call, so it
     * skips `QueryExecutor` and listeners are not notified.
     *
     * @param transaction - Any SDK transaction, frozen or not
     * @param options.mode - `FeeEstimateMode.INTRINSIC` (default) or `STATE`
     * @param options.highVolumeThrottle - Basis points, 0 to 10000
     * @returns The fee components and total, in tinycents
     *
     * @example
     * ```ts
     * const tx = new TransferTransaction()
     *     .addHbarTransfer("0.0.1234", new Hbar(-1))
     *     .addHbarTransfer("0.0.5678", new Hbar(1));
     * const { total } = await networkService.estimateFee(tx);
     * ```
     */
    async estimateFee(
        transaction: Transaction,
        options: EstimateFeeOptions = {},
    ): Promise<FeeEstimateResult> {
        const context = "NetworkService.estimateFee";
        if (transaction == null) {
            throw validationError(context, "transaction is required.");
        }

        const modes: number[] = Object.values(FeeEstimateMode);
        if (options.mode != null && !modes.includes(options.mode)) {
            throw validationError(
                context,
                `mode must be FeeEstimateMode.STATE (0) or FeeEstimateMode.INTRINSIC (1), got ${options.mode}.`,
            );
        }

        const throttle = options.highVolumeThrottle;
        if (
            throttle != null &&
            (!Number.isInteger(throttle) || throttle < 0 || throttle > 10000)
        ) {
            throw validationError(
                context,
                `highVolumeThrottle must be an integer from 0 to 10000, got ${throttle}.`,
            );
        }

        try {
            // execute() freezes the transaction it is given, so estimate a copy.
            const copy = Transaction.fromBytes(transaction.toBytes());
            const query = new FeeEstimateQuery().setTransaction(copy);
            if (options.mode != null) {
                query.setMode(options.mode);
            }

            if (throttle != null) {
                query.setHighVolumeThrottle(throttle);
            }

            const fee = await query.execute(this.context.client);

            return {
                network: {
                    multiplier: fee.networkFee.multiplier,
                    subtotal: fee.networkFee.subtotal.toString(),
                },
                node: toFeeComponent(fee.nodeFee),
                service: toFeeComponent(fee.serviceFee),
                highVolumeMultiplier: fee.highVolumeMultiplier.toNumber(),
                total: fee.total.toString(),
            };
        } catch (error) {
            throw normalizeError(error, context);
        }
    }
}
