import { describe, it, expect, beforeAll } from "vitest";
import { AccountInfoQuery, PrivateKey, type Client } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { createTestAccount } from "../../../utils/integration-fixtures.js";
import { AccountService } from "../../../../src/services/index.js";

/**
 * Integration tests for `UpdateAccountOperation`.
 *
 * Each test creates a fresh account and reads its state back with
 * `AccountInfoQuery` against the consensus node (no mirror-node lag).
 */
describe("AccountService.updateAccount [Integration]", () => {
    let client: Client;
    let accountService: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        accountService = new AccountService(ctx);
    });

    it("updates the memo, auto-association slots and receiver signature flag", async () => {
        const account = await createTestAccount(accountService, 1);

        await accountService.updateAccount({
            accountId: account.accountId,
            memo: "updated by integration test",
            maxAutomaticTokenAssociations: 5,
            receiverSignatureRequired: true,
            additionalSigners: [account.key],
        });

        const info = await new AccountInfoQuery()
            .setAccountId(account.accountId)
            .execute(client);
        expect(info.accountMemo).toBe("updated by integration test");
        expect(info.maxAutomaticTokenAssociations.toNumber()).toBe(5);
        expect(info.isReceiverSignatureRequired).toBe(true);
    });

    it("rotates the account key when both the old and new key sign", async () => {
        const account = await createTestAccount(accountService, 1);
        const newKey = PrivateKey.generateED25519();

        await accountService.updateAccount({
            accountId: account.accountId,
            key: newKey.publicKey,
            additionalSigners: [account.key, newKey],
        });

        const info = await new AccountInfoQuery()
            .setAccountId(account.accountId)
            .execute(client);
        expect(info.key.toString()).toBe(newKey.publicKey.toString());
    });

    it("rejects an update that is not signed by the account key", async () => {
        const account = await createTestAccount(accountService, 1);

        await expect(
            accountService.updateAccount({
                accountId: account.accountId,
                memo: "should not be applied",
            }),
        ).rejects.toThrow(/INVALID_SIGNATURE/);

        const info = await new AccountInfoQuery()
            .setAccountId(account.accountId)
            .execute(client);
        expect(info.accountMemo).toBe("");
    });
});
