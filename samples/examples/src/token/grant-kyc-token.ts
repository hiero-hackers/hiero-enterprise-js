/**
 * Grant KYC — mark a token relationship as KYC-approved for a specific
 * holder account.
 *
 * Demonstrates the immediate grant-KYC path exposed by TokenService:
 *
 * - `grantKycToken` — execute granting KYC immediately
 *
 * Once KYC is granted, the target account can send and receive the token.
 * The token must have been created with a KYC key, and that KYC key must
 * sign.
 *
 * Note: `TokenGrantKyc` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/grant-kyc-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function grantKycToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Grant KYC Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "grant kyc token owner",
    });

    const holderKey = PrivateKey.generateED25519();
    const holder = await accountService.createAccount({
        publicKey: holderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "grant kyc token holder",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Grant KYC Demo Token",
        tokenSymbol: "GKD",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        kycKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.associateToken({
        accountId: holder.accountId,
        tokenId,
        additionalSigners: [holderKey],
    });

    await tokenService.grantKycToken({
        tokenId,
        accountId: holder.accountId,
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Holder account:", holder.accountId);
    console.log("KYC-granted token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await grantKycToken(accountService, tokenService);
        console.log("All token grant-KYC scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("grant-kyc-token sample failed:", error);
    process.exitCode = 1;
});
