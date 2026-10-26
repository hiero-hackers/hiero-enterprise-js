import { describe, it, expect, beforeAll } from "vitest";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";
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

async function tokenBalanceFor(
    accountService: AccountService,
    accountId: string | AccountId,
    tokenId: string | TokenId,
): Promise<string> {
    return (await accountService.getTokenBalance(accountId, tokenId)).balance;
}

describe("TokenService NFT airdrop operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("airdrops NFT serials to multiple associated receivers in one transaction", async () => {
        const receiver1 = await createTestAccount(accountService, 2);
        const receiver2 = await createTestAccount(accountService, 2);
        const receiver3 = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Multi NFT Airdrop Integration",
            tokenSymbol: "MNAI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [
                Buffer.from("nft-1"),
                Buffer.from("nft-2"),
                Buffer.from("nft-3"),
            ],
            additionalSigners: [owner.key],
        });

        for (const r of [receiver1, receiver2, receiver3]) {
            await tokenService.associateToken({
                accountId: r.accountId,
                tokenId,
                additionalSigners: [r.key],
            });
        }

        await tokenService.airdropNft({
            airdrops: [
                {
                    tokenId,
                    serial: 1,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver1.accountId,
                },
                {
                    tokenId,
                    serial: 2,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver2.accountId,
                },
                {
                    tokenId,
                    serial: 3,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver3.accountId,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // Each receiver should now hold exactly one NFT from the collection.
        for (const receiver of [receiver1, receiver2, receiver3]) {
            expect(
                await tokenBalanceFor(
                    accountService,
                    receiver.accountId,
                    tokenId,
                ),
            ).toBe("1");
        }
    });

    it("creates a pending NFT airdrop when the receiver is not associated and has no auto-association slots", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Pending NFT Airdrop Integration",
            tokenSymbol: "PNAI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("pending-nft")],
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

        // Pending airdrops are not credited until the receiver claims them,
        // so the account balance query should not list the collection.
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");
    });

    it("batches a mix of immediate-credit and pending NFT airdrops in one transaction", async () => {
        const associatedReceiver = await createTestAccount(accountService, 2);
        const pendingReceiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Mixed NFT Airdrop Integration",
            tokenSymbol: "MIXNAI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("mix-1"), Buffer.from("mix-2")],
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: associatedReceiver.accountId,
            tokenId,
            additionalSigners: [associatedReceiver.key],
        });

        await tokenService.airdropNft({
            airdrops: [
                {
                    tokenId,
                    serial: 1,
                    senderAccountId: owner.accountId,
                    receiverAccountId: associatedReceiver.accountId,
                },
                {
                    tokenId,
                    serial: 2,
                    senderAccountId: owner.accountId,
                    receiverAccountId: pendingReceiver.accountId,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();
        expect(
            await tokenBalanceFor(
                accountService,
                associatedReceiver.accountId,
                tokenId,
            ),
        ).toBe("1");
        expect(
            await tokenBalanceFor(
                accountService,
                pendingReceiver.accountId,
                tokenId,
            ),
        ).toBe("0");
    });
});
