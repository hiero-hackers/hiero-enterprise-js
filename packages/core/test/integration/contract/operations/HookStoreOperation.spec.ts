import { describe, it, expect, beforeAll } from "vitest";
import { EvmHookStorageSlot, PrivateKey } from "@hiero-ledger/sdk";
import type { ContractId } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorEntity } from "../../../utils/mirror-node.js";
import { queryHookStorage } from "../../../utils/mirror-node-rest.js";
import {
    allowanceHook,
    deployHookContract,
} from "../../../utils/hook-contract.js";
import {
    AccountService,
    ContractService,
} from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. Owns the hook in the contract-owner test.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

// Skipped: Solo rejects hooks with HOOKS_NOT_ENABLED. Run on a network with HIP-1195 enabled.
describe.skip("ContractService.updateHookStorage [Integration]", () => {
    let accountService: AccountService;
    let contractService: ContractService;
    let hookContractId: ContractId;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        contractService = new ContractService(ctx);
        hookContractId = await deployHookContract(contractService);
    });

    it("stores a slot in an account's hook, signed by the owner", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const { accountId } = await accountService.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            hooks: [allowanceHook(hookContractId, 1)],
            additionalSigners: [ownerKey],
        });

        await contractService.updateHookStorage({
            accountId,
            hookId: 1,
            storageUpdates: [
                new EvmHookStorageSlot({
                    key: new Uint8Array([0x01]),
                    value: new Uint8Array([0x2a]),
                }),
            ],
            additionalSigners: [ownerKey],
        });

        const storage = await waitForMirrorEntity(
            () => queryHookStorage(accountId, 1),
            {
                predicate: (slots) => slots.length > 0,
                description: "hook storage",
            },
        );
        expect(
            storage.map((slot) => [BigInt(slot.key), BigInt(slot.value ?? 0)]),
        ).toEqual([[1n, 42n]]);
    });

    it("stores a slot in a contract's hook, signed by the hook admin key", async () => {
        const hookAdminKey = PrivateKey.generateED25519();
        const { contractId } = await contractService.createContract({
            bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
            gas: 150_000,
            hooks: [
                allowanceHook(hookContractId, 2).setAdminKey(
                    hookAdminKey.publicKey,
                ),
            ],
        });

        const result = await contractService.updateHookStorage({
            contractId,
            hookId: 2,
            storageUpdates: [
                new EvmHookStorageSlot({
                    key: new Uint8Array([0x02]),
                    value: new Uint8Array([0x07]),
                }),
            ],
            additionalSigners: [hookAdminKey],
        });

        expect(result.status).toBe("SUCCESS");
    });
});
