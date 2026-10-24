/**
 * Update Token — modify a mutable token's properties.
 *
 * Demonstrates the two update paths exposed by TokenService:
 *
 * - `updateToken`         — execute the update immediately
 * - `scheduleUpdateToken` — defer the update behind a scheduled
 *                           transaction so additional parties can sign
 *                           before it executes
 *
 * Only properties explicitly set on the options object are sent to the
 * network; omitted fields are left unchanged on the token. The token must
 * have an `adminKey` for any non-expiry update to succeed — the admin key
 * must sign every update transaction.
 *
 * Run: pnpm tsx src/token/update-token.ts
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
 * Demonstrates updating a token's name, symbol, and memo immediately.
 *
 * The token is created with an admin key up-front, then the admin key
 * signs the subsequent update via `additionalSigners`. Without the admin
 * key on the original create, the token would be immutable and this
 * update would be rejected by the network.
 */
async function updateToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Update Token ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "update token treasury",
    });

    const adminKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Original Name",
        tokenSymbol: "ORG",
        decimals: 2,
        initialSupply: 1_000,
        treasuryAccountId: treasury.accountId,
        adminKey: adminKey.publicKey,
        supplyKey: treasuryKey.publicKey,
        tokenMemo: "initial memo",
        additionalSigners: [treasuryKey, adminKey],
    });
    console.log("Created token:", tokenId);

    // Admin key signs because the token has an admin key — only fields set
    // on the options object are updated; everything else is unchanged.
    await tokenService.updateToken({
        tokenId,
        tokenName: "Renamed Token",
        tokenSymbol: "RNM",
        tokenMemo: "updated memo",
        additionalSigners: [adminKey],
    });

    console.log("Updated token name/symbol/memo for:", tokenId);
    console.log();
}

/**
 * Demonstrates scheduling a token update.
 *
 * Returns a `scheduleId` instead of executing the update — the update is
 * not applied until enough required signers have signed the schedule (via
 * `ScheduleService`). Useful for governance flows where multiple parties
 * must agree before a token's metadata changes.
 */
async function scheduleUpdateToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Update Token ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "scheduled update treasury",
    });

    const adminKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Scheduled Original",
        tokenSymbol: "SORG",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: treasury.accountId,
        adminKey: adminKey.publicKey,
        supplyKey: treasuryKey.publicKey,
        additionalSigners: [treasuryKey, adminKey],
    });
    console.log("Created token:", tokenId);

    const scheduled = await tokenService.scheduleUpdateToken(
        {
            tokenId,
            tokenName: "Scheduled Renamed",
            tokenSymbol: "SRN",
            additionalSigners: [adminKey],
        },
        { scheduleMemo: "pending governance approval" },
    );

    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await updateToken(accountService, tokenService);
        await scheduleUpdateToken(accountService, tokenService);
        console.log("All token update scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("update-token sample failed:", error);
    process.exitCode = 1;
});
