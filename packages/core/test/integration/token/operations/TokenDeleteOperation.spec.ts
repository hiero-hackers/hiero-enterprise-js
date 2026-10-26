import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
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

describe("TokenService delete operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("deletes a token signed by the admin key", async () => {
        const adminKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Delete Integration",
            tokenSymbol: "DEL",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            adminKey: adminKey.publicKey,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key, adminKey],
        });

        await tokenService.deleteToken({
            tokenId,
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.deleted).toBe(true);
    });
});
