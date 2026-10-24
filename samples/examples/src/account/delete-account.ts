/**
 * Delete Account — remove an account and sweep remaining balance.
 *
 * Demonstrates:
 * 1. Immediate deletion (account key required)
 * 2. Scheduled deletion (key collected later via ScheduleSign)
 *
 * Run: pnpm tsx src/account/delete-account.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

    const accountService = new AccountService(context);

    // 1. Immediate deletion
    // The account's private key must be provided to authorize deletion.
    // Remaining balance is swept to `transferAccountId` (defaults to operator).
    const key = PrivateKey.generateED25519();
    const account = await accountService.createAccount({
        publicKey: key.publicKey.toStringRaw(),
        initialBalance: new Hbar(1),
    });

    console.log("Created account:", account.accountId);

    await accountService.deleteAccount({
        accountId: account.accountId,
        accountKey: key,
        // transferAccountId: "0.0.200",  // optional — defaults to operator
    });

    console.log("Deleted:", account.accountId);

    context.client.close();
}

void main();
