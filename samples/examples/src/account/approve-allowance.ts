/**
 * Approve Allowance — grant a spender permission to spend on the owner's behalf.
 *
 * Demonstrates three distinct allowance scenarios:
 * - HBAR allowance: allow a spender to spend HBAR from the owner's balance
 * - NFT allowance (specific serials): approve transfer of individual NFTs
 * - NFT delegating spender: an approved-for-all account re-delegates its
 *   permission to a third-party spender for specific serial numbers
 *
 * In all cases the owner's key must sign. Since the operator is not the owner,
 * we pass the owner's key via `additionalSigners`.
 *
 * Run: pnpm tsx src/account/approve-allowance.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Demonstrates approving an HBAR spending allowance.
 *
 * The owner grants a spender permission to spend up to a specified amount
 * of HBAR on their behalf. This is commonly used in marketplace contracts
 * or payment channels where a third party needs to pull HBAR from the owner.
 */
async function approveHbarAllowance(accountService: AccountService) {
    console.log("=== HBAR Allowance ===\n");

    // Create the owner and spender accounts for this demo.
    // The owner will grant the spender permission to spend their HBAR.

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "hbar allowance owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "hbar allowance spender",
    });
    console.log("Spender account:", spender.accountId);

    // Approve the HBAR allowance.
    // The owner signs (via additionalSigners) to authorize the spender
    // to spend up to 5 HBAR from their account.

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

    console.log(
        "Approved: spender",
        spender.accountId,
        "can now spend up to 5 HBAR from owner",
        owner.accountId,
    );
    console.log();
}

/**
 * Demonstrates approving NFT allowances for specific serial numbers.
 *
 * The owner creates an NFT collection, mints several serials, and then
 * grants a spender permission to transfer only specific serials.
 * This is useful when the owner wants to list individual NFTs on a
 * marketplace without granting blanket access to their entire collection.
 */
async function approveNftAllowanceBySerials(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== NFT Allowance (Specific Serials) ===\n");

    // Create owner and spender accounts.

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "nft allowance owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "nft allowance spender",
    });
    console.log("Spender account:", spender.accountId);

    // Create an NFT collection and mint 3 serials.
    // The owner is the treasury so minted NFTs go directly to the owner account.

    const { tokenId } = await tokenService.createNft({
        tokenName: "Serial Allowance NFT",
        tokenSymbol: "SANFT",
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

    // Approve the spender for only serials 1 and 2.
    // The spender will NOT have permission to transfer serial 3.

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
        "Approved: spender",
        spender.accountId,
        "can transfer serials [1, 2] from collection",
        tokenId.toString(),
    );
    console.log();
}

/**
 * Demonstrates the NFT delegating spender pattern.
 *
 * This is a two-step delegation model:
 *   First: The owner grants "approved-for-all" to a primary spender (e.g. a
 *          marketplace contract). This covers all current and future serials.
 *   Then:  The primary spender re-delegates its permission for specific
 *          serials to a secondary spender (e.g. an auction contract).
 *
 * The `delegatingSpender` field identifies who is doing the re-delegation.
 * The delegating account (not the owner) must sign the transaction.
 *
 * This pattern is useful when a marketplace wants to sub-delegate NFT transfer
 * rights to specialized contracts without requiring the owner to sign again.
 */
async function approveNftWithDelegatingSpender(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== NFT Delegating Spender ===\n");

    // Create the three accounts involved in this pattern:
    // - owner: holds the NFTs
    // - primarySpender: gets approved-for-all (e.g. a marketplace)
    // - delegatedSpender: receives re-delegated permission for specific serials

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "nft owner",
    });
    console.log("Owner account:", owner.accountId);

    const primarySpenderKey = PrivateKey.generateED25519();
    const primarySpender = await accountService.createAccount({
        publicKey: primarySpenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "primary spender (approved-for-all)",
    });
    console.log(
        "Primary spender (approved-for-all):",
        primarySpender.accountId,
    );

    const delegatedSpenderKey = PrivateKey.generateED25519();
    const delegatedSpender = await accountService.createAccount({
        publicKey: delegatedSpenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "delegated spender",
    });
    console.log("Delegated spender:", delegatedSpender.accountId);

    // Create an NFT collection and mint serials for the demo.
    // The owner is the treasury so minted NFTs go directly to the owner account.

    const { tokenId } = await tokenService.createNft({
        tokenName: "Delegation Demo NFT",
        tokenSymbol: "DDNFT",
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId: tokenId.toString(),
        metadata: [
            Buffer.from("nft-a"),
            Buffer.from("nft-b"),
            Buffer.from("nft-c"),
        ],
        additionalSigners: [ownerKey],
    });
    console.log("Minted serials: [1, 2, 3]");

    // Grant approved-for-all to the primary spender.
    // This gives the primary spender blanket permission to transfer ANY serial
    // in this collection on behalf of the owner (current and future mints).
    // The owner must sign.

    await accountService.approveNftAllowance({
        nftAllowances: [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: primarySpender.accountId.toString(),
                allSerials: true,
            },
        ],
        additionalSigners: [ownerKey],
    });

    console.log(
        "Granted approved-for-all to primary spender:",
        primarySpender.accountId,
    );

    // The primary spender re-delegates permission for specific serials
    // to the delegated spender. Note that:
    // - The `delegatingSpender` field is the primary spender (who holds approved-for-all)
    // - The primary spender's key signs (NOT the owner's key)
    // - Only specific serial numbers can be delegated, not allSerials

    await accountService.approveNftAllowance({
        nftAllowances: [
            {
                tokenId: tokenId.toString(),
                ownerAccountId: owner.accountId.toString(),
                spenderAccountId: delegatedSpender.accountId.toString(),
                serialNumbers: [1, 2],
                delegatingSpender: primarySpender.accountId.toString(),
            },
        ],
        additionalSigners: [primarySpenderKey],
    });

    console.log(
        "Primary spender delegated serials [1, 2] to:",
        delegatedSpender.accountId,
    );
    console.log(
        "The delegated spender can now transfer those specific serials",
        "on behalf of the owner, without the owner signing again.",
    );
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    await approveHbarAllowance(accountService);
    await approveNftAllowanceBySerials(accountService, tokenService);
    await approveNftWithDelegatingSpender(accountService, tokenService);

    console.log("All allowance scenarios complete.");
    context.client.close();
}

void main();
