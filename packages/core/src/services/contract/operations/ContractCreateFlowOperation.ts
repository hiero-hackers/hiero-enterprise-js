import type BigNumber from "bignumber.js";
import type {
    Key,
    Long,
    Hbar,
    AccountId,
    ContractFunctionParameters,
    ContractId,
    TransactionReceipt,
    TransactionResponse,
} from "@hiero-ledger/sdk";
import { ContractCreateFlow } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { HieroError, normalizeError } from "../../../errors/index.js";
import type { FlowOptions } from "../../transaction/index.js";
import { ContractCreateFlowValidator } from "../validation/index.js";

/**
 * Low-level options for the `ContractCreateFlow` SDK convenience.
 *
 * Use this when the contract bytecode is too large to embed inline
 * (~6KB / HIP-435) and you don't already have it uploaded as a file.
 * The flow handles the full deploy sequence internally:
 *
 *  1. `FileCreate` — uploads the first 2KB of bytecode.
 *  2. `FileAppend` — chunks any remaining bytecode (capped by `maxChunks`).
 *  3. `ContractCreate` — deploys the contract against the uploaded file.
 *  4. `FileDelete` — cleans up the bytecode file when an operator key
 *     is available (skipped otherwise).
 *
 * Flows do NOT support `TransactionOptions` (max fee, memo, validity
 * duration, node pinning) because each inner transaction is built
 * internally. Only `additionalSigners` / `externalSigners` apply — the
 * flow forwards them to every inner transaction.
 *
 * Flows also cannot be scheduled. Use the regular
 * `ContractCreateOperation` (with a pre-uploaded `bytecodeFileId`) when
 * you need scheduling.
 */
export interface ContractCreateFlowOperationOptions extends FlowOptions {
    /**
     * Raw contract bytecode. Accepts either the raw bytes or a hex string.
     * The flow uploads it via `FileCreate` + `FileAppend` so there is no
     * upper bound beyond what `maxChunks` allows.
     */
    bytecode: Uint8Array | string;
    /** Gas limit for the constructor call. Required. */
    gas: number | Long;
    /**
     * Cap on the number of `FileAppend` chunks. Each chunk is up to ~6KB.
     * Default is unlimited; set this if you want to fail fast on
     * unexpectedly large bytecode.
     */
    maxChunks?: number;
    /** Funds transferred into the new contract account on creation. */
    initialBalance?: number | bigint | string | Long | BigNumber | Hbar;
    /**
     * Admin key. Required to later update or delete the contract — without
     * it the contract is immutable.
     */
    adminKey?: Key;
    /** Parameters passed to the contract's constructor. */
    constructorParameters?: Uint8Array | ContractFunctionParameters;
    /** Contract-level memo (max 100 bytes). */
    contractMemo?: string;
    /** Auto-renew period for the contract account, in seconds. */
    autoRenewPeriod?: Long | number;
    /** Account charged for auto-renewal fees instead of the contract itself. */
    autoRenewAccountId?: string | AccountId;
    /** Account this contract stakes to. Mutually exclusive with `stakedNodeId`. */
    stakedAccountId?: string | AccountId;
    /** Node this contract stakes to. Mutually exclusive with `stakedAccountId`. */
    stakedNodeId?: Long | number;
    /** Decline staking reward distribution for this contract. */
    declineStakingReward?: boolean;
    /**
     * Allow this contract to auto-associate up to N tokens (HIP-23).
     * Note: the flow forwards this as a single integer (no `-1` /
     * HIP-904 path; pass that via the inner `ContractCreate` path if you
     * need it).
     */
    maxAutomaticTokenAssociations?: number;
}

export class ContractCreateFlowOperation {
    private readonly validator: ContractCreateFlowValidator;

    constructor(private readonly context: IHieroContext) {
        this.validator = new ContractCreateFlowValidator();
    }

    /**
     * Run the `ContractCreateFlow` end-to-end and return the new
     * contract ID. The flow drives multiple inner transactions but
     * surfaces only the final `ContractCreate` response upstream.
     *
     * Flows handle their own freeze + inner-transaction sequencing, so
     * the lifecycle (signers, execute, receipt, events) is owned by the
     * operation directly rather than by the shared `TransactionExecutor`.
     */
    async execute(options: ContractCreateFlowOperationOptions) {
        this.validator.validate(options);

        const flow = this.build(options);

        const event = {
            type: "ContractCreate",
            serviceName: "ContractService",
            methodName: "createContractFlow",
            timestamp: new Date(),
        };

        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        let result: {
            response: TransactionResponse;
            receipt: TransactionReceipt;
            transactionId: string;
            status: string;
            contractId: ContractId;
        };
        try {
            for (const key of options.additionalSigners ?? []) {
                flow.sign(key);
            }

            for (const { publicKey, sign } of options.externalSigners ?? []) {
                flow.signWith(publicKey, sign);
            }

            const response = await flow.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const transactionId = response.transactionId.toString();

            if (!receipt.contractId) {
                throw new HieroError(
                    "Contract creation failed — no contractId returned in receipt.",
                    {
                        code: "SDK_ERROR",
                        context: "ContractService.createContractFlow",
                        sdkStatus: receipt.status.toString(),
                        transactionId,
                    },
                );
            }
            result = {
                response,
                receipt,
                transactionId,
                status: receipt.status.toString(),
                contractId: receipt.contractId,
            };
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "ContractService.createContractFlow");
        }

        // Outside the try: the contract has been created.
        await this.context.emitAfterTransaction({
            ...event,
            transactionId: result.transactionId,
            status: result.status,
            durationMs: Date.now() - start,
        });

        return result;
    }

    /**
     * Construct the `ContractCreateFlow` from the caller-provided
     * options. Only setters for fields that were actually provided are
     * invoked so the SDK defaults remain in effect for omitted options.
     */
    private build(
        options: ContractCreateFlowOperationOptions,
    ): ContractCreateFlow {
        const flow = new ContractCreateFlow()
            .setBytecode(options.bytecode)
            .setGas(options.gas);

        if (options.maxChunks != null) {
            flow.setMaxChunks(options.maxChunks);
        }

        if (options.initialBalance != null) {
            flow.setInitialBalance(options.initialBalance);
        }

        if (options.adminKey != null) {
            flow.setAdminKey(options.adminKey);
        }

        if (options.constructorParameters != null) {
            flow.setConstructorParameters(options.constructorParameters);
        }

        if (options.contractMemo != null) {
            flow.setContractMemo(options.contractMemo);
        }

        if (options.autoRenewPeriod != null) {
            flow.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.autoRenewAccountId != null) {
            flow.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.stakedAccountId != null) {
            flow.setStakedAccountId(options.stakedAccountId);
        }

        if (options.stakedNodeId != null) {
            flow.setStakedNodeId(options.stakedNodeId);
        }

        if (options.declineStakingReward != null) {
            flow.setDeclineStakingReward(options.declineStakingReward);
        }

        if (options.maxAutomaticTokenAssociations != null) {
            flow.setMaxAutomaticTokenAssociations(
                options.maxAutomaticTokenAssociations,
            );
        }

        return flow;
    }
}
