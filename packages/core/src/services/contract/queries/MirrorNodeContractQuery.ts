import {
    AccountId,
    ContractFunctionParameters,
    ContractId,
    Long,
    MirrorNodeContractCallQuery,
    MirrorNodeContractEstimateQuery,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { MirrorContractCallValidator } from "../validation/index.js";

/** Largest call data the mirror node accepts, in bytes. */
const MAX_CALL_DATA_BYTES = 131_072;

/**
 * Options for simulating a contract call, or estimating its gas, on the
 * mirror node (`POST /api/v1/contracts/call`).
 *
 * Exactly one call-target form must be supplied:
 * - `functionName` (with optional ABI-typed `functionParameters`)
 * - `rawFunctionParameters` — pre-encoded ABI call data
 */
export interface MirrorNodeContractQueryOptions {
    /** Contract to call. */
    contractId: string | ContractId;
    /** Function to call; the SDK encodes it with `functionParameters`. */
    functionName?: string;
    /** ABI-typed parameters. Ignored unless `functionName` is set. */
    functionParameters?: ContractFunctionParameters;
    /** Pre-encoded call data. Mutually exclusive with `functionName`. */
    rawFunctionParameters?: Uint8Array;
    /** Account used as `msg.sender`: its alias if the ID carries one, else its long-zero EVM address. */
    sender?: string | AccountId;
    /**
     * EVM address used as `msg.sender`. Use it for an ECDSA-alias account,
     * which `sender` would turn into a long-zero address. Mutually
     * exclusive with `sender`.
     */
    senderEvmAddress?: string;
    /** Tinybars sent with the call, for `payable` functions. */
    value?: number | Long;
    /** Gas limit for the simulated call. */
    gasLimit?: number | Long;
    /** Gas price, in tinybars. */
    gasPrice?: number | Long;
}

/**
 * Read-only contract calls simulated on the mirror node's web3 API. Free,
 * and nothing reaches a consensus node, so listeners do not see them.
 */
export class MirrorNodeContractQuery {
    private readonly validator = new MirrorContractCallValidator();

    constructor(private readonly context: IHieroContext) {}

    /** Simulate the call and return its result as a `0x…` hex string. */
    async call(options: MirrorNodeContractQueryOptions): Promise<string> {
        const errorContext = "ContractService.simulateContractCall";
        this.validator.validate(options);

        try {
            const query = new MirrorNodeContractCallQuery();
            this.build(query, options);

            return await query.execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, errorContext);
        }
    }

    /** Estimate the gas the call needs. */
    async estimate(options: MirrorNodeContractQueryOptions): Promise<number> {
        const errorContext = "ContractService.estimateContractGas";
        this.validator.validate(options);

        try {
            const query = new MirrorNodeContractEstimateQuery();
            this.build(query, options);

            return await query.execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, errorContext);
        }
    }

    /** Set the options on the SDK query. */
    private build(
        query: MirrorNodeContractCallQuery | MirrorNodeContractEstimateQuery,
        options: MirrorNodeContractQueryOptions,
    ): void {
        query.setContractId(
            typeof options.contractId === "string"
                ? ContractId.fromString(options.contractId)
                : options.contractId,
        );

        if (options.functionName != null && options.functionName !== "") {
            query.setFunction(
                options.functionName,
                options.functionParameters ?? new ContractFunctionParameters(),
            );
        } else {
            // validateCallTarget guarantees rawFunctionParameters is set
            query.setFunctionParameters(options.rawFunctionParameters!);
        }

        if (query.callData!.length > MAX_CALL_DATA_BYTES) {
            throw validationError(
                "MirrorContractCallValidator",
                `Call data exceeds ${MAX_CALL_DATA_BYTES} bytes (got ${query.callData!.length}).`,
            );
        }

        if (options.sender != null) {
            query.setSender(
                typeof options.sender === "string"
                    ? AccountId.fromString(options.sender)
                    : options.sender,
            );
        }

        if (options.senderEvmAddress != null) {
            query.setSenderEvmAddress(options.senderEvmAddress);
        }

        if (options.value != null) {
            query.setValue(Long.fromValue(options.value));
        }

        if (options.gasLimit != null) {
            query.setGasLimit(Long.fromValue(options.gasLimit));
        }

        if (options.gasPrice != null) {
            query.setGasPrice(Long.fromValue(options.gasPrice));
        }
    }
}
