/**
 * Create Account — multi-sig with additional private key co-signers.
 *
 * Use when the AccountCreateTransaction must be co-signed by keys you hold
 * locally (e.g., a treasury key, compliance key, or threshold key member).
 *
 * The executor freezes the transaction, signs with each key in order,
 * then the operator auto-signs during execute().
 *
 * Run: pnpm tsx src/account/create-account-multisig.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

    const accountService = new AccountService(context);

    const newKey = PrivateKey.generateED25519();
    const cosignerKey = PrivateKey.generateED25519(); // a key you hold locally

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        memo: "multi-sig account",
        additionalSigners: [cosignerKey], // co-signer key as a signer
    });

    console.log("Multi-sig account created:", account.accountId);

    context.client.close();
}

void main();
