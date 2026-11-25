import { describe, it, expect, beforeAll } from "vitest";
import { Hbar } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import {
    createTestAccount,
    createOwnerSpenderPair,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

const tinybars = async (client: AccountService, accountId: string) =>
    BigInt((await client.getAccountBalance(accountId)).tinybars);

describe("TransferOperation [Integration]", () => {
    let client: AccountService;
    let tokenService: TokenService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new TokenService(ctx);
    });

    describe("transfer", () => {
        it("sends HBAR from several senders to several receivers", async () => {
            const sender1 = await createTestAccount(client, 5);
            const sender2 = await createTestAccount(client, 5);
            const receiver1 = await createTestAccount(client, 0);
            const receiver2 = await createTestAccount(client, 0);

            const result = await client.transfer({
                hbarTransfers: [
                    { accountId: sender1.accountId, amount: -2 },
                    { accountId: sender2.accountId, amount: -1 },
                    { accountId: receiver1.accountId, amount: 1 },
                    {
                        accountId: receiver2.accountId,
                        amount: Hbar.fromTinybars(200_000_000),
                    },
                ],
                additionalSigners: [sender1.key, sender2.key],
            });

            expect(result.status).toBe("SUCCESS");

            await waitForMirrorNodeRecord();

            expect(await tinybars(client, receiver1.accountId)).toBe(
                100_000_000n,
            );
            expect(await tinybars(client, receiver2.accountId)).toBe(
                200_000_000n,
            );
        });

        it("sends HBAR and a fungible token in one transaction", async () => {
            const owner = await createTestAccount(client, 10);
            const buyer = await createTestAccount(client, 5);
            const { tokenId } = await tokenService.createFungibleToken({
                tokenName: "Swap Token",
                tokenSymbol: "SWAP",
                decimals: 0,
                initialSupply: 100,
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });
            await tokenService.associateToken({
                tokenId,
                accountId: buyer.accountId,
                additionalSigners: [buyer.key],
            });

            // The buyer pays the owner 0.5 HBAR for 10 tokens.
            await client.transfer({
                hbarTransfers: [
                    { accountId: buyer.accountId, amount: -0.5 },
                    { accountId: owner.accountId, amount: 0.5 },
                ],
                tokenTransfers: [
                    { tokenId, accountId: owner.accountId, amount: -10 },
                    { tokenId, accountId: buyer.accountId, amount: 10 },
                ],
                additionalSigners: [owner.key, buyer.key],
            });

            await waitForMirrorNodeRecord();

            const { balance } = await client.getTokenBalance(
                buyer.accountId,
                tokenId,
            );
            expect(balance).toBe("10");
        });

        it("spends an HBAR allowance with the spender as payer", async () => {
            const { owner, spender } = await createOwnerSpenderPair(client);
            const receiver = await createTestAccount(client, 0);

            await client.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: owner.accountId,
                        spenderAccountId: spender.accountId,
                        amount: 2,
                    },
                ],
                additionalSigners: [owner.key],
            });

            // Only the spender signs; the owner's leg is approved.
            const result = await client.transfer({
                hbarTransfers: [
                    { accountId: owner.accountId, amount: -1, approved: true },
                    { accountId: receiver.accountId, amount: 1 },
                ],
                payer: spender.accountId,
                additionalSigners: [spender.key],
            });

            expect(
                result.transactionId.startsWith(`${spender.accountId}@`),
            ).toBe(true);

            await waitForMirrorNodeRecord();

            expect(await tinybars(client, receiver.accountId)).toBe(
                100_000_000n,
            );
        });

        it("rejects legs that don't sum to zero before submitting to the network", async () => {
            const receiver = await createTestAccount(client, 0);

            await expect(
                client.transfer({
                    hbarTransfers: [
                        { accountId: receiver.accountId, amount: 1 },
                    ],
                }),
            ).rejects.toMatchObject({
                code: "INPUT_INVALID",
                sdkStatus: "INVALID_ACCOUNT_AMOUNTS",
            });
        });
    });

    describe("scheduleTransfer", () => {
        it("returns a scheduleId for a scheduled multi-party transfer", async () => {
            const sender1 = await createTestAccount(client, 2);
            const sender2 = await createTestAccount(client, 2);
            const receiver = await createTestAccount(client, 0);

            const result = await client.scheduleTransfer({
                hbarTransfers: [
                    { accountId: sender1.accountId, amount: -1 },
                    { accountId: sender2.accountId, amount: -1 },
                    { accountId: receiver.accountId, amount: 2 },
                ],
                scheduleMemo: "integration test schedule",
            });

            expect(result.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
        });
    });
});
