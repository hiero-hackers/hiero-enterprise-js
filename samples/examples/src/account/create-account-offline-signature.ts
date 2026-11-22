/**
 * Create Account — pre-computed (offline) signature.
 *
 * Use when the signature is produced completely offline (air-gapped signer,
 * cold wallet) and delivered out-of-band. The signature bytes are attached
 * to the transaction before submission.
 *
 * Real offline flow:
 *   1. Build and freeze the transaction
 *   2. Serialise to bytes → transfer to air-gapped machine
 *   3. Air-gapped machine signs → returns signature bytes
 *   4. Attach signature bytes here via legacySignatures
 *   5. Submit
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
 * Run: pnpm tsx src/account/create-account-offline-signature.ts
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

    // Signature produced offline — in production this comes from your air-gapped system
    const offlineKey = PrivateKey.generateED25519();
    const placeholderSignature = new Uint8Array(64); // replace with real bytes

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        memo: "offline-signed account",
        legacySignatures: [
            {
                publicKey: offlineKey.publicKey,
                signature: placeholderSignature,
            },
        ],
    });

    console.log("Offline-signed account created:", account.accountId);

    context.client.close();
}

void main();
