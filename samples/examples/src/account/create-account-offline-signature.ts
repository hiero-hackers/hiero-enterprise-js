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
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

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
