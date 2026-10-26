import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { createOwnerSpenderPair } from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("AccountService.deleteAllNftAllowances [Integration]", () => {
    let client: AccountService;
    let tokenService: TokenService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new TokenService(ctx);
    });

    it("deletes an approve-for-all-serials NFT allowance", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Delete All NFT Allowance",
            tokenSymbol: "DANAL",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("meta-1")],
            additionalSigners: [owner.key],
        });

        // Grant approve-for-all-serials. We verify success via the returned
        // receipt's status field rather than via a mirror-node lookup because
        // the Solo (local) Mirror Node does not populate the
        // `/api/v1/accounts/{id}/allowances/nfts` derived view.
        const approveResult = await client.approveNftAllowance({
            nftAllowances: [
                {
                    tokenId: tokenId.toString(),
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    allSerials: true,
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveResult.status).toBe("SUCCESS");

        // Revoke approve-for-all-serials. Same verification strategy — the
        // receipt status is the source of truth for this assertion.
        const deleteResult = await client.deleteAllNftAllowances(
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
    });
});
