/**
 * Burn Token Supply — burn supply from an existing token.
 *
 * Demonstrates the two burn paths exposed by TokenService:
 *
 * - `burnToken`         — execute burning immediately
 * - `scheduleBurnToken` — create a scheduled burn transaction for deferred
 *                         multi-party approval
 *
 * The supply key must sign the burn. For NFTs, supply specific serial
 * numbers via `serials`. For fungible tokens, supply the amount to burn
 * via `amount`. The burned supply must be held by the treasury account.
 *
 * Run: pnpm tsx src/token/burn-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function burnFungibleToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Burn Token (Fungible) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "burn fungible token owner",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Burn Demo Token",
        tokenSymbol: "BDT",
        decimals: 0,
        initialSupply: 1_000,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    const burnResult = await tokenService.burnToken({
        tokenId,
        amount: 250,
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Token ID:", tokenId);
    console.log("Burned amount: 250");
    console.log("New total supply:", burnResult.totalSupply);
    console.log();
}

async function burnNftSerials(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Burn Token (NFT Serials) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "burn nft owner",
    });

    const { tokenId } = await tokenService.createNft({
        tokenName: "Burn NFT Collection",
        tokenSymbol: "BNC",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [
            Buffer.from("meta-1"),
            Buffer.from("meta-2"),
            Buffer.from("meta-3"),
        ],
        additionalSigners: [ownerKey],
    });

    const burnResult = await tokenService.burnToken({
        tokenId,
        serials: [1, 2],
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Token ID:", tokenId);
    console.log("Burned serials: 1, 2");
    console.log("New total supply:", burnResult.totalSupply);
    console.log();
}

async function scheduleBurnToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Burn Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "schedule burn owner",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Scheduled Burn Token",
        tokenSymbol: "SBT",
        decimals: 0,
        initialSupply: 500,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    const scheduled = await tokenService.scheduleBurnToken(
        {
            tokenId,
            amount: 100,
            additionalSigners: [ownerKey],
        },
        { scheduleMemo: "pending treasury burn approval" },
    );

    console.log("Owner account:", owner.accountId);
    console.log("Token ID:", tokenId);
    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await burnFungibleToken(accountService, tokenService);
        await burnNftSerials(accountService, tokenService);
        await scheduleBurnToken(accountService, tokenService);
        console.log("All token burn scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("burn-token sample failed:", error);
    process.exitCode = 1;
});
