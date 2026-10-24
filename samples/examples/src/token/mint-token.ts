/**
 * Mint Token Supply — mint additional supply for an existing token.
 *
 * Demonstrates the two mint paths exposed by TokenService:
 *
 * - `mintToken`         — execute minting immediately
 * - `scheduleMintToken` — create a scheduled mint transaction for deferred
 *                         multi-party approval
 *
 * This sample mints NFT serials by passing metadata entries. Each metadata
 * entry mints one serial number.
 *
 * Run: pnpm tsx src/token/mint-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function mintToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Mint Token (NFT Metadata) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "mint token owner",
    });

    const { tokenId } = await tokenService.createNft({
        tokenName: "Mint Demo Collection",
        tokenSymbol: "MDC",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("meta-1"), Buffer.from("meta-2")],
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Minted NFT serials for token:", tokenId);
    console.log();
}

async function scheduleMintToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Mint Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "schedule mint owner",
    });

    const { tokenId } = await tokenService.createNft({
        tokenName: "Scheduled Mint Collection",
        tokenSymbol: "SMC",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    const scheduled = await tokenService.scheduleMintToken(
        {
            tokenId,
            metadata: [Buffer.from("scheduled-meta")],
            additionalSigners: [ownerKey],
        },
        { scheduleMemo: "pending curator mint approval" },
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
        await mintToken(accountService, tokenService);
        await scheduleMintToken(accountService, tokenService);
        console.log("All token mint scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("mint-token sample failed:", error);
    process.exitCode = 1;
});
