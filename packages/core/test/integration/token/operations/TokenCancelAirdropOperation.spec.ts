import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";
import { NftId, PendingAirdropId } from "@hiero-ledger/sdk";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";

async function tokenBalanceFor(
    accountService: AccountService,
    accountId: string | AccountId,
    tokenId: string | TokenId,
): Promise<string> {
    return (await accountService.getTokenBalance(accountId, tokenId)).balance;
}

describe("TokenService cancel airdrop operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("cancels a pending fungible airdrop so the receiver never receives the token", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Cancel Fungible Integration",
            tokenSymbol: "CFI",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        // Receiver is not associated and has no auto-association slots,
        // so this becomes a pending airdrop held in escrow.
        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                    amount: 25,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // Sanity: the pending airdrop has not credited the receiver.
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");

        // The sender (owner) cancels the pending airdrop.
        await tokenService.cancelAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    tokenId: tokenId,
                }),
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // The receiver was never credited (cancel removed the pending entry).
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");

        // The owner (treasury) still holds the full supply: the escrow was
        // released back to the sender's available balance.
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenId),
        ).toBe("100");
    });

    it("cancels a pending NFT airdrop so the serial stays with the treasury", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Cancel NFT Integration",
            tokenSymbol: "CNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("cancel-nft-1")],
            additionalSigners: [owner.key],
        });

        await tokenService.airdropNft({
            airdrops: [
                {
                    tokenId,
                    serial: 1,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");

        await tokenService.cancelAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    nftId: new NftId(tokenId, 1),
                }),
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");

        // The owner (treasury) still holds the minted serial.
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenId),
        ).toBe("1");
    });

    it("cancels a mixed batch of pending fungible and NFT airdrops in one transaction", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const { tokenId: fungibleTokenId } =
            await tokenService.createFungibleToken({
                tokenName: "Cancel Batch Fungible Integration",
                tokenSymbol: "CBFI",
                decimals: 0,
                initialSupply: 100,
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });

        const { tokenId: nftTokenId } = await tokenService.createNft({
            tokenName: "Cancel Batch NFT Integration",
            tokenSymbol: "CBNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId: nftTokenId,
            metadata: [Buffer.from("batch-cancel-nft-1")],
            additionalSigners: [owner.key],
        });

        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: fungibleTokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                    amount: 12,
                },
            ],
            additionalSigners: [owner.key],
        });

        await tokenService.airdropNft({
            airdrops: [
                {
                    tokenId: nftTokenId,
                    serial: 1,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // One cancel transaction recalls both pending airdrops atomically.
        await tokenService.cancelAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    tokenId: fungibleTokenId,
                }),
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    nftId: new NftId(nftTokenId, 1),
                }),
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(
                accountService,
                receiver.accountId,
                fungibleTokenId,
            ),
        ).toBe("0");
        expect(
            await tokenBalanceFor(
                accountService,
                receiver.accountId,
                nftTokenId,
            ),
        ).toBe("0");
        expect(
            await tokenBalanceFor(
                accountService,
                owner.accountId,
                fungibleTokenId,
            ),
        ).toBe("100");
        expect(
            await tokenBalanceFor(accountService, owner.accountId, nftTokenId),
        ).toBe("1");
    });
});
