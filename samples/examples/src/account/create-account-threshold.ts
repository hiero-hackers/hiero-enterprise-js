/**
 * Create Account — threshold key (N-of-M multi-sig).
 *
 * Demonstrates creating an account controlled by a 2-of-3 threshold key.
 * Any 2 of the 3 keys must sign to authorize transactions from this account.
 *
 * Uses the `key` field (SDK Key type) instead of `publicKey` string,
 * which supports KeyList and threshold structures directly.
 *
 * Run: pnpm tsx src/account/create-account-threshold.ts
 */

import { PrivateKey, Hbar, KeyList } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

    const accountService = new AccountService(context);

    // Generate 3 keys — in production these come from different parties/HSMs
    const key1 = PrivateKey.generateED25519();
    const key2 = PrivateKey.generateED25519();
    const key3 = PrivateKey.generateED25519();

    // Create a 2-of-3 threshold key
    const thresholdKey = new KeyList(
        [key1.publicKey, key2.publicKey, key3.publicKey],
        2, // threshold — any 2 of 3 must sign
    );

    const account = await accountService.createAccount({
        key: thresholdKey,
        initialBalance: new Hbar(5),
        memo: "2-of-3 threshold account",
    });

    console.log("Created threshold account:", account.accountId);
    console.log("Key structure:", account.publicKey);

    // To send a transaction FROM this account later, provide 2 of the 3 keys:
    // await someService.someOperation({
    //     ...options,
    //     additionalSigners: [key1, key2],  // any 2 of 3
    // });

    context.client.close();
}

void main();
