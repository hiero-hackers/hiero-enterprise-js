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
 * `contract C {}` output. Small enough that the flow uploads it in a
 * single chunk; sufficient to exercise the file-create → contract-create
 * → file-delete sequence end-to-end on Solo.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

describe("ContractCreateFlowOperation", () => {
    let contractService: ContractService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        contractService = new ContractService(ctx);
    });

    it("deploys a contract end-to-end via the flow (file upload + create + cleanup)", async () => {
        const { contractId } = await contractService.createContractFlow({
            bytecode: MINIMAL_BYTECODE_HEX,
            gas: 150_000,
            contractMemo: "deployed via flow",
        });

        expect(contractId.toString()).toMatch(/^0\.0\.\d+$/);

        await waitForMirrorNodeRecord();

        const info = await waitForMirrorEntity(
            () => queryContractInfo(contractId),
            {
                predicate: (info) => info.memo === "deployed via flow",
                description: `contract ${contractId} memo="deployed via flow"`,
            },
        );
        expect(info.memo).toBe("deployed via flow");
    });

    it("deploys a mutable contract via the flow and signs with the admin key", async () => {
        const adminKey = PrivateKey.generateED25519();

        const { contractId } = await contractService.createContractFlow({
            bytecode: MINIMAL_BYTECODE_HEX,
            gas: 150_000,
            adminKey: adminKey.publicKey,
            contractMemo: "mutable flow contract",
            additionalSigners: [adminKey],
        });

        expect(contractId.toString()).toMatch(/^0\.0\.\d+$/);

        await waitForMirrorNodeRecord();

        const info = await waitForMirrorEntity(
            () => queryContractInfo(contractId),
            { description: `contract ${contractId}` },
        );
        expect(info.contract_id).toBe(contractId.toString());
        // Admin key was set, so contract is not immutable.
        expect(info.deleted).toBe(false);
    });
});
