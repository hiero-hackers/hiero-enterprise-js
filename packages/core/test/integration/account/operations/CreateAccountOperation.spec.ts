import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import {
    waitForMirrorEntity,
    waitForMirrorNodeRecord,
} from "../../../utils/MirrorNode.js";
import { queryAccountHooks } from "../../../utils/MirrorNodeRest.js";
import {
    allowanceHook,
    deployHookContract,
} from "../../../utils/HookContract.js";
import {
    AccountService,
    ContractService,
} from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

describe("AccountService.createAccount [Integration]", () => {
    let client: AccountService;
    let contractService: ContractService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        contractService = new ContractService(ctx);
    });

    it("creates an ED25519 account with a user-provided public key", async () => {
        const newKey = PrivateKey.generateED25519();
        const account = await client.createAccount({
            publicKey: newKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 15,
            memo: "E2E Test Native",
        });

        expect(account.accountId).toBeDefined();
        expect(account.publicKey).toBeDefined();
        expect(account.evmAddress).toBeUndefined();

        await waitForMirrorNodeRecord();
        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.tinybars).toBe(String(15 * 100_000_000));
    });

    it("creates an ECDSA account with derived EVM alias", async () => {
        const ecdsaKey = PrivateKey.generateECDSA();

        const account = await client.createAccount({
            publicKey: ecdsaKey.publicKey.toString(),
            keyType: AccountType.ECDSA,
            alias: true,
            initialBalance: 5,
            memo: "EVM Alias Test",
        });

        expect(account.accountId).toBeDefined();
        expect(account.evmAddress).toBeDefined();

        await waitForMirrorNodeRecord();
        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.tinybars).toBe(String(5 * 100_000_000));
    });

    // Skipped: Solo rejects hooks with HOOKS_NOT_ENABLED. Run on a network with HIP-1195 enabled.
    it.skip("creates an account with an allowance hook (HIP-1195)", async () => {
        const hookContractId = await deployHookContract(contractService);
        const newKey = PrivateKey.generateED25519();

        const account = await client.createAccount({
            publicKey: newKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            hooks: [allowanceHook(hookContractId, 1)],
            additionalSigners: [newKey],
        });

        const hooks = await waitForMirrorEntity(
            () => queryAccountHooks(account.accountId),
            {
                predicate: (found) => found.length > 0,
                description: "account hooks",
            },
        );
        expect(hooks).toEqual([
            expect.objectContaining({
                hook_id: 1,
                contract_id: hookContractId.toString(),
                deleted: false,
            }),
        ]);
    });
});
