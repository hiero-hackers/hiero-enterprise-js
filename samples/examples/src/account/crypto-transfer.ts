/**
 * Transfer — move HBAR, fungible tokens, or NFTs between accounts.
 *
 * Demonstrates the six transfer methods on AccountService:
 *
 * - `transferHbar`          — direct HBAR transfer
 * - `transferToken`         — direct fungible token transfer (with the
 *                             `expectedDecimals` magnitude safety check)
 * - `transferNft`           — direct NFT transfer
 * - `scheduleTransferHbar`  — schedule an HBAR transfer for later/multi-party
 *                             execution
 * - `scheduleTransferToken` — schedule a fungible token transfer
 * - `scheduleTransferNft`   — schedule an NFT transfer
 *
 * In all cases the sender's key must sign. Since the operator is not the
 * sender in these demos, we pass the sender's key via `additionalSigners`
 * on the transfer options. For token and NFT transfers the receiver must
 * also be associated with the token before it can receive a balance.
 *
 * Run: pnpm tsx src/account/transfer.ts
 */

import {
    AccountService,
    AccountType,
    TokenService,
    HieroContext,
    PrivateKey,
    Hbar,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Demonstrates a direct HBAR transfer between two accounts.
 *
 * The sender must sign — when the sender is not the operator (as here), pass
 * the sender's private key via `additionalSigners`. Without it the network
 * will reject the transaction with `INVALID_SIGNATURE`.
 */
async function transferHbar(accountService: AccountService) {
    console.log("=== Transfer HBAR ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "transfer hbar sender",
    });
    console.log("Sender account:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(0),
        memo: "transfer hbar receiver",
    });
    console.log("Receiver account:", receiver.accountId);

    // Move 1 HBAR from the sender to the receiver.
    // `amount` can be a number (interpreted as whole HBAR) or an Hbar value.

    const result = await accountService.transferHbar(
        receiver.accountId,
        new Hbar(1),
        sender.accountId,
        { additionalSigners: [senderKey] },
    );
    // The result carries the transaction id — the caller's reference for
    // explorer links, mirror node lookups, or payment correlation.
    console.log("Transferred:", result.transactionId, result.status);

    const balance = await accountService.getAccountBalance(receiver.accountId);
    console.log("Receiver balance:", balance.tinybars, "tinybars");
    console.log();
}

/**
 * Demonstrates a direct fungible token transfer.
 *
 * The sender owns the token (as treasury) and transfers some of its supply
 * to the receiver. The receiver must be associated with the token before it
 * can hold a balance — `associateToken` does this with the receiver's key.
 *
 * `expectedDecimals` is an optional magnitude safety check: the SDK verifies
 * the token's on-chain decimals match before submitting, guarding against
 * accidentally sending the wrong order of magnitude.
 */
async function transferToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Transfer Fungible Token ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "transfer token sender",
    });
    console.log("Sender account:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "transfer token receiver",
    });
    console.log("Receiver account:", receiver.accountId);

    // Sender creates the token and holds the full initial supply as treasury.

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Transfer Demo Token",
        tokenSymbol: "TXD",
        decimals: 2,
        initialSupply: 10_000,
        treasuryAccountId: sender.accountId,
        supplyKey: senderKey.publicKey,
        additionalSigners: [senderKey],
    });
    console.log("Created token:   ", tokenId);

    // The receiver must opt-in before it can hold the token.

    await tokenService.associateToken({
        tokenId,
        accountId: receiver.accountId,
        additionalSigners: [receiverKey],
    });
    console.log("Receiver associated with token");

    // Transfer 250 units. `expectedDecimals: 2` asserts the token's decimals
    // match what the caller thinks they are — a safety check against
    // accidentally moving 250 of the wrong magnitude.

    await accountService.transferToken(
        tokenId,
        receiver.accountId,
        250,
        sender.accountId,
        {
            expectedDecimals: 2,
            additionalSigners: [senderKey],
        },
    );

    const balance = await accountService.getAccountBalance(receiver.accountId);
    const held = balance.tokens.find((t) => t.tokenId === tokenId.toString());
    console.log("Receiver token balance:", held?.balance);
    console.log();
}

/**
 * Demonstrates a direct NFT transfer.
 *
 * The sender creates an NFT collection (as treasury + supply key), mints a
 * single serial, the receiver associates with the collection, and then the
 * serial is transferred. Each serial is addressed by its (tokenId, serial)
 * pair.
 */
async function transferNft(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Transfer NFT ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "transfer nft sender",
    });
    console.log("Sender account:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "transfer nft receiver",
    });
    console.log("Receiver account:", receiver.accountId);

    const { tokenId } = await tokenService.createNft({
        tokenName: "Transfer Demo NFT",
        tokenSymbol: "TXDN",
        treasuryAccountId: sender.accountId,
        supplyKey: senderKey.publicKey,
        additionalSigners: [senderKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("nft-meta-1")],
        additionalSigners: [senderKey],
    });
    const serial = 1;
    console.log("Minted serial:", serial);

    // The receiver must opt-in to the NFT collection before it can hold a serial.

    await tokenService.associateToken({
        tokenId,
        accountId: receiver.accountId,
        additionalSigners: [receiverKey],
    });
    console.log("Receiver associated with NFT collection");

    await accountService.transferNft(
        tokenId,
        serial,
        receiver.accountId,
        sender.accountId,
        { additionalSigners: [senderKey] },
    );

    console.log(
        "Transferred serial",
        serial,
        "from",
        sender.accountId,
        "to",
        receiver.accountId,
    );
    console.log();
}

