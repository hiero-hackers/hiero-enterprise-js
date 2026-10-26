/**
 * Dissociate Token — unlink a previously-associated token from an account.
 *
 * Demonstrates the two dissociation paths exposed by TokenService:
 *
 * - `dissociateToken`         — execute dissociation immediately
 * - `scheduleDissociateToken` — create a scheduled dissociation
 *                               transaction for deferred multi-party approval
 *
 * The account must hold a zero balance of the token to dissociate, and
 * the account's key must sign — pass it via `additionalSigners`. After
 * dissociation, the account can no longer receive the token unless
 * re-associated.
 *
 * Run: pnpm tsx src/token/dissociate-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function dissociateToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Dissociate Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "dissociate token owner",
    });

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "dissociate token receiver",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Dissociate Demo Token",
        tokenSymbol: "DDT",
        decimals: 2,
        initialSupply: 1_000,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    // Associate first so we have something to dissociate from.
    await tokenService.associateToken({
        accountId: receiver.accountId,
        tokenId,
        additionalSigners: [receiverKey],
    });

    await tokenService.dissociateToken({
        accountId: receiver.accountId,
        tokenIds: [tokenId],
        additionalSigners: [receiverKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Receiver account:", receiver.accountId);
    console.log("Dissociated token:", tokenId);
    console.log();
}

async function scheduleDissociateToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Dissociate Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "schedule dissociate owner",
    });

    const scheduledReceiverKey = PrivateKey.generateED25519();
    const scheduledReceiver = await accountService.createAccount({
        publicKey: scheduledReceiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "schedule dissociate receiver",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Scheduled Dissociate Token",
        tokenSymbol: "SDT",
        decimals: 0,
        initialSupply: 500,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.associateToken({
        accountId: scheduledReceiver.accountId,
        tokenId,
        additionalSigners: [scheduledReceiverKey],
    });

    let scheduled: Awaited<ReturnType<TokenService["scheduleDissociateToken"]>>;

    try {
        scheduled = await tokenService.scheduleDissociateToken(
            {
                accountId: scheduledReceiver.accountId,
                tokenIds: [tokenId],
                additionalSigners: [scheduledReceiverKey],
            },
            { scheduleMemo: "pending receiver approval" },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("SCHEDULED_TRANSACTION_NOT_IN_WHITELIST")) {
            console.log(
                "Scheduled token dissociate is not enabled on this network.",
            );
            console.log("Skipping scheduled dissociate scenario.");
            console.log();
            return;
        }
        throw error;
    }

    console.log("Owner account:", owner.accountId);
    console.log("Receiver account:", scheduledReceiver.accountId);
    console.log("Token ID:", tokenId);
    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await dissociateToken(accountService, tokenService);
        await scheduleDissociateToken(accountService, tokenService);
        console.log("All token dissociation scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("dissociate-token sample failed:", error);
    process.exitCode = 1;
});
