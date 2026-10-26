/**
 * Update Token Fee Schedule — replace a token's custom fee schedule with
 * a new set of custom fees.
 *
 * Demonstrates the `updateTokenFeeSchedule` path exposed by TokenService.
 * Pass an empty `customFees` array to clear all custom fees. The token
 * must have been created with a fee-schedule key, and that fee-schedule
 * key must sign.
 *
 * Note: `TokenFeeScheduleUpdate` is not whitelisted for scheduling on the
 * network, so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/update-token-fee-schedule.ts
 */

import { CustomFixedFee, PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    HieroContext,
    TokenService,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function updateTokenFeeSchedule(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Update Token Fee Schedule ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "fee schedule update owner",
    });

    const feeScheduleKey = PrivateKey.generateED25519();

    const { tokenId } = await tokenService.createFungibleToken({
        tokenName: "Fee Schedule Demo Token",
        tokenSymbol: "FSD",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        feeScheduleKey: feeScheduleKey.publicKey,
        additionalSigners: [ownerKey],
    });

    const fee = new CustomFixedFee()
        .setAmount(1)
        .setFeeCollectorAccountId(owner.accountId);

    await tokenService.updateTokenFeeSchedule({
        tokenId,
        customFees: [fee],
        additionalSigners: [feeScheduleKey],
    });

    console.log("Owner account:", owner.accountId);
    console.log("Token with updated fee schedule:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await updateTokenFeeSchedule(accountService, tokenService);
        console.log("All token fee-schedule update scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("update-token-fee-schedule sample failed:", error);
    process.exitCode = 1;
});
