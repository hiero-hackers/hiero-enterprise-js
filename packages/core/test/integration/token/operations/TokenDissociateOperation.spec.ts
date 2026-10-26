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

const supportsScheduledDissociate =
    process.env.HIERO_SUPPORTS_SCHEDULED_TOKEN_DISSOCIATE === "true";

describe("TokenService dissociate operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("dissociates a token from an account", async () => {
        const receiver = await createTestAccount(accountService, 1);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Dissociate Integration",
            tokenSymbol: "DSI",
            decimals: 2,
            initialSupply: 1_000,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: receiver.accountId,
            tokenId,
            additionalSigners: [receiver.key],
        });

        await waitForMirrorNodeRecord();

        const before = await queryAccountTokens(receiver.accountId);
        expect(
            before.find((t) => t.token_id === tokenId.toString()),
        ).toBeDefined();

        await tokenService.dissociateToken({
            accountId: receiver.accountId,
            tokenIds: [tokenId],
            additionalSigners: [receiver.key],
        });

        await waitForMirrorNodeRecord();

        const after = await queryAccountTokens(receiver.accountId);
        expect(
            after.find((t) => t.token_id === tokenId.toString()),
        ).toBeUndefined();
    });

    it("schedules a token dissociation", async () => {
        const scheduledReceiver = await createTestAccount(accountService, 1);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Scheduled Dissociate",
            tokenSymbol: "SDSI",
            decimals: 0,
            initialSupply: 500,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: scheduledReceiver.accountId,
            tokenId,
            additionalSigners: [scheduledReceiver.key],
        });

        if (supportsScheduledDissociate) {
            const scheduled = await tokenService.scheduleDissociateToken(
                {
                    accountId: scheduledReceiver.accountId,
                    tokenIds: [tokenId],
                    additionalSigners: [scheduledReceiver.key],
                },
                { scheduleMemo: "integration scheduled dissociate" },
            );

            expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
            return;
        }

        await expect(
            tokenService.scheduleDissociateToken(
                {
                    accountId: scheduledReceiver.accountId,
                    tokenIds: [tokenId],
                    additionalSigners: [scheduledReceiver.key],
                },
                { scheduleMemo: "integration scheduled dissociate" },
            ),
        ).rejects.toThrow(/SCHEDULED_TRANSACTION_NOT_IN_WHITELIST/);
    });
});
