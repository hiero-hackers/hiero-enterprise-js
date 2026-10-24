/**
 * Wipe Token Supply — wipe supply from a specific holder account.
 *
 * Demonstrates the immediate wipe path exposed by TokenService:
 *
 * - `wipeToken` — execute wiping immediately
 *
 * Unlike `burnToken`, which removes supply from the treasury, `wipeToken`
 * removes supply from a specific non-treasury holder — typical use cases
 * include compliance enforcement or revoking issued tokens. The wipe key
 * (not the supply key) must sign.
 *
 * Note: `TokenWipe` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/wipe-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function wipeFungibleToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Wipe Token (Fungible) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "wipe fungible token owner",
    });

    const holderKey = PrivateKey.generateED25519();
    const holder = await accountService.createAccount({
        publicKey: holderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "wipe fungible token holder",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Wipe Demo Token",
        tokenSymbol: "WDT",
        decimals: 0,
        initialSupply: 1_000,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        wipeKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.associateToken({
        accountId: holder.accountId,
        tokenId,
        additionalSigners: [holderKey],
    });

    await accountService.transferToken(
        tokenId,
        holder.accountId,
        400,
        owner.accountId,
        { additionalSigners: [ownerKey] },
    );

    const wipeResult = await tokenService.wipeToken({
        tokenId,
        accountId: holder.accountId,
        amount: 250,
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Holder account:", holder.accountId);
    console.log("Token ID:", tokenId);
    console.log("Wiped amount: 250");
    console.log("New total supply:", wipeResult.totalSupply);
    console.log();
}

async function wipeNftSerials(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Wipe Token (NFT Serials) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "wipe nft owner",
    });

    const holderKey = PrivateKey.generateED25519();
    const holder = await accountService.createAccount({
        publicKey: holderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "wipe nft holder",
    });

    const { tokenId } = await tokenService.createNft({
        tokenName: "Wipe NFT Collection",
        tokenSymbol: "WNC",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        wipeKey: ownerKey.publicKey,
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

    await tokenService.associateToken({
        accountId: holder.accountId,
        tokenId,
        additionalSigners: [holderKey],
    });

    await accountService.transferNft(
        tokenId,
        1,
        holder.accountId,
        owner.accountId,
        { additionalSigners: [ownerKey] },
    );
    await accountService.transferNft(
        tokenId,
        2,
        holder.accountId,
        owner.accountId,
        { additionalSigners: [ownerKey] },
    );

    const wipeResult = await tokenService.wipeToken({
        tokenId,
        accountId: holder.accountId,
        serials: [1, 2],
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Holder account:", holder.accountId);
    console.log("Token ID:", tokenId);
    console.log("Wiped serials: 1, 2");
    console.log("New total supply:", wipeResult.totalSupply);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await wipeFungibleToken(accountService, tokenService);
        await wipeNftSerials(accountService, tokenService);
        console.log("All token wipe scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("wipe-token sample failed:", error);
    process.exitCode = 1;
});
