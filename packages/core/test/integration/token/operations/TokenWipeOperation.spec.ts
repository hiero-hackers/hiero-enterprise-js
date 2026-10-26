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

describe("TokenService wipe operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("wipes fungible supply from a holder account", async () => {
        const holder = await createTestAccount(accountService, 2);
        const initialSupply = 1_000;
        const transferAmount = 400;
        const wipeAmount = 250;

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Wipe Fungible Integration",
            tokenSymbol: "WFI",
            decimals: 0,
            initialSupply,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            wipeKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: holder.accountId,
            tokenId,
            additionalSigners: [holder.key],
        });

        await accountService.transferToken(
            tokenId,
            holder.accountId,
            transferAmount,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        const newTotalSupply = await tokenService.wipeToken({
            tokenId,
            accountId: holder.accountId,
            amount: wipeAmount,
            additionalSigners: [owner.key],
        });

        expect(newTotalSupply.totalSupply).toBe(
            String(initialSupply - wipeAmount),
        );

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.total_supply).toBe(String(initialSupply - wipeAmount));
    });

    it("wipes specific NFT serials from a holder account", async () => {
        const holder = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createNft({
            tokenName: "Wipe NFT Integration",
            tokenSymbol: "WNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            wipeKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [
                Buffer.from("wipe-meta-1"),
                Buffer.from("wipe-meta-2"),
                Buffer.from("wipe-meta-3"),
            ],
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: holder.accountId,
            tokenId,
            additionalSigners: [holder.key],
        });

        // Transfer serials 1 and 2 to the holder
        await accountService.transferNft(
            tokenId,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );
        await accountService.transferNft(
            tokenId,
            2,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        const newTotalSupply = await tokenService.wipeToken({
            tokenId,
            accountId: holder.accountId,
            serials: [1, 2],
            additionalSigners: [owner.key],
        });

        // 3 minted - 2 wiped = 1 remaining (still owned by treasury)
        expect(newTotalSupply.totalSupply).toBe("1");

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.total_supply).toBe("1");
    });
});
