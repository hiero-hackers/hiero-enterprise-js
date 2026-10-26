/**
 * Delete Allowance — revoke a spender's previously granted permission.
 *
 * Demonstrates the four allowance-revocation methods on AccountService:
 *
 * - `deleteHbarAllowance`        — revoke HBAR spending permission
 * - `deleteTokenAllowance`       — revoke fungible token spending permission
 * - `deleteNftAllowance`         — revoke per-serial NFT transfer permission
 * - `deleteAllNftAllowances`     — revoke a blanket "approve-for-all-serials"
 *                                  grant on an entire NFT collection
 *
 * In all cases the owner's key must sign. Since the operator is not the owner,
 * we pass the owner's key via `additionalSigners` on the optional second
 * `options` argument.
 *
 * Run: pnpm tsx src/account/delete-allowance.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    TokenService,
    HieroContext,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Demonstrates revoking an HBAR spending allowance.
 *
 * Internally, this submits an approve transaction with `amount: 0`, which the
 * Hiero protocol treats as a revocation. The convenience method exists so
 * callers don't need to think about the "amount 0 = revoke" trick.
 */
async function deleteHbarAllowance(accountService: AccountService) {
    console.log("=== Delete HBAR Allowance ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "delete hbar allowance owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "delete hbar allowance spender",
    });
    console.log("Spender account:", spender.accountId);

    // First grant the allowance so we have something to revoke.

    await accountService.approveHbarAllowance({
        hbarAllowances: [
            {
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
                amount: 5,
            },
        ],
        additionalSigners: [ownerKey],
    });
    console.log("Granted 5 HBAR allowance to spender:", spender.accountId);

    // Now revoke it.
    // The owner must sign (passed via additionalSigners) — the operator is not
    // the owner, so without this signer the network will reject the tx.

    await accountService.deleteHbarAllowance(
        [
            {
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
            },
        ],
        { additionalSigners: [ownerKey] },
    );

    console.log(
        "Revoked: spender",
        spender.accountId,
        "can no longer spend HBAR on behalf of owner",
        owner.accountId,
    );
    console.log();
}

/**
 * Demonstrates revoking a fungible token allowance.
 *
 * Like HBAR revocation, this is internally an approve with `amount: 0`.
 */
async function deleteTokenAllowance(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Delete Token Allowance ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "delete token allowance owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "delete token allowance spender",
    });
    console.log("Spender account:", spender.accountId);

    // Owner creates a token they'll grant the spender access to.

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Revocation Demo Token",
        tokenSymbol: "RVDT",
        decimals: 2,
        initialSupply: 10000,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });
    console.log("Created token:", tokenId);

    // Grant the allowance.

    await accountService.approveTokenAllowance({
        tokenAllowances: [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
                amount: 500,
            },
        ],
        additionalSigners: [ownerKey],
    });
    console.log("Granted 500 token allowance to spender:", spender.accountId);

    // Revoke it.

    await accountService.deleteTokenAllowance(
        [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
            },
        ],
        { additionalSigners: [ownerKey] },
    );

    console.log(
        "Revoked: spender",
        spender.accountId,
        "can no longer transfer token",
        tokenId.toString(),
    );
    console.log();
}

/**
 * Demonstrates revoking NFT allowances for specific serial numbers.
 *
 * This uses `AccountAllowanceDeleteTransaction.deleteAllTokenNftAllowances`
 * under the hood, which is the only protocol-level path for removing
 * per-serial NFT approvals. Use this when you previously approved specific
 * serials and want to undo that.
 *
 * For revoking a blanket "approved-for-all" grant, use
 * `deleteAllNftAllowances` instead — see the next example.
 */
async function deleteNftAllowanceBySerials(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Delete NFT Allowance (Specific Serials) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "delete nft serials owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "delete nft serials spender",
    });
    console.log("Spender account:", spender.accountId);

    const { tokenId } = await tokenService.createNft({
        tokenName: "Per-Serial Revocation NFT",
        tokenSymbol: "PSRN",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId: tokenId.toString(),
        metadata: [
            Buffer.from("metadata-1"),
            Buffer.from("metadata-2"),
            Buffer.from("metadata-3"),
        ],
        additionalSigners: [ownerKey],
    });
    console.log("Minted serials: [1, 2, 3]");

    // Grant per-serial allowance for serials 1 and 2.

    await accountService.approveNftAllowance({
        nftAllowances: [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
                serialNumbers: [1, 2],
            },
        ],
        additionalSigners: [ownerKey],
    });
    console.log(
        "Granted allowance for serials [1, 2] to spender:",
        spender.accountId,
    );

    // Revoke the allowance on those serials.
    // Note: spenderAccountId is NOT part of the deletion options — the
    // protocol clears whichever spender was approved for each serial.

    await accountService.deleteNftAllowance(
        [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                serialNumbers: [1, 2],
            },
        ],
        { additionalSigners: [ownerKey] },
    );

    console.log(
        "Revoked: no spender can transfer serials [1, 2] from collection",
        tokenId.toString(),
    );
    console.log();
}

/**
 * Demonstrates revoking a blanket "approved-for-all" NFT grant.
 *
 * Use this when you previously called `approveNftAllowance` with
 * `allSerials: true` and want to revoke the spender's blanket access to the
 * entire NFT collection.
 *
 * Under the hood this submits `AccountAllowanceApproveTransaction
 * .deleteTokenNftAllowanceAllSerials`, which is the only protocol-level path
 * for removing an approve-for-all grant — per-serial deletion does not undo it.
 */
async function deleteAllNftAllowances(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Delete NFT Allowance (All Serials) ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "delete nft all-serials owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "delete nft all-serials spender",
    });
    console.log("Spender account:", spender.accountId);

    const { tokenId } = await tokenService.createNft({
        tokenName: "All-Serials Revocation NFT",
        tokenSymbol: "ASRN",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId: tokenId.toString(),
        metadata: [Buffer.from("metadata-1"), Buffer.from("metadata-2")],
        additionalSigners: [ownerKey],
    });
    console.log("Minted serials: [1, 2]");

    // Grant blanket approved-for-all.

    await accountService.approveNftAllowance({
        nftAllowances: [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
                allSerials: true,
            },
        ],
        additionalSigners: [ownerKey],
    });
    console.log("Granted approved-for-all to spender:", spender.accountId);

    // Revoke the blanket grant.
    // Unlike `deleteNftAllowance` (per-serial), this method requires the
    // spender account ID because we're revoking a specific (owner, spender,
    // tokenId) triple, not clearing whatever spender is on each serial.

    await accountService.deleteAllNftAllowances(
        [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: spender.accountId.toString(),
            },
        ],
        { additionalSigners: [ownerKey] },
    );

    console.log(
        "Revoked: spender",
        spender.accountId,
        "no longer has blanket approval for collection",
        tokenId.toString(),
    );
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);
    try {
        await deleteHbarAllowance(accountService);
        await deleteTokenAllowance(accountService, tokenService);
        await deleteNftAllowanceBySerials(accountService, tokenService);
        await deleteAllNftAllowances(accountService, tokenService);
        console.log("All allowance revocation scenarios complete.");
    } finally {
        context.client.close();
    }
}
void main().catch((error) => {
    console.error("delete-allowance sample failed:", error);
    process.exitCode = 1;
});
