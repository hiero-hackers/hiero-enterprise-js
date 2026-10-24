/**
 * Cancel Airdrop — recall previously-issued pending airdrops (fungible
 * and / or NFT) by passing pre-built `PendingAirdropId` references.
 *
 * Demonstrates the unified `cancelAirdrop` API exposed by `TokenService`.
 * One call accepts a mixed batch of fungible and NFT pending airdrop IDs
 * — the underlying transaction handles either kind uniformly.
 *
 * When the network cannot credit a receiver immediately (no association
 * and no available auto-association slot, or receiver-sig-required), the
 * airdrop is parked as a pending entry held in escrow against the
 * sender's balance. Until the receiver claims the pending airdrop, the
 * sender can cancel it to release the escrow back to its available
 * balance. After a successful cancel, the receiver can no longer claim
 * that pending entry.
 *
 * `PendingAirdropId` instances can be constructed directly when the
 * caller already knows `(senderId, receiverId, tokenId | nftId)`, or
 * discovered via the mirror node
 * (`/api/v1/accounts/{id}/airdrops/outstanding`) for senders enumerating
 * their outstanding pending airdrops.
 *
 * This sample walks through three scenarios:
 *  1. Single pending fungible airdrop → sender cancels → receiver can
 *     no longer claim.
 *  2. Single pending NFT airdrop → sender cancels → NFT remains with
 *     the treasury.
 *  3. Mixed batch — one fungible + one NFT pending airdrop, cancelled
 *     atomically in a single transaction.
 *
 * Every distinct sender must sign — supplied via `additionalSigners`.
 * The operator pays the transaction fee. (Contrast with claim, which
 * requires the receivers' signatures.)
 *
 * Note: `TokenCancelAirdrop` is not whitelisted for scheduling on the
 * network, so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/cancel-airdrop.ts
 */

import {
    NftId,
    PendingAirdropId,
    PrivateKey,
    type TokenId,
    type AccountId,
} from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config, waitForMirror } from "../env.js";

async function tokenBalanceFor(
    accountService: AccountService,
    accountId: string | AccountId,
    tokenId: string | TokenId,
): Promise<string> {
    return (await accountService.getTokenBalance(accountId, tokenId)).balance;
}

async function createKeyedAccount(
    accountService: AccountService,
    initialBalance: number,
    memo: string,
): Promise<{ accountId: string; key: PrivateKey }> {
    const key = PrivateKey.generateED25519();
    const account = await accountService.createAccount({
        publicKey: key.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance,
        memo,
    });
    return { accountId: account.accountId.toString(), key };
}

async function cancelPendingFungibleAirdrop(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 1: Cancel a pending fungible airdrop ===\n");

    const owner = await createKeyedAccount(accountService, 5, "airdrop owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "cancel receiver",
    );

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Cancel Fungible Demo Token",
        tokenSymbol: "XFDT",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    // Receiver is NOT associated, so this is parked as a pending airdrop.
    await tokenService.airdropFungibleToken({
        airdrops: [
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver.accountId.toString(),
                amount: 25,
            },
        ],
        additionalSigners: [owner.key],
    });

    console.log("Token:", tokenId);
    console.log(
        "  Pending airdrop issued to receiver:",
        receiver.accountId,
        "(amount 25)",
    );

    // The sender cancels the pending airdrop. The sender's key must sign.
    await tokenService.cancelAirdrop({
        pendingAirdropIds: [
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                tokenId,
            }),
        ],
        additionalSigners: [owner.key],
    });

    await waitForMirror();
    console.log(
        "  Receiver balance after cancel:",
        await tokenBalanceFor(accountService, receiver.accountId, tokenId),
    );
    console.log();
}

async function cancelPendingNftAirdrop(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 2: Cancel a pending NFT airdrop ===\n");

    const owner = await createKeyedAccount(accountService, 5, "nft owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "cancel nft receiver",
    );

    const { tokenId } = await tokenService.createNft({
        tokenName: "Cancel NFT Demo Collection",
        tokenSymbol: "XNDC",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("cancel-nft-1")],
        additionalSigners: [owner.key],
    });

    // Receiver is NOT associated, so this is parked as a pending NFT airdrop.
    await tokenService.airdropNft({
        airdrops: [
            {
                tokenId,
                serial: 1,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver.accountId.toString(),
            },
        ],
        additionalSigners: [owner.key],
    });

    console.log("Collection:", tokenId);
    console.log(
        "  Pending NFT airdrop issued to receiver:",
        receiver.accountId,
        "(serial 1)",
    );

    // The sender cancels the pending NFT airdrop. The sender's key must sign.
    await tokenService.cancelAirdrop({
        pendingAirdropIds: [
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                nftId: new NftId(tokenId, 1),
            }),
        ],
        additionalSigners: [owner.key],
    });

    await waitForMirror();
    console.log(
        "  Receiver NFT count after cancel:",
        await tokenBalanceFor(accountService, receiver.accountId, tokenId),
    );
    console.log();
}

async function cancelMixedBatch(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 3: Cancel a mixed batch (fungible + NFT) ===\n");

    const owner = await createKeyedAccount(accountService, 5, "mixed owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "mixed cancel receiver",
    );

    const { tokenId: fungibleTokenId } = await tokenService.createFungibleToken(
        {
            tokenName: "Cancel Batch Fungible Demo",
            tokenSymbol: "XBFD",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        },
    );

    const { tokenId: nftTokenId } = await tokenService.createNft({
        tokenName: "Cancel Batch NFT Demo",
        tokenSymbol: "XBND",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId: nftTokenId,
        metadata: [Buffer.from("batch-cancel-nft-1")],
        additionalSigners: [owner.key],
    });

    // Both airdrops are parked as pending entries (receiver is not associated).
    await tokenService.airdropFungibleToken({
        airdrops: [
            {
                tokenId: fungibleTokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver.accountId.toString(),
                amount: 12,
            },
        ],
        additionalSigners: [owner.key],
    });
    await tokenService.airdropNft({
        airdrops: [
            {
                tokenId: nftTokenId,
                serial: 1,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver.accountId.toString(),
            },
        ],
        additionalSigners: [owner.key],
    });

    console.log("Fungible token:", fungibleTokenId);
    console.log("NFT collection:", nftTokenId);
    console.log(
        "  Pending airdrops issued to receiver:",
        receiver.accountId,
        "(fungible 12, NFT serial 1)",
    );

    // A single cancel transaction recalls both pending airdrops atomically.
    await tokenService.cancelAirdrop({
        pendingAirdropIds: [
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                tokenId: fungibleTokenId,
            }),
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                nftId: new NftId(nftTokenId, 1),
            }),
        ],
        additionalSigners: [owner.key],
    });

    await waitForMirror();

    console.log(
        "  Receiver fungible balance after cancel:",
        await tokenBalanceFor(
            accountService,
            receiver.accountId,
            fungibleTokenId,
        ),
    );
    console.log(
        "  Receiver NFT count after cancel:",
        await tokenBalanceFor(accountService, receiver.accountId, nftTokenId),
    );
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await cancelPendingFungibleAirdrop(accountService, tokenService);
        await cancelPendingNftAirdrop(accountService, tokenService);
        await cancelMixedBatch(accountService, tokenService);
        console.log("All cancel airdrop scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("cancel-airdrop sample failed:", error);
    process.exitCode = 1;
});
