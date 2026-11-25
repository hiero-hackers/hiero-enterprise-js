import type { ContractId } from "@hiero-ledger/sdk";
import {
    ContractByteCodeQuery as SdkContractByteCodeQuery,
    Status,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

/**
 * Fetch the deployed runtime bytecode for a contract.
 *
 * Returns the raw bytes (not hex-encoded). Useful for proxy detection,
 * implementation comparison, or off-chain verification against a known
 * source build.
 */
export class ContractBytecodeQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    async execute(
        contractId: string | ContractId,
        options: QueryOptions = {},
    ): Promise<Uint8Array> {
        if (contractId == null) {
            throw validationError(
                "ContractService.getContractBytecode",
                "contractId is required.",
                Status.InvalidContractId,
            );
        }

        try {
            const query = new SdkContractByteCodeQuery().setContractId(
                contractId,
            );
            return await this.executor.run(query, options, {
                type: "ContractByteCodeQuery",
                serviceName: "ContractService",
                methodName: "getContractBytecode",
                timestamp: new Date(),
            });
        } catch (error) {
            throw normalizeError(error, "ContractService.getContractBytecode");
        }
    }
}
