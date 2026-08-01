import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { AccountService } from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

describe("AccountService.createAccount [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
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

        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.tinybars).toBe(String(5 * 100_000_000));
    });
});
