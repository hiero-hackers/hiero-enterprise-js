/**
 * Update NFTs — rotate the metadata bytes of one or more NFT serials.
 *
 * Demonstrates the two NFT-metadata-update paths exposed by TokenService:
 *
 * - `updateNfts`         — execute the metadata update immediately
 * - `scheduleUpdateNfts` — defer the update behind a scheduled
 *                          transaction so additional parties can sign
 *                          before it executes
 *
 * `updateNfts` applies the same `metadata` value to every serial listed
 * in `serialNumbers`. Issue multiple calls (or a schedule per group) if
 * different serials need different metadata.
 *
 * Requirements:
 *
 * - The NFT collection must have been created with a `metadataKey`.
 *   The metadata key cannot be added after the fact unless the token has
 *   an admin key — see `update-token.ts` for the key-rotation pattern.
 * - The `metadataKey` must sign — supplied here via `additionalSigners`.
 * - The new metadata bytes are limited to 100 bytes per serial on the
 *   Hedera network.
 *
 * Updating an NFT's metadata does NOT affect its ownership, serial
 * number, or transfer history — only the on-chain metadata bytes change.
 *
 * Run: pnpm tsx src/token/update-nfts.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Demonstrates updating the metadata of a specific NFT serial immediately.
 *
 * Creates an NFT collection with a `metadataKey`, mints a single serial
 * with placeholder metadata, then rotates that metadata to a new value.
 */
async function updateNftMetadata(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Update NFT Metadata ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "update-nfts treasury",
    });

    const metadataKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createNft({
        tokenName: "Update NFTs Example",
        tokenSymbol: "UNX",
        treasuryAccountId: treasury.accountId,
        supplyKey: treasuryKey.publicKey,
        metadataKey: metadataKey.publicKey,
        additionalSigners: [treasuryKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("ipfs://placeholder")],
        additionalSigners: [treasuryKey],
    });
    console.log("Minted serial 1 with placeholder metadata");

    // Only the metadataKey is required to rotate the per-serial bytes.
    await tokenService.updateNfts({
        tokenId,
        serialNumbers: [1],
        metadata: Buffer.from("ipfs://QmFinalCid"),
        additionalSigners: [metadataKey],
    });
    console.log("Rotated metadata on serial 1 of:", tokenId);
    console.log();
}

/**
 * Demonstrates rotating metadata on multiple serials in a single call.
 *
 * The same `metadata` value is applied to every serial listed in
 * `serialNumbers`. Serials not listed are left untouched.
 */
async function updateMultipleNftSerials(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Update Multiple NFT Serials ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "update-nfts batch treasury",
    });

    const metadataKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createNft({
        tokenName: "Update NFTs Batch",
        tokenSymbol: "UNB",
        treasuryAccountId: treasury.accountId,
        supplyKey: treasuryKey.publicKey,
        metadataKey: metadataKey.publicKey,
        additionalSigners: [treasuryKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId,
        metadata: [
            Buffer.from("orig-1"),
            Buffer.from("orig-2"),
            Buffer.from("orig-3"),
        ],
        additionalSigners: [treasuryKey],
    });
    console.log("Minted serials 1, 2, 3 with original metadata");

    // Serial 2 is intentionally omitted — only 1 and 3 are rotated.
    await tokenService.updateNfts({
        tokenId,
        serialNumbers: [1, 3],
        metadata: Buffer.from("rotated"),
        additionalSigners: [metadataKey],
    });
    console.log("Rotated metadata on serials [1, 3]; serial 2 untouched");
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await updateNftMetadata(accountService, tokenService);
        await updateMultipleNftSerials(accountService, tokenService);
        console.log("All NFT metadata update scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("update-nfts sample failed:", error);
    process.exitCode = 1;
});
