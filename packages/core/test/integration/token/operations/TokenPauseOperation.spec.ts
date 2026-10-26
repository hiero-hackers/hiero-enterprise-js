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

describe("TokenService pause operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("pauses a token signed by the pause key", async () => {
        const pauseKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Pause Integration",
            tokenSymbol: "PAUSE",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            pauseKey: pauseKey.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.pauseToken({
            tokenId,
            additionalSigners: [pauseKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.pause_status).toBe("PAUSED");
    });
});
