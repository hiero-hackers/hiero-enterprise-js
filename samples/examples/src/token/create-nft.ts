/**
 * Create NFT — provision a new non-fungible token (NFT) collection on Hiero.
 *
 * Demonstrates the two creation paths exposed by TokenService for NFTs:
 *
 * - `createNft`         — execute the collection creation immediately
 * - `scheduleCreateNft` — defer creation behind a scheduled transaction so
 *                         additional parties can sign before it executes
 *
 * The service forces `tokenType` to `NonFungibleUnique` and `decimals` /
 * `initialSupply` to `0`. A `supplyKey` is required because individual NFTs
 * are minted post-creation. When `maxSupply` is provided, `supplyType` is
 * auto-set to `Finite`.
 *
 * When the operator is not the treasury, the treasury key must sign — pass
 * it via `additionalSigners` on the options argument.
 *
 * Run: pnpm tsx src/token/create-nft.ts
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
 * Demonstrates creating an NFT collection immediately.
 *
 * A separate supply key is generated so the right to mint NFTs into the
 * collection can be delegated independently of treasury control. `maxSupply`
 * caps the collection at 10,000 NFTs and triggers `supplyType: Finite`
 * automatically.
 */
async function createNft(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Create NFT Collection ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "nft collection treasury",
    });
    console.log("Treasury account:", treasury.accountId);

    const supplyKey = PrivateKey.generateED25519();

    // Treasury key signs the create transaction (operator is not treasury).
    // The supply key itself does not need to sign creation — only future
    // mint transactions.

    const { tokenId: collectionId } = await tokenService.createNft({
        tokenName: "Acme Art",
        tokenSymbol: "ART",
        treasuryAccountId: treasury.accountId,
        supplyKey: supplyKey.publicKey,
        maxSupply: 10_000,
        additionalSigners: [treasuryKey],
    });

    console.log("Created NFT collection:", collectionId);
    console.log();
}

/**
 * Demonstrates scheduling NFT collection creation.
 *
 * Returns a `scheduleId` instead of a collection ID — the collection is not
 * created until enough required signers have signed the schedule (via
 * `ScheduleService`). Useful for curated drops where a curator must
 * co-approve before the collection comes into existence.
 */
async function scheduleCreateNft(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Schedule Create NFT Collection ===\n");

    const treasuryKey = PrivateKey.generateED25519();
    const treasury = await accountService.createAccount({
        publicKey: treasuryKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "scheduled nft collection treasury",
    });
    console.log("Treasury account:", treasury.accountId);

    const supplyKey = PrivateKey.generateED25519();

    // scheduleMemo lives on the schedule itself; the inner token-create
    // transaction is only executed once all required signers have signed.

    const scheduled = await tokenService.scheduleCreateNft(
        {
            tokenName: "Scheduled Acme Art",
            tokenSymbol: "SART",
            treasuryAccountId: treasury.accountId,
            supplyKey: supplyKey.publicKey,
            maxSupply: 5_000,
            additionalSigners: [treasuryKey],
        },
        { scheduleMemo: "pending curator approval" },
    );

    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);
    try {
        await createNft(accountService, tokenService);
        await scheduleCreateNft(accountService, tokenService);
        console.log("All NFT collection creation scenarios complete.");
    } finally {
        context.client.close();
    }
}
void main().catch((error) => {
    console.error("create-nft sample failed:", error);
    process.exitCode = 1;
});
