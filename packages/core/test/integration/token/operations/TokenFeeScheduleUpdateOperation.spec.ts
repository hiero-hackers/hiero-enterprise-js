import { describe, it, expect, beforeAll } from "vitest";
import { CustomFixedFee, PrivateKey } from "@hiero-ledger/sdk";
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

describe("TokenService fee schedule update operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("updates a token's custom fee schedule with a fixed HBAR fee", async () => {
        const feeScheduleKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "FeeSchedule Integration",
            tokenSymbol: "FSCH",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            feeScheduleKey: feeScheduleKey.publicKey,
            additionalSigners: [owner.key],
        });

        const fee = new CustomFixedFee()
            .setAmount(1)
            .setFeeCollectorAccountId(owner.accountId);

        await tokenService.updateTokenFeeSchedule({
            tokenId,
            customFees: [fee],
            additionalSigners: [feeScheduleKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.custom_fees).toBeDefined();
        expect(info.custom_fees?.fixed_fees?.length ?? 0).toBeGreaterThan(0);
        const fixed = info.custom_fees?.fixed_fees?.[0];
        expect(fixed?.amount).toBe(1);
        expect(fixed?.collector_account_id).toBe(owner.accountId);
    });
});
