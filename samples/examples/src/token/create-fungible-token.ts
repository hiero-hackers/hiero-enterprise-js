/**
 * Create Fungible Token — provision a new fungible token (HTS) on Hiero.
 *
 * Demonstrates the two creation paths exposed by TokenService for fungible
 * tokens:
 *
 * - `createFungibleToken`         — execute the token creation immediately
 * - `scheduleCreateFungibleToken` — defer creation behind a scheduled
 *                                   transaction so additional parties can
 *                                   sign before it executes
 *
 * The service forces `tokenType` to `FungibleCommon` and auto-sets
 * `supplyType` to `Finite` when `maxSupply` is provided. When the operator
 * is not the treasury, the treasury key must sign — pass it via
 * `additionalSigners` on the options argument.
 *
 * Run: pnpm tsx src/token/create-fungible-token.ts
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
 * Demonstrates creating a fungible token immediately.
 *
 * The treasury is a fresh ED25519 account created up-front. Because the
 * treasury is not the operator, its key must sign the create transaction —
 * provided via `additionalSigners`. A supply key is supplied so the token
 * can be minted / burned later.
 */
async function createFungibleToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Create Fungible Token ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "fungible token treasury",
    });
    console.log("Treasury account:", treasury.accountId);

    // Treasury key signs because the operator is not the treasury — without
    // it the network will reject the transaction.

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Acme Coin",
        tokenSymbol: "ACME",
        decimals: 2,
        initialSupply: 1_000_000,
        treasuryAccountId: treasury.accountId,
        supplyKey: treasuryKey.publicKey,
        additionalSigners: [treasuryKey],
    });

    console.log("Created fungible token:", tokenId);
    console.log();
}

/**
 * Demonstrates scheduling fungible token creation.
 *
 * Returns a `scheduleId` instead of a token ID — the token is not created
 * until enough required signers have signed the schedule (via
 * `ScheduleService`). Useful for governance flows where multiple parties
 * must agree before a token comes into existence.
 *
 * An admin key is added here so a second signer is needed beyond the
 * treasury — both keys are passed via `additionalSigners`.
 */
async function scheduleCreateFungibleToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Create Fungible Token ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "scheduled fungible token treasury",
    });
    console.log("Treasury account:", treasury.accountId);

    const adminKey = PrivateKey.generateED25519();

    // Both treasury and admin keys are required signers — supply them via
    // additionalSigners. scheduleMemo is attached to the schedule itself,
    // not the inner token-create transaction.

    const scheduled = await tokenService.scheduleCreateFungibleToken(
        {
            tokenName: "Scheduled Acme Coin",
            tokenSymbol: "SACME",
            decimals: 2,
            initialSupply: 1_000_000,
            treasuryAccountId: treasury.accountId,
            adminKey: adminKey.publicKey,
            supplyKey: treasuryKey.publicKey,
            additionalSigners: [treasuryKey, adminKey],
        },
        { scheduleMemo: "pending treasury approval" },
    );

    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);
    try {
        await createFungibleToken(accountService, tokenService);
        await scheduleCreateFungibleToken(accountService, tokenService);
        console.log("All fungible token creation scenarios complete.");
    } finally {
        context.client.close();
    }
}
void main().catch((error) => {
    console.error("create-fungible-token sample failed:", error);
    process.exitCode = 1;
});
