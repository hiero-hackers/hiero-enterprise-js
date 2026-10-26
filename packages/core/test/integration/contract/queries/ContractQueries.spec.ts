import { describe, it, expect, beforeAll } from "vitest";
import { ContractFunctionParameters } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { ContractService } from "../../../../src/services/index.js";

/**
 * Same SimpleStorage contract used by the execute-operation spec:
 *
 * ```
 * pragma solidity ^0.8.20;
 * contract SimpleStorage {
 *     uint256 private storedValue;
 *     event ValueSet(uint256 value);
 *     function set(uint256 x) public { storedValue = x; emit ValueSet(x); }
 *     function get() public view returns (uint256) { return storedValue; }
 *     function deposit() public payable {}
 * }
 * ```
 */
const SIMPLE_STORAGE_BYTECODE_HEX =
    "608060405234801561000f575f80fd5b5060f48061001c5f395ff3fe608060405260043610602f575f3560e01c806360fe47b11460335780636d4ce63c14604f578063d0e30db014604d575b5f80fd5b348015603d575f80fd5b50604d604936600460a8565b606e565b005b3480156059575f80fd5b505f5460405190815260200160405180910390f35b5f8190556040518181527f012c78e2b84325878b1bd9d250d772cfe5bda7722d795f45036fa5e1e6e303fc9060200160405180910390a150565b5f6020828403121560b7575f80fd5b503591905056fea264697066735822122009540154e6be64adb0401ec95d58627b313e4e6d7f71ea91e91644a51371a05b64736f6c63430008140033";

describe("Contract queries", () => {
    let contractService: ContractService;
    let contractId: string;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        contractService = new ContractService(ctx);

        const { contractId: newId } = await contractService.createContract({
            bytecode: Buffer.from(SIMPLE_STORAGE_BYTECODE_HEX, "hex"),
            gas: 200_000,
            contractMemo: "contract-queries integration target",
        });
        contractId = newId.toString();
    });

    describe("callContract", () => {
        it("reads storedValue locally after a set() write", async () => {
            await contractService.executeContract({
                contractId,
                gas: 100_000,
                functionName: "set",
                functionParameters: new ContractFunctionParameters().addUint256(
                    42,
                ),
            });

            const result = await contractService.callContract({
                contractId,
                gas: 50_000,
                functionName: "get",
            });

            expect(result.getUint256(0).toNumber()).toBe(42);
        });
    });

    describe("getContractInfo", () => {
        it("returns the on-chain ContractInfo for a deployed contract", async () => {
            const info = await contractService.getContractInfo(contractId);

            expect(info.contractId.toString()).toBe(contractId);
            expect(info.contractMemo).toBe(
                "contract-queries integration target",
            );
            expect(info.isDeleted).toBe(false);
            // No adminKey was supplied to createContract, so the network
            // defaults it to the operator's key — assert it exists
            expect(info.adminKey).not.toBeNull();
        });
    });

    describe("getContractBytecode", () => {
        it("returns the deployed runtime bytecode as raw bytes", async () => {
            const bytecode =
                await contractService.getContractBytecode(contractId);

            expect(bytecode).toBeInstanceOf(Uint8Array);
            expect(bytecode.length).toBeGreaterThan(0);
        });
    });
});
