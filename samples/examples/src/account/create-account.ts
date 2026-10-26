/**
 * Create Account — standard single-key pattern.
 *
 * Demonstrates the simplest account creation flow:
 * - Generate a key pair externally
 * - Pass the public key string to the service
 * - The operator auto-signs (no extra signers needed)
 *
 * Run: pnpm tsx src/account/create-account.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

    const accountService = new AccountService(context);

    // Generate key pair — in production this would come from HSM/KMS/wallet
    const newKey = PrivateKey.generateED25519();

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "standard account",
    });

    console.log("Created account:", account.accountId);
    console.log("Public key:", account.publicKey);

    context.client.close();
}

void main();
