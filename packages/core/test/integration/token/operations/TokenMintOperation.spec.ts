import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { queryNftRecord } from "../../../utils/MirrorNodeRest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TokenService mint operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("mints NFT serials via metadata", async () => {
        const { tokenId } = await tokenService.createNft({
            tokenName: "Mint NFT Integration",
            tokenSymbol: "MNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const mint = await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("meta-1"), Buffer.from("meta-2")],
            additionalSigners: [owner.key],
        });

        // Live proof of MintResult: the network assigns serials 1 and 2 to
        // a fresh collection, and the floor fields ride along.
        expect(mint.serials).toEqual([1, 2]);
        expect(mint.totalSupply).toBe("2");
        expect(mint.status).toBe("SUCCESS");

        await waitForMirrorNodeRecord();

        const nft1 = await queryNftRecord(tokenId, 1);
        const nft2 = await queryNftRecord(tokenId, 2);

        expect(nft1.token_id).toBe(tokenId.toString());
        expect(nft1.account_id).toBe(owner.accountId);
        expect(nft2.token_id).toBe(tokenId.toString());
        expect(nft2.account_id).toBe(owner.accountId);
    });

    it("schedules NFT minting and returns a scheduleId", async () => {
        const { tokenId } = await tokenService.createNft({
            tokenName: "Scheduled Mint NFT",
            tokenSymbol: "SMNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const scheduled = await tokenService.scheduleMintToken(
            {
                tokenId,
                metadata: [Buffer.from("scheduled-meta")],
                additionalSigners: [owner.key],
            },
            { scheduleMemo: "integration scheduled mint" },
        );

        expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
    });
});
