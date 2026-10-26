/**
 * Revoke KYC — remove KYC approval from a token relationship for a
 * specific holder account.
 *
 * Demonstrates the immediate revoke-KYC path exposed by TokenService:
 *
 * - `revokeKycToken` — execute revoking KYC immediately
 *
 * Once KYC is revoked, the target account can no longer send or receive
 * the token until KYC is re-granted. The token must have been created
 * with a KYC key, and that KYC key must sign.
 *
 * Note: `TokenRevokeKyc` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/revoke-kyc-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function revokeKycToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Revoke KYC Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "revoke kyc token owner",
    });

    const holderKey = PrivateKey.generateED25519();
    const holder = await accountService.createAccount({
        publicKey: holderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "revoke kyc token holder",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Revoke KYC Demo Token",
        tokenSymbol: "RKD",
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

    await tokenService.revokeKycToken({
        tokenId,
        accountId: holder.accountId,
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Holder account:", holder.accountId);
    console.log("KYC-revoked token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await revokeKycToken(accountService, tokenService);
        console.log("All token revoke-KYC scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("revoke-kyc-token sample failed:", error);
    process.exitCode = 1;
});
