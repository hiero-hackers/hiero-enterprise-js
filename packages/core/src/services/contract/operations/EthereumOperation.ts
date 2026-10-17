import type { EthereumTransactionData } from "@hiero-ledger/sdk";
import { EthereumTransaction, FileId, Hbar } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { EthereumValidator } from "../validation/index.js";
import { fetchFunctionResult } from "./functionResult.js";

/**
 * Options for relaying a signed Ethereum transaction through Hedera
 * (`EthereumTransaction`, HIP-410). Not schedulable on the network.
 */
export interface EthereumOperationOptions extends TransactionOptions {
    /**
     * The signed, RLP-encoded Ethereum transaction: raw bytes, or an SDK
     * `EthereumTransactionData` that has been signed with `.sign(key)`.
     */
    ethereumData: Uint8Array | EthereumTransactionData;
    /**
     * File holding the call data, for call data too large for the
     * transaction. The call data inside `ethereumData` must then be empty.
     */
    callDataFileId?: string | FileId;
    /**
     * Most HBAR the Hedera payer covers for gas the Ethereum sender's gas
     * price doesn't. `0` (the default) means the sender pays all of it.
     */
    maxGasAllowance?: number | Hbar;
    /**
     * Also return the EVM outcome (return data, gas used, error message)
     * on `result.functionResult`. Costs one extra paid query.
     */
    withFunctionResult?: boolean;
}

export class EthereumOperation extends BaseOperation<EthereumOperationOptions> {
    protected readonly type = "EthereumTransaction";
    protected readonly serviceName = "ContractService";
    protected readonly methodName = "executeEthereumTransaction";
    protected readonly validator = new EthereumValidator();

    /**
     * Submit the `EthereumTransaction`.
     *
     * @returns The executor's shared fields, `contractId` (the contract
     *   the receipt names: the one created or called, else `null`), and
     *   `functionResult` when `withFunctionResult` is set (else `null`)
     * @throws HieroError with code `RESULT_MAPPING_FAILED` when the
     *   transaction reached consensus but the opt-in record fetch failed
     */
    async execute(options: EthereumOperationOptions) {
        const results = await this.run(options);
        return {
            ...results,
            contractId: results.receipt.contractId ?? null,
            functionResult: options.withFunctionResult
                ? await fetchFunctionResult(
                      this.context,
                      results,
                      "ContractService.executeEthereumTransaction",
                  )
                : null,
        };
    }

    protected build(options: EthereumOperationOptions): EthereumTransaction {
        const tx = new EthereumTransaction().setEthereumData(
            options.ethereumData,
        );
        if (options.callDataFileId != null) {
            tx.setCallDataFileId(
                typeof options.callDataFileId === "string"
                    ? FileId.fromString(options.callDataFileId)
                    : options.callDataFileId,
            );
        }
        if (options.maxGasAllowance != null) {
            tx.setMaxGasAllowanceHbar(
                options.maxGasAllowance instanceof Hbar
                    ? options.maxGasAllowance
                    : new Hbar(options.maxGasAllowance),
            );
        }
        return tx;
    }
}
