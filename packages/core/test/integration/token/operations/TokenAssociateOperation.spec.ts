import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { queryAccountTokens } from "../../../utils/mirror-node-rest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

const supportsScheduledAssociate =
    process.env.HIERO_SUPPORTS_SCHEDULED_TOKEN_ASSOCIATE === "true";

describe("TokenService associate operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    }, 120_000);

    it("associates a token to an account", async () => {
        const receiver = await createTestAccount(accountService, 1);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Associate Integration",
            tokenSymbol: "ASI",
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

        const tokens = await queryAccountTokens(receiver.accountId);
        const relationship = tokens.find(
            (t) => t.token_id === tokenId.toString(),
        );

        expect(relationship).toBeDefined();
        expect(relationship?.token_id).toBe(tokenId.toString());
    }, 120_000);

    it("associates several tokens in one transaction", async () => {
        const receiver = await createTestAccount(accountService, 1);
        const tokenIds = [];

        for (const symbol of ["MA1", "MA2"]) {
            const { tokenId } = await tokenService.createFungibleToken({
                tokenName: `Multi Associate ${symbol}`,
                tokenSymbol: symbol,
                decimals: 0,
                initialSupply: 100,
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });

            tokenIds.push(tokenId);
        }

        await tokenService.associateToken({
            accountId: receiver.accountId,
            tokenIds,
            additionalSigners: [receiver.key],
        });

        await waitForMirrorNodeRecord();

        const tokens = await queryAccountTokens(receiver.accountId);

        for (const tokenId of tokenIds) {
            expect(
                tokens.find((t) => t.token_id === tokenId.toString()),
            ).toBeDefined();
        }
    }, 120_000);

    it("schedules a token association", async () => {
        const scheduledReceiver = await createTestAccount(accountService, 1);

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Scheduled Associate",
            tokenSymbol: "SASI",
            decimals: 0,
            initialSupply: 500,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        if (supportsScheduledAssociate) {
            const scheduled = await tokenService.scheduleAssociateToken(
                {
                    accountId: scheduledReceiver.accountId,
                    tokenId,
                    additionalSigners: [scheduledReceiver.key],
                },
                { scheduleMemo: "integration scheduled associate" },
            );

            expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
            return;
        }

        await expect(
            tokenService.scheduleAssociateToken(
                {
                    accountId: scheduledReceiver.accountId,
                    tokenId,
                    additionalSigners: [scheduledReceiver.key],
                },
                { scheduleMemo: "integration scheduled associate" },
            ),
        ).rejects.toThrow(/SCHEDULED_TRANSACTION_NOT_IN_WHITELIST/);
    }, 120_000);
});
