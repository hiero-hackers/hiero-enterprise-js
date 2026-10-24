/**
 * Create Account — external signer (wallet, HSM, or KMS).
 *
 * Use when the signing key never leaves a secure boundary (hardware wallet,
 * cloud KMS, HSM). You provide the public key and an async signing function —
 * the private key material is never exposed to this library.
 *
 * In production, replace the body of `sign` with a call to your KMS/HSM SDK.
 *
 * Run: pnpm tsx src/account/create-account-external-signer.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

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
