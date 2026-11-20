/**
 * Create Account — threshold key (N-of-M multi-sig).
 *
 * Demonstrates creating an account controlled by a 2-of-3 threshold key.
 * Any 2 of the 3 keys must sign to authorize transactions from this account.
 *
 * Uses the `key` field (SDK Key type) instead of `publicKey` string,
 * which supports KeyList and threshold structures directly.
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
 * Run: pnpm tsx src/account/create-account-threshold.ts
 */

import { PrivateKey, Hbar, KeyList } from "@hiero-ledger/sdk";
import {
    AccountService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

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
