/**
 * Create Account — standard single-key pattern.
 *
 * Demonstrates the simplest account creation flow:
 * - Generate a key pair externally
 * - Pass the public key string to the service
 * - The operator auto-signs (no extra signers needed)
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
 * Run: pnpm tsx src/account/create-account.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

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
