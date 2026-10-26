import { describe, it, expect, beforeAll } from "vitest";
import { Hbar, PrivateKey, TransferTransaction } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { createTestAccount } from "../../../utils/IntegrationFixtures.js";
import type { HieroContext } from "../../../../src/context/HieroContext.js";
import { AccountService } from "../../../../src/services/index.js";

describe("AccountSignatureQuery (via AccountService) [Integration]", () => {
    let ctx: HieroContext;
    let client: AccountService;

    beforeAll(() => {
        ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    describe("verifyAccountSignature", () => {
        it("returns true for a signature produced by the account's key", async () => {
            const account = await createTestAccount(client, 1);
            const message = Buffer.from("hello hiero");
            const signature = account.key.sign(message);

            const result = await client.verifyAccountSignature(
                account.accountId,
                message,
                signature,
            );

            expect(result).toBe(true);
        });

        it("returns false when the signature was produced by a different key", async () => {
            const account = await createTestAccount(client, 1);
            const wrongKey = PrivateKey.generateED25519();
            const message = Buffer.from("hello hiero");
            const wrongSignature = wrongKey.sign(message);

            const result = await client.verifyAccountSignature(
                account.accountId,
                message,
                wrongSignature,
            );

            expect(result).toBe(false);
        });

        it("returns false when the message has been tampered with", async () => {
            const account = await createTestAccount(client, 1);
            const original = Buffer.from("original");
            const signature = account.key.sign(original);

            const result = await client.verifyAccountSignature(
                account.accountId,
                Buffer.from("tampered"),
                signature,
            );

            expect(result).toBe(false);
        });
    });

    describe("verifyAccountTransaction", () => {
        it("returns true for a transaction signed by the account's key", async () => {
            const sender = await createTestAccount(client, 5);
            const receiver = await createTestAccount(client, 0);

            const tx = await new TransferTransaction()
                .addHbarTransfer(sender.accountId, new Hbar(-1))
                .addHbarTransfer(receiver.accountId, new Hbar(1))
                .freezeWith(ctx.client);
            const signedTx = await tx.sign(sender.key);

            const result = await client.verifyAccountTransaction(
                sender.accountId,
                signedTx,
            );

            expect(result).toBe(true);
        });

        it("returns false when the transaction was not signed by the account's key", async () => {
            const accountA = await createTestAccount(client, 5);
            const accountB = await createTestAccount(client, 0);

            // Signed only by A's key — verifying against B's account should fail.
            const tx = await new TransferTransaction()
                .addHbarTransfer(accountA.accountId, new Hbar(-1))
                .addHbarTransfer(accountB.accountId, new Hbar(1))
                .freezeWith(ctx.client);
            const signedTx = await tx.sign(accountA.key);

            const result = await client.verifyAccountTransaction(
                accountB.accountId,
                signedTx,
            );

            expect(result).toBe(false);
        });
    });
});
