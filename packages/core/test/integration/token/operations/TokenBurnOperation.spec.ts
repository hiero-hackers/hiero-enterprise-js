import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { queryTokenInfo } from "../../../utils/MirrorNodeRest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TokenService burn operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("burns fungible supply via amount", async () => {
        const initialSupply = 1_000;
        const burnAmount = 250;

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Burn Fungible Integration",
            tokenSymbol: "BFI",
            decimals: 0,
            initialSupply,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const newTotalSupply = await tokenService.burnToken({
            tokenId,
            amount: burnAmount,
            additionalSigners: [owner.key],
        });

        expect(newTotalSupply.totalSupply).toBe(
            String(initialSupply - burnAmount),
        );

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.total_supply).toBe(String(initialSupply - burnAmount));
    });

    it("burns specific NFT serials", async () => {
        const { tokenId } = await tokenService.createNft({
            tokenName: "Burn NFT Integration",
            tokenSymbol: "BNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [
                Buffer.from("burn-meta-1"),
                Buffer.from("burn-meta-2"),
                Buffer.from("burn-meta-3"),
            ],
            additionalSigners: [owner.key],
        });

        const newTotalSupply = await tokenService.burnToken({
            tokenId,
            serials: [1, 2],
            additionalSigners: [owner.key],
        });

        // 3 minted - 2 burned = 1 remaining
        expect(newTotalSupply.totalSupply).toBe("1");

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.total_supply).toBe("1");
    });

    it("schedules a token burn and returns a scheduleId", async () => {
        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Scheduled Burn",
            tokenSymbol: "SBN",
            decimals: 0,
            initialSupply: 500,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const scheduled = await tokenService.scheduleBurnToken(
            {
                tokenId,
                amount: 100,
                additionalSigners: [owner.key],
            },
            { scheduleMemo: "integration scheduled burn" },
        );

        expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
    });
});
