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

describe("TokenService airdrop operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("airdrops fungible tokens to multiple associated receivers in one transaction", async () => {
        const receiver1 = await createTestAccount(accountService, 2);
        const receiver2 = await createTestAccount(accountService, 2);
        const receiver3 = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Multi Airdrop Integration",
            tokenSymbol: "MAIR",
            decimals: 0,
            initialSupply: 1000,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        for (const r of [receiver1, receiver2, receiver3]) {
            await tokenService.associateToken({
                accountId: r.accountId,
                tokenId,
                additionalSigners: [r.key],
            });
        }

        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver1.accountId,
                    amount: 10,
                },
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver2.accountId,
                    amount: 20,
                },
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver3.accountId,
                    amount: 30,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        const expectations = [
            { receiver: receiver1, balance: "10" },
            { receiver: receiver2, balance: "20" },
            { receiver: receiver3, balance: "30" },
        ];

        for (const { receiver, balance } of expectations) {
            expect(
                await tokenBalanceFor(
                    accountService,
                    receiver.accountId,
                    tokenId,
                ),
            ).toBe(balance);
        }
    });

    it("creates a pending airdrop when the receiver is not associated and has no auto-association slots", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Pending Airdrop Integration",
            tokenSymbol: "PAIR",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                    amount: 15,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // Pending airdrops are not credited until the receiver claims them,
        // so the account balance query should not list the token.
        expect(
            await tokenBalanceFor(accountService, receiver.accountId, tokenId),
        ).toBe("0");
    });

    it("batches a mix of immediate-credit and pending airdrops in one transaction", async () => {
        const associatedReceiver = await createTestAccount(accountService, 2);
        const pendingReceiver = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Mixed Airdrop Integration",
            tokenSymbol: "MIXAIR",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: associatedReceiver.accountId,
            tokenId,
            additionalSigners: [associatedReceiver.key],
        });

        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: associatedReceiver.accountId,
                    amount: 7,
                },
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: pendingReceiver.accountId,
                    amount: 11,
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
        ).toBe("7");
        expect(
            await tokenBalanceFor(
                accountService,
                pendingReceiver.accountId,
                tokenId,
            ),
        ).toBe("0");
    });
});
