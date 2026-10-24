/**
 * Delete Token — mark an existing token as deleted on the network.
 *
 * Demonstrates the `deleteToken` path exposed by TokenService. Deletion
 * requires the token's admin key — pass it via `additionalSigners`. The
 * token must have been created with an `adminKey` set, otherwise the
 * token is immutable and cannot be deleted. Once deleted, the token
 * cannot be used for any operation (transfers, mints, associations, etc.).
 *
 * Note: `TokenDelete` is not whitelisted for scheduling on the network,
 * so no scheduled variant is exposed.
 *
 * Run: pnpm tsx src/token/delete-token.ts
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
 * Demonstrates deleting a token immediately.
 *
 * The token is created with an admin key up-front, then the admin key
 * signs the subsequent deletion via `additionalSigners`. Without the
 * admin key on the original create, the token would be immutable and
 * this deletion would be rejected by the network.
 */
async function deleteToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Delete Token ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "delete token treasury",
    });

    const adminKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Doomed Token",
        tokenSymbol: "DOOM",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: treasury.accountId,
        adminKey: adminKey.publicKey,
        supplyKey: treasuryKey.publicKey,
        additionalSigners: [treasuryKey, adminKey],
    });
    console.log("Created token:", tokenId);

    // Admin key signs because the token has an admin key — without it the
    // network will reject the deletion.
    await tokenService.deleteToken({
        tokenId,
        additionalSigners: [adminKey],
    });

    console.log("Deleted token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await deleteToken(accountService, tokenService);
        console.log("All token delete scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("delete-token sample failed:", error);
    process.exitCode = 1;
});
