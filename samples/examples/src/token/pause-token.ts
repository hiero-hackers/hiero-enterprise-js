/**
 * Pause Token — block all operations on a token network-wide.
 *
 * Demonstrates the immediate pause path exposed by TokenService:
 *
 * - `pauseToken` — execute pausing the token immediately
 *
 * Once paused, no transfers, mints, burns, wipes, freezes / unfreezes,
 * grant / revoke KYC, or other operations are allowed on the token until
 * it is unpaused. The token must have been created with a pause key, and
 * that pause key must sign.
 *
 * Note: `TokenPause` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/pause-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function pauseToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Pause Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "pause token owner",
    });

    const pauseKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Pause Demo Token",
        tokenSymbol: "PSD",
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

    console.log("Owner account:", owner.accountId);
    console.log("Paused token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await pauseToken(accountService, tokenService);
        console.log("All token pause scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("pause-token sample failed:", error);
    process.exitCode = 1;
});
