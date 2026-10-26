import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { queryAccountTokens } from "../../../utils/MirrorNodeRest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TokenService unfreeze operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("unfreezes a previously frozen token relationship", async () => {
        const holder = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Unfreeze Integration",
            tokenSymbol: "UFRZ",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            freezeKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: holder.accountId,
            tokenId,
            additionalSigners: [holder.key],
        });

        await tokenService.freezeToken({
            tokenId,
            accountId: holder.accountId,
            additionalSigners: [owner.key],
        });

        await tokenService.unfreezeToken({
            tokenId,
            accountId: holder.accountId,
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        const tokens = await queryAccountTokens(holder.accountId);
        const relationship = tokens.find(
            (t) => t.token_id === tokenId.toString(),
        );

        expect(relationship).toBeDefined();
        expect(relationship?.freeze_status).toBe("UNFROZEN");
    });
});
