/**
 * Verify Account Signature — confirm a signature was produced by an account's key.
 *
 * Demonstrates the two verification methods on AccountService:
 *
 * - `verifyAccountSignature`     — verify a signature over arbitrary bytes
 *                                  using the account's on-chain public key
 * - `verifyAccountTransaction`   — verify a signature on a frozen transaction
 *                                  using the account's on-chain public key
 *
 * Both methods read the account's key from the network (via AccountInfoQuery)
 * and use the SDK's `PublicKey.verify` / `PublicKey.verifyTransaction`. They
 * return `false` (not throw) for any mismatch, and they return `false` for
 * accounts whose key is a `KeyList` — multi-key threshold accounts can't be
 * verified against a single signature this way.
 *
 * Run: pnpm tsx src/account/verify-account-signature.ts
 */

import { PrivateKey, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Demonstrates verifying a signature over arbitrary bytes (e.g. an off-chain
 * payload like a login challenge or an authenticated message).
 *
 * The account's public key is fetched from the network — callers don't need
 * to track or pass it. This makes the method suitable for proving control of
 * an account ("sign this nonce with the key for 0.0.X") without any prior
 * key exchange.
 */
async function verifyAccountSignature(accountService: AccountService) {
    console.log("=== Verify Account Signature (raw bytes) ===\n");

    const accountKey = PrivateKey.generateED25519();
    const account = await accountService.createAccount({
        publicKey: accountKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "verify signature account",
    });
    console.log("Account:", account.accountId);

    // Sign an arbitrary message off-chain — could be a login nonce, a
    // hashed payload, or any byte string the verifier issued.

    const message = Buffer.from("login-challenge-12345");
    const signature = accountKey.sign(message);

    // Verify the signature against the account's on-chain key. The service
    // fetches the public key for us — no need to pass it explicitly.

    const valid = await accountService.verifyAccountSignature(
        account.accountId,
        message,
        signature,
    );
    console.log("Valid signature?       ", valid);

    // A signature produced by a different key should fail verification.

    const otherKey = PrivateKey.generateED25519();
    const wrongSignature = otherKey.sign(message);

    const wrongKeyValid = await accountService.verifyAccountSignature(
        account.accountId,
        message,
        wrongSignature,
    );
    console.log("Wrong-key signature?   ", wrongKeyValid);

    // A correct signature over a tampered message should also fail.

    const tampered = Buffer.from("login-challenge-99999");
    const tamperedValid = await accountService.verifyAccountSignature(
        account.accountId,
        tampered,
        signature,
    );
    console.log("Tampered message?      ", tamperedValid);
    console.log();
}

/**
 * Demonstrates verifying a signature on a frozen transaction.
 *
 * Useful when you receive a partially-signed transaction (e.g. from an
 * offline signer or a multi-party coordinator) and want to confirm a
 * particular party signed it before adding your own signature or relaying
 * it to the network.
 *
 * Needs access to the SDK `Client` to freeze the transaction, so this demo
 * takes the `HieroContext` in addition to the service.
 */
async function verifyAccountTransaction(
    context: HieroContext,
    accountService: AccountService,
) {
    console.log("=== Verify Account Transaction ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(5),
        memo: "verify tx sender",
    });
    console.log("Sender:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(0),
        memo: "verify tx receiver",
    });
    console.log("Receiver:", receiver.accountId);

    // Build a transfer, freeze it with the operator client, and sign it
    // with the sender's key. In a real flow this signed tx might arrive
    // serialised from an offline or remote signer.

    const tx = new TransferTransaction()
        .addHbarTransfer(sender.accountId, new Hbar(-1))
        .addHbarTransfer(receiver.accountId, new Hbar(1))
        .freezeWith(context.client);
    const signedTx = await tx.sign(senderKey);

    // Verifying against the signing account succeeds.

    const senderValid = await accountService.verifyAccountTransaction(
        sender.accountId,
        signedTx,
    );
    console.log("Signed by sender?      ", senderValid);

    // Verifying against an account that did not sign returns false — the
    // receiver's key has no signature on this tx.

    const receiverValid = await accountService.verifyAccountTransaction(
        receiver.accountId,
        signedTx,
    );
    console.log("Signed by receiver?    ", receiverValid);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    try {
        await verifyAccountSignature(accountService);
        await verifyAccountTransaction(context, accountService);
        console.log("All verify-account scenarios complete.");
    } finally {
        context.client.close();
    }
}
void main().catch((error) => {
    console.error("verify-account-signature sample failed:", error);
    process.exitCode = 1;
});
