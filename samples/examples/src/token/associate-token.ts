/**
 * Associate Token — link an account to a token so it can hold balances.
 *
 * Demonstrates the two association paths exposed by TokenService:
 *
 * - `associateToken`         — execute association immediately
 * - `scheduleAssociateToken` — create a scheduled association transaction
 *                              for deferred multi-party approval
 *
 * Run: pnpm tsx src/token/associate-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function associateToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Associate Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "associate token owner",
    });

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "associate token receiver",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Associate Demo Token",
        tokenSymbol: "ADT",
        decimals: 2,
        initialSupply: 1_000,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.associateToken({
        accountId: receiver.accountId,
        tokenId,
        additionalSigners: [receiverKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Receiver account:", receiver.accountId);
    console.log("Associated token:", tokenId);
    console.log();
}

async function scheduleAssociateToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Associate Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "schedule associate owner",
    });

    const scheduledReceiverKey = PrivateKey.generateED25519();
    const scheduledReceiver = await accountService.createAccount({
        publicKey: scheduledReceiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "schedule associate receiver",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Scheduled Associate Token",
        tokenSymbol: "SAT",
        decimals: 0,
        initialSupply: 500,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    let scheduled;

    try {
        scheduled = await tokenService.scheduleAssociateToken(
            {
                accountId: scheduledReceiver.accountId,
                tokenId,
                additionalSigners: [scheduledReceiverKey],
            },
            { scheduleMemo: "pending receiver approval" },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("SCHEDULED_TRANSACTION_NOT_IN_WHITELIST")) {
            console.log(
                "Scheduled token associate is not enabled on this network.",
            );
            console.log("Skipping scheduled associate scenario.");
            console.log();
            return;
        }
        throw error;
    }

    console.log("Owner account:", owner.accountId);
    console.log("Receiver account:", scheduledReceiver.accountId);
    console.log("Token ID:", tokenId);
    console.log("Schedule ID:", scheduled.scheduleId.toString());
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await associateToken(accountService, tokenService);
        await scheduleAssociateToken(accountService, tokenService);
        console.log("All token association scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("associate-token sample failed:", error);
    process.exitCode = 1;
});
