import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import {
    queryHbarAllowances,
    queryTokenAllowances,
    queryNftRecord,
} from "../../../utils/MirrorNodeRest.js";
import { createOwnerSpenderPair } from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("AccountService approve-allowance operations [Integration]", () => {
    let client: AccountService;
    let tokenService: TokenService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new TokenService(ctx);
    });

    it("approves an HBAR allowance for a spender account", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const approveResult = await client.approveHbarAllowance({
            hbarAllowances: [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 5,
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveResult.status).toBe("SUCCESS");

        await waitForMirrorNodeRecord();

        const allowances = await queryHbarAllowances(owner.accountId);
        const match = allowances.find((a) => a.spender === spender.accountId);
        expect(match).toBeDefined();
        expect(match!.amount).toBe(500_000_000); // 5 HBAR in tinybars
    });

    it("approves a fungible token allowance for a spender account", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Allowance Test Token",
            tokenSymbol: "ATT",
            decimals: 2,
            initialSupply: 10000,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const approveResult = await client.approveTokenAllowance({
            tokenAllowances: [
                {
                    tokenId: tokenId.toString(),
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 500,
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveResult.status).toBe("SUCCESS");

        await waitForMirrorNodeRecord();

        const allowances = await queryTokenAllowances(owner.accountId);
        const match = allowances.find(
            (a) =>
                a.spender === spender.accountId &&
                a.token_id === tokenId.toString(),
        );
        expect(match).toBeDefined();
        expect(match!.amount).toBe(500);
    });

    it("approves an NFT allowance for specific serials", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Allowance NFT",
            tokenSymbol: "ANFT",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("meta-1"), Buffer.from("meta-2")],
            additionalSigners: [owner.key],
        });

        const approveResult = await client.approveNftAllowance({
            nftAllowances: [
                {
                    tokenId: tokenId.toString(),
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    serialNumbers: [1, 2],
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveResult.status).toBe("SUCCESS");

        await waitForMirrorNodeRecord();

        // Per-serial allowances are visible on individual NFT records, not the account allowances endpoint
        for (const serial of [1, 2]) {
            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.spender).toBe(spender.accountId);
        }
    });
});
