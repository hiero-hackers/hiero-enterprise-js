import { describe, it, expect, beforeAll } from "vitest";
import { ContractFunctionParameters } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { ContractService } from "../../../../src/services/index.js";
import { HieroErrorCodes } from "../../../../src/errors/index.js";

/** SimpleStorage, the same contract as `ContractQueries.spec.ts`. */
const SIMPLE_STORAGE_BYTECODE_HEX =
    "608060405234801561000f575f80fd5b5060f48061001c5f395ff3fe608060405260043610602f575f3560e01c806360fe47b11460335780636d4ce63c14604f578063d0e30db014604d575b5f80fd5b348015603d575f80fd5b50604d604936600460a8565b606e565b005b3480156059575f80fd5b505f5460405190815260200160405180910390f35b5f8190556040518181527f012c78e2b84325878b1bd9d250d772cfe5bda7722d795f45036fa5e1e6e303fc9060200160405180910390a150565b5f6020828403121560b7575f80fd5b503591905056fea264697066735822122009540154e6be64adb0401ec95d58627b313e4e6d7f71ea91e91644a51371a05b64736f6c63430008140033";

describe("Mirror node contract queries", () => {
    let contractService: ContractService;
    let contractId: string;

    let operatorId: string;
    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        contractService = new ContractService(ctx);
        operatorId = ctx.client.operatorAccountId!.toString();

        const { contractId: newId } = await contractService.createContract({
            bytecode: Buffer.from(SIMPLE_STORAGE_BYTECODE_HEX, "hex"),
            gas: 200_000,
        });
        contractId = newId.toString();

        await contractService.executeContract({
            contractId,
            gas: 100_000,
            functionName: "set",
            functionParameters: new ContractFunctionParameters().addUint256(42),
        });
        await waitForMirrorNodeRecord();
    });

    describe("simulateContractCall", () => {
        it("returns the stored value as hex", async () => {
            const result = await contractService.simulateContractCall({
                contractId,
                functionName: "get",
                sender: operatorId,
            });

            expect(result).toBe(`0x${(42).toString(16).padStart(64, "0")}`);
        });

        it("rejects a call the contract reverts", async () => {
            await expect(
                contractService.simulateContractCall({
                    contractId,
                    functionName: "missing",
                }),
            ).rejects.toMatchObject({
                code: HieroErrorCodes.SdkError,
                message: expect.stringMatching(/CONTRACT_REVERT_EXECUTED/),
            });
        });
    });

    describe("estimateContractGas", () => {
        it("estimates the gas for a set() call", async () => {
            const gas = await contractService.estimateContractGas({
                contractId,
                functionName: "set",
                functionParameters: new ContractFunctionParameters().addUint256(
                    7,
                ),
            });

            expect(gas).toBeGreaterThan(21_000);
            expect(gas).toBeLessThan(100_000);
        });
    });
});
