import type { ContractFunctionParameters } from "@hashgraph/sdk";
import {
    ContractCreateTransaction,
    ContractCreateFlow,
    ContractExecuteTransaction,
    ContractDeleteTransaction,
    FileId,
    Hbar,
} from "@hashgraph/sdk";
import type { ContractCallResult } from "../data/index.js";
import type { HieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/**
 * Service for managing smart contracts on the Hiero network.
 */
export class SmartContractClient {
    private readonly context: HieroContext;

    constructor(context: HieroContext) {
        this.context = context;
    }

    private createEvent(type: string, methodName: string): TransactionEvent {
        return {
            type,
            serviceName: "SmartContractClient",
            methodName,
            timestamp: new Date(),
        };
    }

    /**
     * Deploy a smart contract from an on-chain file containing bytecode.
     *
     * @param fileId - File ID containing the contract bytecode
     * @param gas - Gas limit for the constructor call (default: 100_000)
     * @param constructorParams - Optional constructor parameters
     * @returns The contract ID
     */
    async createContract(
        fileId: string,
        gas: number = 100_000,
        constructorParams?: ContractFunctionParameters,
    ): Promise<string> {
        const event = this.createEvent("ContractCreate", "createContract");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new ContractCreateTransaction()
                .setBytecodeFileId(FileId.fromString(fileId))
                .setGas(gas);

            if (constructorParams) {
                tx.setConstructorParameters(constructorParams);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const contractId = receipt.contractId!.toString();

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return contractId;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "SmartContractClient.createContract");
        }
    }

    /**
     * Deploy a contract from raw bytecode.
     * Uses ContractCreateFlow which handles file creation automatically.
     *
     * @param bytecode - Contract bytecode (hex string or Uint8Array)
     * @param gas - Gas limit (default: 100_000)
     * @param constructorParams - Optional constructor parameters
     * @returns The contract ID
     */
    async createContractFromBytecode(
        bytecode: string | Uint8Array,
        gas: number = 100_000,
        constructorParams?: ContractFunctionParameters,
    ): Promise<string> {
        const event = this.createEvent(
            "ContractCreateFromBytecode",
            "createContractFromBytecode",
        );
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new ContractCreateFlow()
                .setBytecode(bytecode)
                .setGas(gas);

            if (constructorParams) {
                tx.setConstructorParameters(constructorParams);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const contractId = receipt.contractId!.toString();

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return contractId;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(
                error,
                "SmartContractClient.createContractFromBytecode",
            );
        }
    }

    /**
     * Call a function on a deployed smart contract.
     *
     * @param contractId - Contract to call
     * @param functionName - Function name
     * @param gas - Gas limit (default: 100_000)
     * @param params - Optional function parameters
     * @param payableAmount - HBAR to send with the call
     * @returns The call result
     */
    async callContractFunction(
        contractId: string,
        functionName: string,
        gas: number = 100_000,
        params?: ContractFunctionParameters,
        payableAmount?: number,
    ): Promise<ContractCallResult> {
        const event = this.createEvent("ContractCall", "callContractFunction");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(gas)
                .setFunction(functionName, params);

            if (payableAmount !== undefined) {
                tx.setPayableAmount(new Hbar(payableAmount));
            }

            const response = await tx.execute(this.context.client);
            const record = await response.getRecord(this.context.client);
            const result = record.contractFunctionResult!;

            const callResult: ContractCallResult = {
                gasUsed: result.gasUsed.toNumber(),
                contractId: result.contractId?.toString() ?? contractId,
                resultBytes: Buffer.from(result.bytes).toString("hex"),
                errorMessage: result.errorMessage || undefined,
            };

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });

            return callResult;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(
                error,
                "SmartContractClient.callContractFunction",
            );
        }
    }

    /**
     * Delete a smart contract, transferring any remaining balance.
     *
     * @param contractId - Contract to delete
     * @param transferAccountId - Account to receive remaining balance
     */
    async deleteContract(
        contractId: string,
        transferAccountId: string,
    ): Promise<void> {
        const event = this.createEvent("ContractDelete", "deleteContract");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const response = await new ContractDeleteTransaction()
                .setContractId(contractId)
                .setTransferAccountId(transferAccountId)
                .execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "SmartContractClient.deleteContract");
        }
    }
}
