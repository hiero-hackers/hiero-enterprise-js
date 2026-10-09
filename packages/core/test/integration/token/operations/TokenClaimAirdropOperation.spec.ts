import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/integration-fixtures.js";
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

describe("TokenService claim airdrop operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    /** Create a fungible token and leave 25 units pending for `receiver`. */
    async function pendingFungibleAirdrop(receiver: TestAccount) {
        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Claim Fungible Integration",
            tokenSymbol: "CLFI",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        // Receiver is not associated and has no auto-association slots,
        // so this becomes a pending airdrop.
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

        return tokenId;
    }

    it("claims a pending fungible airdrop and credits the receiver", async () => {
        const receiver = await createTestAccount(accountService, 2);
        const tokenId = await pendingFungibleAirdrop(receiver);

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");

        await tokenService.claimAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    tokenId,
                }),
            ],
            additionalSigners: [receiver.key],
        });

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("25");
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenId),
        ).toBe("75");
    });

    it("claims a pending NFT airdrop and moves the serial to the receiver", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Claim NFT Integration",
            tokenSymbol: "CLNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("claim-nft-1")],
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

        await tokenService.claimAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    nftId: new NftId(tokenId, 1),
                }),
            ],
            additionalSigners: [receiver.key],
        });

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("1");
        expect(
            await tokenBalanceFor(accountService, owner.accountId, tokenId),
        ).toBe("0");
    });

    it("rejects a claim that is not signed by the receiver", async () => {
        const receiver = await createTestAccount(accountService, 2);
        const tokenId = await pendingFungibleAirdrop(receiver);

        await expect(
            tokenService.claimAirdrop({
                pendingAirdropIds: [
                    new PendingAirdropId({
                        senderId: owner.accountId,
                        receiverId: receiver.accountId,
                        tokenId,
                    }),
                ],
            }),
        ).rejects.toThrow(/INVALID_SIGNATURE/);

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");
    });
});