/**
 * Demonstrates scheduling an HBAR transfer.
 *
 * Scheduled transfers register the intent on-chain but defer execution until
 * the required signatures accumulate (via `ScheduleService.sign`). They are
 * useful for multi-party approval flows or batching.
 *
 * `scheduleTransferHbar` accepts the same arguments as `transferHbar` plus
 * an extra options bag combining transaction options with schedule fields
 * (`scheduleMemo`, `payerAccountId`, `adminKey`).
 */
async function scheduleTransferHbar(accountService: AccountService) {
    console.log("=== Schedule HBAR Transfer ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "schedule hbar sender",
    });
    console.log("Sender account:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(0),
        memo: "schedule hbar receiver",
    });
    console.log("Receiver account:", receiver.accountId);

    // Submitting with the sender's key lets the schedule execute immediately
    // once created. Omit `additionalSigners` for true multi-party flows where
    // another party will sign later via `ScheduleService.sign`.

    const { scheduleId } = await accountService.scheduleTransferHbar(
        receiver.accountId,
        2,
        sender.accountId,
        {
            scheduleMemo: "scheduled hbar transfer demo",
            additionalSigners: [senderKey],
        },
    );

    console.log("Schedule ID:   ", scheduleId);
    console.log();
}

/**
 * Demonstrates scheduling a fungible token transfer.
 *
 * Same shape as `scheduleTransferHbar` — sender owns the token, receiver
 * must be associated, schedule combines the transfer options with the
 * schedule fields.
 */
async function scheduleTransferToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Token Transfer ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "schedule token sender",
    });
    console.log("Sender account:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "schedule token receiver",
    });
    console.log("Receiver account:", receiver.accountId);

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Scheduled Transfer Token",
        tokenSymbol: "STX",
        decimals: 0,
        initialSupply: 1_000,
        treasuryAccountId: sender.accountId,
        supplyKey: senderKey.publicKey,
        additionalSigners: [senderKey],
    });
    console.log("Created token:   ", tokenId);

    await tokenService.associateToken({
        tokenId,
        accountId: receiver.accountId,
        additionalSigners: [receiverKey],
    });

    const { scheduleId } = await accountService.scheduleTransferToken(
        tokenId,
        receiver.accountId,
        100,
        sender.accountId,
        {
            scheduleMemo: "scheduled token transfer demo",
            additionalSigners: [senderKey],
        },
    );

    console.log("Schedule ID:   ", scheduleId);
    console.log();
}

/**
 * Demonstrates scheduling an NFT transfer.
 *
 * Same setup as `transferNft` — create the collection, mint a serial,
 * associate the receiver — but the transfer is scheduled rather than
 * executed immediately.
 */
async function scheduleTransferNft(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule NFT Transfer ===\n");

    const senderKey = PrivateKey.generateED25519();
    const sender = await accountService.createAccount({
        publicKey: senderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "schedule nft sender",
    });
    console.log("Sender account:  ", sender.accountId);

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "schedule nft receiver",
    });
    console.log("Receiver account:", receiver.accountId);

    const { tokenId } = await tokenService.createNft({
        tokenName: "Scheduled NFT",
        tokenSymbol: "SNFT",
        treasuryAccountId: sender.accountId,
        supplyKey: senderKey.publicKey,
        additionalSigners: [senderKey],
    });
    console.log("Created NFT collection:", tokenId);

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("scheduled-nft-meta")],
        additionalSigners: [senderKey],
    });
    const serial = 1;
    console.log("Minted serial:", serial);

    await tokenService.associateToken({
        tokenId,
        accountId: receiver.accountId,
        additionalSigners: [receiverKey],
    });

    const { scheduleId } = await accountService.scheduleTransferNft(
        tokenId,
        serial,
        receiver.accountId,
        sender.accountId,
        {
            scheduleMemo: "scheduled nft transfer demo",
            additionalSigners: [senderKey],
        },
    );

    console.log("Schedule ID:   ", scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);
    try {
        await transferHbar(accountService);
        await transferToken(accountService, tokenService);
        await transferNft(accountService, tokenService);
        await scheduleTransferHbar(accountService);
        await scheduleTransferToken(accountService, tokenService);
        await scheduleTransferNft(accountService, tokenService);
        console.log("All transfer scenarios complete.");
    } finally {
        context.client.close();
    }
}
void main().catch((error) => {
    console.error("transfer sample failed:", error);
    process.exitCode = 1;
});
