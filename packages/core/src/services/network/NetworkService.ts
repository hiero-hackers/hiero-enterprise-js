import type {
    NetworkVersionInfo,
    TransactionReceipt,
    TransactionRecord,
} from "@hiero-ledger/sdk";
import {
    NetworkVersionInfoQuery,
    TransactionId,
    TransactionReceiptQuery,
    TransactionRecordQuery,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import { validationError } from "../../errors/index.js";
import type { QueryOptions } from "../transaction/index.js";
import { QueryExecutor } from "../transaction/index.js";
import { PrngOperation } from "./operations/index.js";
import type { PrngOptions } from "./operations/index.js";

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

/**
 * Public facade for cross-cutting consensus-node calls: receipt / record
 * retrieval, network version info, and pseudo-random numbers.
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
     * HIP-351), read from the transaction's record.
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
}
