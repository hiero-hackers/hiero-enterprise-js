/**
 * Freeze Token — freeze a token relationship on a specific holder account.
 *
 * Demonstrates the immediate freeze path exposed by TokenService:
 *
 * - `freezeToken` — execute freezing immediately
 *
 * Freezing prevents the target account from sending or receiving the token
 * until unfrozen. The token must have been created with a freeze key, and
 * that freeze key must sign.
 *
 * Note: `TokenFreeze` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/freeze-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function freezeToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Freeze Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "freeze token owner",
    });

    const holderKey = PrivateKey.generateED25519();
    const holder = await accountService.createAccount({
        publicKey: holderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "freeze token holder",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Freeze Demo Token",
        tokenSymbol: "FDT",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        freezeKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.associateToken({
        accountId: holder.accountId,
        tokenId,
        additionalSigners: [holderKey],
    });

    await tokenService.freezeToken({
        tokenId,
        accountId: holder.accountId,
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Holder account:", holder.accountId);
    console.log("Frozen token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await freezeToken(accountService, tokenService);
        console.log("All token freeze scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("freeze-token sample failed:", error);
    process.exitCode = 1;
});
