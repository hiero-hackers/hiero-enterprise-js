import type { ContractId, ContractInfo } from "@hiero-ledger/sdk";
import {
    ContractInfoQuery as SdkContractInfoQuery,
    Status,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

/**
 * Fetch the on-chain `ContractInfo` for a deployed contract.
 *
 * Returns the SDK's `ContractInfo` directly: admin key, memo, balance,
 * expiration, auto-renew configuration, staking metadata, token
 * relationships, and `isDeleted` flag.
 */
export class ContractInfoQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    async execute(
        contractId: string | ContractId,
        options: QueryOptions = {},
    ): Promise<ContractInfo> {
        if (contractId == null) {
            throw validationError(
                "ContractService.getContractInfo",
                "contractId is required.",
                Status.InvalidContractId,
            );
        }

        try {
            const query = new SdkContractInfoQuery().setContractId(contractId);
            return await this.executor.run(query, options, {
                type: "ContractInfoQuery",
                serviceName: "ContractService",
                methodName: "getContractInfo",
                timestamp: new Date(),
            });
        } catch (error) {
            throw normalizeError(error, "ContractService.getContractInfo");
        }
    }
}
