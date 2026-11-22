/**
 * Create Account — multi-sig with additional private key co-signers.
 *
 * Use when the AccountCreateTransaction must be co-signed by keys you hold
 * locally (e.g., a treasury key, compliance key, or threshold key member).
 *
 * The executor freezes the transaction, signs with each key in order,
 * then the operator auto-signs during execute().
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
 * Run: pnpm tsx src/account/create-account-multisig.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

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
