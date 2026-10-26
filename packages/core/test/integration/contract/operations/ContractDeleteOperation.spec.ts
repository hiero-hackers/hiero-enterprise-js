import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import {
    waitForMirrorEntity,
    waitForMirrorNodeRecord,
} from "../../../utils/MirrorNode.js";
import { queryContractInfo } from "../../../utils/MirrorNodeRest.js";
import { ContractService } from "../../../../src/services/index.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. Keeps the per-test deploy cheap on the local
 * Solo network. The delete tests don't invoke any contract function, so
 * a non-callable runtime is fine.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

describe("ContractDeleteOperation", () => {
    let contractService: ContractService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        contractService = new ContractService(ctx);
    });

    /**
     * Deploy a fresh contract with an admin key so the delete tests can
     * sign the delete transaction. Contracts without an admin key are
     * immutable and the network refuses to delete them.
     */
    async function deployDeletableContract(
        adminKey: PrivateKey,
    ): Promise<string> {
        const { contractId } = await contractService.createContract({
            bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
            gas: 150_000,
            adminKey: adminKey.publicKey,
            additionalSigners: [adminKey],
        });
        return contractId.toString();
    }

    it("deletes a contract and transfers the remaining balance to an account", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractId = await deployDeletableContract(adminKey);

        await contractService.deleteContract({
            contractId,
            transferAccountId: "0.0.2",
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await waitForMirrorEntity(
            () => queryContractInfo(contractId),
            {
                predicate: (info) => info.deleted === true,
                description: `contract ${contractId} deleted=true`,
            },
        );
        expect(info.deleted).toBe(true);
    });

    it("deletes a contract with a contract as the transfer target", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractToDelete = await deployDeletableContract(adminKey);
        const sinkContract = await deployDeletableContract(
            PrivateKey.generateED25519(),
        );

        await contractService.deleteContract({
            contractId: contractToDelete,
            transferContractId: sinkContract,
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await waitForMirrorEntity(
            () => queryContractInfo(contractToDelete),
            {
                predicate: (info) => info.deleted === true,
                description: `contract ${contractToDelete} deleted=true`,
            },
        );
        expect(info.deleted).toBe(true);
    });

    it("schedules a contract delete and returns a scheduleId", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractId = await deployDeletableContract(adminKey);

        const scheduled = await contractService.scheduleDeleteContract(
            {
                contractId,
                transferAccountId: "0.0.2",
                additionalSigners: [adminKey],
            },
            { scheduleMemo: "integration scheduled contract delete" },
        );

        expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
    });
});
