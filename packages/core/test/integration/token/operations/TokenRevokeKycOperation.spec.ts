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

describe("TokenService revokeKyc operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("revokes KYC on a token relationship for a holder account", async () => {
        const holder = await createTestAccount(accountService, 2);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "RevokeKyc Integration",
            tokenSymbol: "RKYC",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            kycKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: holder.accountId,
            tokenId,
            additionalSigners: [holder.key],
        });

        await tokenService.grantKycToken({
            tokenId,
            accountId: holder.accountId,
            additionalSigners: [owner.key],
        });

        await tokenService.revokeKycToken({
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
        expect(relationship?.kyc_status).toBe("REVOKED");
    });
});
