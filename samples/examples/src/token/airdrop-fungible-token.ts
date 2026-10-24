/**
 * Airdrop Fungible Token — distribute fungible tokens from one or more
 * senders to one or more receivers in a single transaction.
 *
 * Demonstrates the batched `airdropFungibleToken` API exposed by
 * TokenService. Behaviour per receiver depends on its association state:
 *
 * - Already associated: tokens are credited immediately.
 * - Has free auto-association slots: token is auto-associated and credited.
 * - Receiver-sig-required or no auto-association slots: a "Pending
 *   Airdrop" is created that the receiver can later claim.
 *
 * This sample walks through three scenarios:
 *  1. Multi-receiver batch where every receiver is pre-associated —
 *     all balances are credited immediately.
 *  2. Unassociated receiver — produces a pending airdrop, so the account
 *     balance query still reports no token relationship.
 *  3. Mixed batch — one associated and one unassociated receiver in the
 *     same transaction, with mixed outcomes.
 *
 * Every distinct sender's key must sign — supplied via `additionalSigners`.
 *
 * Note: `TokenAirdrop` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/airdrop-fungible-token.ts
 */

import { type AccountId, type TokenId, PrivateKey } from "@hiero-ledger/sdk";
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

async function multiReceiverImmediateCredit(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 1: Multi-receiver immediate credit ===\n");

    const owner = await createKeyedAccount(accountService, 5, "airdrop owner");
    const receiver1 = await createKeyedAccount(accountService, 2, "receiver 1");
    const receiver2 = await createKeyedAccount(accountService, 2, "receiver 2");
    const receiver3 = await createKeyedAccount(accountService, 2, "receiver 3");

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Multi Airdrop Demo Token",
        tokenSymbol: "MAIR",
        decimals: 0,
        initialSupply: 1000,
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    for (const r of [receiver1, receiver2, receiver3]) {
        await tokenService.associateToken({
            accountId: r.accountId,
            tokenId,
            additionalSigners: [r.key],
        });
    }

    await tokenService.airdropFungibleToken({
        airdrops: [
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver1.accountId.toString(),
                amount: 10,
            },
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver2.accountId.toString(),
                amount: 20,
            },
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver3.accountId.toString(),
                amount: 30,
            },
        ],
        additionalSigners: [owner.key],
    });

    console.log("Token:", tokenId);
    for (const r of [receiver1, receiver2, receiver3]) {
        await waitForMirror();
        console.log(
            `  ${r.accountId} balance:`,
            await tokenBalanceFor(accountService, r.accountId, tokenId),
        );
    }
    console.log();
}

async function pendingAirdropToUnassociatedReceiver(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log(
        "=== Scenario 2: Pending airdrop (unassociated receiver) ===\n",
    );

    const owner = await createKeyedAccount(accountService, 5, "airdrop owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "pending receiver",
    );

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Pending Airdrop Demo Token",
        tokenSymbol: "PAIR",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    // Receiver is NOT associated and has no auto-association slots, so the
    // network records a Pending Airdrop the receiver can later claim.
    await tokenService.airdropFungibleToken({
        airdrops: [
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: receiver.accountId.toString(),
                amount: 15,
            },
        ],
        additionalSigners: [owner.key],
    });

    await waitForMirror();
    const credited = await tokenBalanceFor(
        accountService,
        receiver.accountId,
        tokenId,
    );

    console.log("Token:", tokenId);
    console.log("Receiver account:", receiver.accountId);
    console.log(
        "Receiver balance (token):",
        credited ?? "<no relationship — pending airdrop>",
    );
    console.log(
        "(The receiver must claim the pending airdrop to credit these 15 units.)",
    );
    console.log();
}

async function mixedBatch(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log(
        "=== Scenario 3: Mixed batch — one associated + one pending ===\n",
    );

    const owner = await createKeyedAccount(accountService, 5, "airdrop owner");
    const associated = await createKeyedAccount(
        accountService,
        2,
        "associated receiver",
    );
    const unassociated = await createKeyedAccount(
        accountService,
        2,
        "unassociated receiver",
    );

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Mixed Airdrop Demo Token",
        tokenSymbol: "MIXAIR",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.associateToken({
        accountId: associated.accountId,
        tokenId,
        additionalSigners: [associated.key],
    });

    await tokenService.airdropFungibleToken({
        airdrops: [
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: associated.accountId.toString(),
                amount: 7,
            },
            {
                tokenId,
                senderAccountId: owner.accountId.toString(),
                receiverAccountId: unassociated.accountId.toString(),
                amount: 11,
            },
        ],
        additionalSigners: [owner.key],
    });

    await waitForMirror();

    console.log("Token:", tokenId);
    console.log(
        "  Associated receiver",
        associated.accountId,
        "balance:",
        await tokenBalanceFor(accountService, associated.accountId, tokenId),
    );
    console.log(
        "  Unassociated receiver",
        unassociated.accountId,
        "balance:",
        await tokenBalanceFor(accountService, unassociated.accountId, tokenId),
    );
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await multiReceiverImmediateCredit(accountService, tokenService);
        await pendingAirdropToUnassociatedReceiver(
            accountService,
            tokenService,
        );
        await mixedBatch(accountService, tokenService);
        console.log("All token airdrop scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("airdrop-fungible-token sample failed:", error);
    process.exitCode = 1;
});
