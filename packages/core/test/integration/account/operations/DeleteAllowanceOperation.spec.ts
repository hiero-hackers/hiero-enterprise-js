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

describe("AccountService delete-allowance operations [Integration]", () => {
    let client: AccountService;
    let tokenService: TokenService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new TokenService(ctx);
    });

    it("deletes an HBAR allowance by setting amount to 0", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        // First grant the allowance so there's something to revoke
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

        const granted = await queryHbarAllowances(owner.accountId);
        expect(
            granted.find((a) => a.spender === spender.accountId),
        ).toBeDefined();

        // Now revoke it
        const deleteResult = await client.deleteHbarAllowance(
            [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                },
            ],
            { additionalSigners: [owner.key] },
        );
        expect(deleteResult.status).toBe("SUCCESS");
        await waitForMirrorNodeRecord();

        const after = await queryHbarAllowances(owner.accountId);
        const match = after.find((a) => a.spender === spender.accountId);
        // Mirror node either removes the entry or reports amount=0 after revocation
        expect(match === undefined || match.amount === 0).toBe(true);
    });

    it("deletes a fungible token allowance by setting amount to 0", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Delete Allowance Token",
            tokenSymbol: "DAT",
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

        const granted = await queryTokenAllowances(owner.accountId);
        expect(
            granted.find(
                (a) =>
                    a.spender === spender.accountId &&
                    a.token_id === tokenId.toString(),
            ),
        ).toBeDefined();

        // Revoke it
        const deleteResult = await client.deleteTokenAllowance(
            [
                {
                    tokenId: tokenId.toString(),
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                },
            ],
            { additionalSigners: [owner.key] },
        );
        expect(deleteResult.status).toBe("SUCCESS");
        await waitForMirrorNodeRecord();

        const after = await queryTokenAllowances(owner.accountId);
        const match = after.find(
            (a) =>
                a.spender === spender.accountId &&
                a.token_id === tokenId.toString(),
        );
        expect(match === undefined || match.amount === 0).toBe(true);
    });

    it("deletes an NFT allowance for specific serials", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Delete NFT Allowance",
            tokenSymbol: "DNAL",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("meta-1"), Buffer.from("meta-2")],
            additionalSigners: [owner.key],
        });

        // Grant per-serial allowance
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

        // Verify spender was set on both serials
        for (const serial of [1, 2]) {
            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.spender).toBe(spender.accountId);
        }

        // Revoke per-serial allowance
        const deleteResult = await client.deleteNftAllowance(
            [
                {
                    tokenId: tokenId.toString(),
                    ownerAccountId: owner.accountId,
                    serialNumbers: [1, 2],
                },
            ],
            { additionalSigners: [owner.key] },
        );
        expect(deleteResult.status).toBe("SUCCESS");
        await waitForMirrorNodeRecord();

        // Verify spender was cleared on both serials
        for (const serial of [1, 2]) {
            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.spender == null).toBe(true);
        }
    });
});
