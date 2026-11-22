/**
 * Unfreeze Token — restore a previously frozen token relationship on a
 * specific holder account.
 *
 * Demonstrates the immediate unfreeze path exposed by TokenService:
 *
 * - `unfreezeToken` — execute unfreezing immediately
 *
 * Unfreezing restores the target account's ability to send and receive
 * the token after a prior `freezeToken`. The token must have been created
 * with a freeze key, and that freeze key must sign.
 *
 * Note: `TokenUnfreeze` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/token/unfreeze-token.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function unfreezeToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Unfreeze Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "unfreeze token owner",
    });

    const holderKey = PrivateKey.generateED25519();
    const holder = await accountService.createAccount({
        publicKey: holderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "unfreeze token holder",
    });

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Unfreeze Demo Token",
        tokenSymbol: "UDT",
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

    await tokenService.unfreezeToken({
        tokenId,
        accountId: holder.accountId,
        additionalSigners: [ownerKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Holder account:", holder.accountId);
    console.log("Unfrozen token:", tokenId);
    console.log();
}

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await unfreezeToken(accountService, tokenService);
        console.log("All token unfreeze scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("unfreeze-token sample failed:", error);
    process.exitCode = 1;
});
