/**
 * Update Account — modify account properties and rotate keys.
 *
 * Demonstrates:
 * 1. Simple property update (memo, staking, token associations)
 * 2. Key rotation — replacing the account's control key
 * 3. Upgrading from single key to threshold key
 *
 * Run: pnpm tsx src/account/update-account.ts
 */

import { PrivateKey, Hbar, KeyList } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

    const accountService = new AccountService(context);

    // First, create an account to update
    const originalKey = PrivateKey.generateED25519();
    const account = await accountService.createAccount({
        publicKey: originalKey.publicKey.toStringRaw(),
        initialBalance: new Hbar(2),
        memo: "original memo",
    });

    console.log("Created account:", account.accountId);

    // 1. Simple property update
    // Update memo and staking — the account's own key must sign.
    await accountService.updateAccount({
        accountId: account.accountId.toString(),
        memo: "updated memo",
        maxAutomaticTokenAssociations: 10,
        additionalSigners: [originalKey], // account key must sign updates
    });

    console.log("\n1. Updated memo and token associations");

    // 2. Key rotation — single key to single key
    // Replace the account's ED25519 key with a new one.
    // Both the OLD key and the NEW key must sign.
    const newKey = PrivateKey.generateED25519();

    await accountService.updateAccount({
        accountId: account.accountId.toString(),
        key: newKey.publicKey,
        additionalSigners: [originalKey, newKey], // old + new must both sign
    });

    console.log("2. Rotated key (single → single)");

    // From this point, `newKey` controls the account — `originalKey` is no longer valid.
    // All subsequent operations must use `newKey`.

    // 3. Upgrade to threshold key
    // Replace single key with a 2-of-3 threshold key.
    const key2 = PrivateKey.generateED25519();
    const key3 = PrivateKey.generateED25519();

    const thresholdKey = new KeyList(
        [newKey.publicKey, key2.publicKey, key3.publicKey],
        2, // 2-of-3
    );

    await accountService.updateAccount({
        accountId: account.accountId.toString(),
        key: thresholdKey,
        additionalSigners: [newKey, key2], // old key + enough new threshold members
    });

    console.log("3. Upgraded to 2-of-3 threshold key");

    context.client.close();
}

void main();
