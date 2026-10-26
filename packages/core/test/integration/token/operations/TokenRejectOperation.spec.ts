import { describe, it, expect, beforeAll } from "vitest";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { NftId } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import {
    waitForMirrorNodeRecord,
    waitForAccountTokensAbsent,
} from "../../../utils/MirrorNode.js";
import { queryAccountTokens } from "../../../utils/MirrorNodeRest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

async function tokenBalanceFor(
    accountService: AccountService,
    accountId: string | AccountId,
    tokenId: string | TokenId,
): Promise<string> {
    return (await accountService.getTokenBalance(accountId, tokenId)).balance;
}

describe("TokenService reject operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("rejects fungible tokens, returning supply to the treasury and dissociating the holder", async () => {
        const holder = await createTestAccount(accountService, 2);
        const initialSupply = 1_000;
        const transferAmount = 250;

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Reject Fungible Integration",
            tokenSymbol: "RFI",
            decimals: 0,
            initialSupply,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: holder.accountId,
            tokenId,
            additionalSigners: [holder.key],
        });

        await accountService.transferToken(
            tokenId,
            holder.accountId,
            transferAmount,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        await waitForMirrorNodeRecord();

        // Sanity: holder owns the transferred amount, treasury debited.
        expect(
            await tokenBalanceFor(accountService, holder.accountId, tokenId),
        ).toBe(String(transferAmount));

        await tokenService.rejectTokensFlow({
            ownerId: holder.accountId,
            fungibleTokenIds: [tokenId],
            ownerKey: holder.key,
        });

        // TokenRejectFlow submits TWO inner transactions (reject + dissociate)
        // but only the first one's ID flows into IntegrationTracker. Wait for
        // the dissociate's effect directly so the assertion isn't racing the
        // mirror node.
        await waitForMirrorNodeRecord();
        await waitForAccountTokensAbsent(holder.accountId, [tokenId]);

        // Post-reject: holder is dissociated from the token (no relationship)
        // and the treasury supply has been restored in full.
        const holderTokens = await queryAccountTokens(holder.accountId);
        expect(
            holderTokens.find((t) => t.token_id === tokenId.toString()),
        ).toBeUndefined();
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenId),
        ).toBe(String(initialSupply));
    });

    it("rejects NFT serials, returning them to the treasury and dissociating the holder", async () => {
        const holder = await createTestAccount(accountService, 2);

        // HIP-904 requires every TokenReference in a single TokenReject
        // to have a unique token ID, so we mint TWO collections and
        // transfer one serial of each to the holder. Rejecting both in
        // one flow also exercises the dissociate step for two tokens.
        const { tokenId: tokenIdA } = await tokenService.createNft({
            tokenName: "Reject NFT A",
            tokenSymbol: "RNA",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const { tokenId: tokenIdB } = await tokenService.createNft({
            tokenName: "Reject NFT B",
            tokenSymbol: "RNB",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId: tokenIdA,
            metadata: [Buffer.from("a-1")],
            additionalSigners: [owner.key],
        });
        await tokenService.mintToken({
            tokenId: tokenIdB,
            metadata: [Buffer.from("b-1")],
            additionalSigners: [owner.key],
        });

        for (const tokenId of [tokenIdA, tokenIdB]) {
            await tokenService.associateToken({
                accountId: holder.accountId,
                tokenId,
                additionalSigners: [holder.key],
            });
        }

        await accountService.transferNft(
            tokenIdA,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );
        await accountService.transferNft(
            tokenIdB,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, holder.accountId, tokenIdA),
        ).toBe("1");
        expect(
            await tokenBalanceFor(accountService, holder.accountId, tokenIdB),
        ).toBe("1");

        await tokenService.rejectTokensFlow({
            ownerId: holder.accountId,
            nftIds: [new NftId(tokenIdA, 1), new NftId(tokenIdB, 1)],
            ownerKey: holder.key,
        });

        await waitForMirrorNodeRecord();
        await waitForAccountTokensAbsent(holder.accountId, [
            tokenIdA,
            tokenIdB,
        ]);

        // Holder is dissociated from both collections; each treasury
        // holds its only serial again.
        const holderTokens = await queryAccountTokens(holder.accountId);
        expect(
            holderTokens.find((t) => t.token_id === tokenIdA.toString()),
        ).toBeUndefined();
        expect(
            holderTokens.find((t) => t.token_id === tokenIdB.toString()),
        ).toBeUndefined();
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenIdA),
        ).toBe("1");
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenIdB),
        ).toBe("1");
    });

    it("rejects fungible tokens and NFT serials in a single call", async () => {
        const holder = await createTestAccount(accountService, 2);
        const fungibleSupply = 500;
        const fungibleTransfer = 100;

        const { tokenId: fungibleTokenId } =
            await tokenService.createFungibleToken({
                tokenName: "Reject Mixed Fungible",
                tokenSymbol: "RMF",
                decimals: 0,
                initialSupply: fungibleSupply,
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });

        const { tokenId: nftTokenId } = await tokenService.createNft({
            tokenName: "Reject Mixed NFT",
            tokenSymbol: "RMN",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId: nftTokenId,
            metadata: [Buffer.from("mix-1"), Buffer.from("mix-2")],
            additionalSigners: [owner.key],
        });

        for (const tokenId of [fungibleTokenId, nftTokenId]) {
            await tokenService.associateToken({
                accountId: holder.accountId,
                tokenId,
                additionalSigners: [holder.key],
            });
        }

        await accountService.transferToken(
            fungibleTokenId,
            holder.accountId,
            fungibleTransfer,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );
        await accountService.transferNft(
            nftTokenId,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        await waitForMirrorNodeRecord();

        await tokenService.rejectTokensFlow({
            ownerId: holder.accountId,
            fungibleTokenIds: [fungibleTokenId],
            nftIds: [new NftId(nftTokenId, 1)],
            ownerKey: holder.key,
        });

        await waitForMirrorNodeRecord();
        await waitForAccountTokensAbsent(holder.accountId, [
            fungibleTokenId,
            nftTokenId,
        ]);

        // Both relationships are gone after the dissociation step of the flow.
        const holderTokens = await queryAccountTokens(holder.accountId);
        expect(
            holderTokens.find((t) => t.token_id === fungibleTokenId.toString()),
        ).toBeUndefined();
        expect(
            holderTokens.find((t) => t.token_id === nftTokenId.toString()),
        ).toBeUndefined();

        // Treasury supply has been restored for both.
        expect(
            await tokenBalanceFor(
                accountService,
                owner.accountId,
                fungibleTokenId,
            ),
        ).toBe(String(fungibleSupply));
        expect(
            await tokenBalanceFor(accountService, owner.accountId, nftTokenId),
        ).toBe("2");
    });

    it("throws when neither fungibleTokenIds nor nftIds is supplied", async () => {
        await expect(
            tokenService.rejectTokensFlow({
                ownerId: owner.accountId,
                ownerKey: owner.key,
            }),
        ).rejects.toThrow(/at least one fungibleTokenId or nftId/i);
    });
});
