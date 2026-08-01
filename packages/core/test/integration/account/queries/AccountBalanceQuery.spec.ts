import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { AccountService } from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

describe("AccountBalanceQuery (via AccountService) [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("fetches the balance for a freshly funded account", async () => {
        const key = PrivateKey.generateED25519();
        const account = await client.createAccount({
            publicKey: key.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 7,
            memo: "AccountBalanceQuery Integration",
        });
        await waitForMirrorNodeRecord();

        const balance = await client.getAccountBalance(account.accountId);

        expect(balance.accountId).toBe(account.accountId.toString());
        expect(balance.tinybars).toBe(String(7 * 100_000_000));
        // Newly created account has no associated tokens
        expect(balance.tokens).toEqual([]);
    });

    it("fetches the balance for the configured operator account", async () => {
        const balance = await client.getOperatorAccountBalance();

        expect(balance.accountId).toBeDefined();
        // Operator balance is opaque to the test (depends on Solo state) but
        // must be a numeric string of tinybars
        expect(typeof balance.tinybars).toBe("string");
        expect(Number(balance.tinybars)).toBeGreaterThan(0);
    });
});
