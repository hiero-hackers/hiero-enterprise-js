/**
 * Unpause Token — restore operations on a previously paused token.
 *
 * Demonstrates the immediate unpause path exposed by TokenService:
 *
 * - `unpauseToken` — execute unpausing the token immediately
 *
 * Once unpaused, transfers, mints, burns, wipes, freezes / unfreezes,
 * grant / revoke KYC, and other operations resume on the token. The
 * token must have been created with a pause key, and that pause key
 * must sign.
 *
 * Note: `TokenUnpause` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/unpause-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function unpauseToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Unpause Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "unpause token owner",
    });

    const pauseKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Unpause Demo Token",
        tokenSymbol: "UPD",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        pauseKey: pauseKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.pauseToken({
        tokenId,
        additionalSigners: [pauseKey],
    });

    await tokenService.unpauseToken({
        tokenId,
        additionalSigners: [pauseKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Unpaused token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await unpauseToken(accountService, tokenService);
        console.log("All token unpause scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("unpause-token sample failed:", error);
    process.exitCode = 1;
});
