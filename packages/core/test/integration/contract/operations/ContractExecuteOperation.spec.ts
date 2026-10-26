import { describe, it, expect, beforeAll } from "vitest";
import {
    MirrorNodeAccountBalanceQuery,
    type Client,
    ContractCallQuery,
    ContractFunctionParameters,
    Hbar,
} from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { ContractService } from "../../../../src/services/index.js";

/**
 * SimpleStorage — solc 0.8.20 (optimized, 200 runs) output of:
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
 *
 * Function selectors:
 * - `set(uint256)`  → `0x60fe47b1`
 * - `get()`         → `0x6d4ce63c`
 * - `deposit()`     → `0xd0e30db0`
 */
const SIMPLE_STORAGE_BYTECODE_HEX =
    "608060405234801561000f575f80fd5b5060f48061001c5f395ff3fe608060405260043610602f575f3560e01c806360fe47b11460335780636d4ce63c14604f578063d0e30db014604d575b5f80fd5b348015603d575f80fd5b50604d604936600460a8565b606e565b005b3480156059575f80fd5b505f5460405190815260200160405180910390f35b5f8190556040518181527f012c78e2b84325878b1bd9d250d772cfe5bda7722d795f45036fa5e1e6e303fc9060200160405180910390a150565b5f6020828403121560b7575f80fd5b503591905056fea264697066735822122009540154e6be64adb0401ec95d58627b313e4e6d7f71ea91e91644a51371a05b64736f6c63430008140033";

/** Reads `storedValue` via `ContractCallQuery` (no consensus write). */
async function getStoredValue(
    client: Client,
    contractId: string,
): Promise<number> {
    const result = await new ContractCallQuery()
        .setContractId(contractId)
        .setGas(50_000)
        .setFunction("get")
        .execute(client);
    return result.getUint256(0).toNumber();
}

/** Returns the contract's HBAR balance from the mirror node. */
async function getContractHbarBalance(
    client: Client,
    contractId: string,
): Promise<Hbar> {
    await waitForMirrorNodeRecord();
    const balance = await new MirrorNodeAccountBalanceQuery()
        .setAccountId(contractId)
        .execute(client);
    return balance.hbars;
}

/**
 * Polls `storedValue` until it equals `expected`. Used by the scheduled
 * flow where the inner `ContractExecute` runs asynchronously after the
 * outer `ScheduleCreate` resolves.
 */
async function waitForStoredValue(
    client: Client,
    contractId: string,
    expected: number,
    maxRetries = 10,
    delayMs = 1000,
): Promise<number> {
    let last = -1;
    for (let i = 0; i < maxRetries; i++) {
        last = await getStoredValue(client, contractId);
        if (last === expected) return last;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return last;
}

describe("ContractExecuteOperation", () => {
    let client: Client;
    let contractService: ContractService;
    let contractId: string;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        contractService = new ContractService(ctx);

        // Deploy the SimpleStorage contract using HIP-435 inline bytecode so
        // we don't depend on FileService for the execute tests.
        const { contractId: newId } = await contractService.createContract({
            bytecode: Buffer.from(SIMPLE_STORAGE_BYTECODE_HEX, "hex"),
            gas: 200_000,
            contractMemo: "execute-operation integration target",
        });
        contractId = newId.toString();
    });

    it("invokes a contract function via setFunction with ABI-typed parameters", async () => {
        await contractService.executeContract({
            contractId,
            gas: 100_000,
            functionName: "set",
            functionParameters: new ContractFunctionParameters().addUint256(42),
        });

        expect(await getStoredValue(client, contractId)).toBe(42);
    });

    it("invokes a contract function via pre-encoded raw function parameters", async () => {
        // selector("set(uint256)") || uint256(7) — bytes the SDK would have
        // built for us if we'd used `functionName` + `functionParameters`.
        const rawCallData = Buffer.from(
            "60fe47b1" +
                "0000000000000000000000000000000000000000000000000000000000000007",
            "hex",
        );

        await contractService.executeContract({
            contractId,
            gas: 100_000,
            rawFunctionParameters: new Uint8Array(rawCallData),
        });

        expect(await getStoredValue(client, contractId)).toBe(7);
    });

    it("forwards HBAR via payableAmount when calling a payable function", async () => {
        const balanceBefore = await getContractHbarBalance(client, contractId);

        await contractService.executeContract({
            contractId,
            gas: 100_000,
            functionName: "deposit",
            payableAmount: new Hbar(1),
        });

        const balanceAfter = await getContractHbarBalance(client, contractId);
        const deltaTinybars = balanceAfter
            .toTinybars()
            .subtract(balanceBefore.toTinybars());

        expect(deltaTinybars.toString()).toBe(
            new Hbar(1).toTinybars().toString(),
        );
    });

    it("schedules a contract execution and the inner call mutates state", async () => {
        const scheduled = await contractService.scheduleExecuteContract(
            {
                contractId,
                gas: 100_000,
                functionName: "set",
                functionParameters: new ContractFunctionParameters().addUint256(
                    99,
                ),
            },
            { scheduleMemo: "integration scheduled contract execute" },
        );

        expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);

        // Poll briefly to absorb any propagation lag before asserting state.
        expect(await waitForStoredValue(client, contractId, 99)).toBe(99);
    });
});
