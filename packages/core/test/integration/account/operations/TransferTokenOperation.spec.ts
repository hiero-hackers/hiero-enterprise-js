import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import {
    createTestAccount,
    createOwnerSpenderPair,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TransferTokenOperation [Integration]", () => {
    let client: AccountService;
    let tokenService: TokenService;
    let operatorAccountId: string;
    let operatorKey: PrivateKey;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        operatorAccountId = ctx.operatorAccountId.toString();
        // Operator key — needed when the operator acts as treasury/supply key
        const rawKey = process.env.HIERO_OPERATOR_KEY;
        if (!rawKey) {
            throw new Error(
                "HIERO_OPERATOR_KEY is not set (required for transfer integration tests).",
            );
        }
        operatorKey = PrivateKey.fromStringED25519(rawKey);
    });

    describe("transferToken", () => {
        it("transfers fungible tokens from the operator to a recipient", async () => {
            const { tokenId } = await tokenService.createFungibleToken({
                tokenName: "Transfer Test Token",
                tokenSymbol: "TTT",
                decimals: 2,
                initialSupply: 10_000,
                treasuryAccountId: operatorAccountId,
                supplyKey: operatorKey.publicKey,
                additionalSigners: [operatorKey],
            });

            const receiver = await createTestAccount(client, 1);
            await tokenService.associateToken({
                tokenId,
                accountId: receiver.accountId,
                additionalSigners: [receiver.key],
            });

            await client.transferToken(
                tokenId,
                receiver.accountId,
                250,
                operatorAccountId,
            );

            await waitForMirrorNodeRecord();

            const { balance } = await client.getTokenBalance(
                receiver.accountId,

                tokenId,
            );

            expect(balance).toBe("250");
        });

        it("transfers tokens with matching expectedDecimals", async () => {
            const { tokenId } = await tokenService.createFungibleToken({
                tokenName: "Decimals Test Token",
                tokenSymbol: "DEC",
                decimals: 4,
                initialSupply: 1_000_000,
                treasuryAccountId: operatorAccountId,
                supplyKey: operatorKey.publicKey,
                additionalSigners: [operatorKey],
            });

            const receiver = await createTestAccount(client, 1);

            await tokenService.associateToken({
                tokenId,
                accountId: receiver.accountId,
                additionalSigners: [receiver.key],
            });

            await client.transferToken(
                tokenId,
                receiver.accountId,
                100,
                operatorAccountId,
                { expectedDecimals: 4 },
            );

            await waitForMirrorNodeRecord();

            const { balance } = await client.getTokenBalance(
                receiver.accountId,

                tokenId,
            );

            expect(balance).toBe("100");
        });

        it("transfers tokens between two non-operator accounts", async () => {
            const { owner, spender } = await createOwnerSpenderPair(client);

            const { tokenId } = await tokenService.createFungibleToken({
                tokenName: "Peer Transfer Token",
                tokenSymbol: "PEER",
                decimals: 0,
                initialSupply: 500,
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });

            await tokenService.associateToken({
                tokenId,
                accountId: spender.accountId,
                additionalSigners: [spender.key],
            });

            await client.transferToken(
                tokenId,
                spender.accountId,
                100,
                owner.accountId,
                { additionalSigners: [owner.key] },
            );

            await waitForMirrorNodeRecord();

            const { balance } = await client.getTokenBalance(
                spender.accountId,

                tokenId,
            );

            expect(balance).toBe("100");
        });
    });
});
