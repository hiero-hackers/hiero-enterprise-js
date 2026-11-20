/**
 * Create Account — external signer (wallet, HSM, or KMS).
 *
 * Use when the signing key never leaves a secure boundary (hardware wallet,
 * cloud KMS, HSM). You provide the public key and an async signing function —
 * the private key material is never exposed to this library.
 *
 * In production, replace the body of `sign` with a call to your KMS/HSM SDK.
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
 * Run: pnpm tsx src/account/create-account-external-signer.ts
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

    // Simulated external wallet — in production, call your wallet SDK or KMS API
    const walletKey = PrivateKey.generateECDSA();
    const walletSigner = {
        publicKey: walletKey.publicKey,
        sign: (message: Uint8Array): Promise<Uint8Array> => {
            // Production examples:
            //   return await kmsClient.sign(keyId, message);
            //   return await ledger.sign(derivationPath, message);
            //   return await hashConnect.sign(accountId, message);
            return Promise.resolve(walletKey.sign(message));
        },
    };

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        memo: "wallet-signed account",
        externalSigners: [walletSigner], // async sign fn — key never exposed
    });

    console.log("External signer account created:", account.accountId);

    context.client.close();
}

void main();
