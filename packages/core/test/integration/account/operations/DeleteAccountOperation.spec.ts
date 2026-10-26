import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { AccountService } from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

describe("AccountService.deleteAccount [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("deletes an existing account when given the account key", async () => {
        // Create a throw-away account we can delete in the same test
        const newKey = PrivateKey.generateED25519();
        const account = await client.createAccount({
            publicKey: newKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 5,
            memo: "Delete Account Integration Test",
        });
        await waitForMirrorNodeRecord();

        await client.deleteAccount({
            accountId: account.accountId,
            accountKey: newKey,
        });
        await waitForMirrorNodeRecord();

        // The mirror node keeps deleted accounts; the 5 HBAR moved to the
        // transfer account.
        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.tinybars).toBe("0");
    });
});
