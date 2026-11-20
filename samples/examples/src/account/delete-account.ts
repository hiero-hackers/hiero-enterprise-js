/**
 * Delete Account — remove an account and sweep remaining balance.
 *
 * Demonstrates:
 * 1. Immediate deletion (account key required)
 * 2. Scheduled deletion (key collected later via ScheduleSign)
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/account/delete-account.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

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
