import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { queryNftRecord } from "../../../utils/mirror-node-rest.js";
import {
    createTestAccount,
    createOwnerSpenderPair,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TransferOperation [Integration]", () => {
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

    // HBAR transfers
    describe("transferHbar", () => {
        it("transfers HBAR from the operator to a recipient", async () => {
            const receiver = await createTestAccount(client, 0);

            const before = await client.getAccountBalance(receiver.accountId);
            const beforeTinybars = BigInt(before.tinybars);

            await client.transferHbar(receiver.accountId, 1, operatorAccountId);

            const after = await client.getAccountBalance(receiver.accountId);
            const afterTinybars = BigInt(after.tinybars);

            // Receiver pays no fees — balance increases by exactly the transfer
            expect(afterTinybars - beforeTinybars).toBe(100_000_000n);
        });

        it("transfers HBAR from a non-operator sender (requires additionalSigners)", async () => {
            const sender = await createTestAccount(client, 5);
            const receiver = await createTestAccount(client, 0);

            const before = await client.getAccountBalance(receiver.accountId);
            const beforeTinybars = BigInt(before.tinybars);

            await client.transferHbar(receiver.accountId, 1, sender.accountId, {
                additionalSigners: [sender.key],
            });

            const after = await client.getAccountBalance(receiver.accountId);
            const afterTinybars = BigInt(after.tinybars);

            expect(afterTinybars - beforeTinybars).toBe(100_000_000n);
        });

        it("rejects a self-transfer before submitting to the network", async () => {
            await expect(
                client.transferHbar(operatorAccountId, 1, operatorAccountId),
            ).rejects.toThrow(/must be different/);
        });
    });

    // Fungible token transfers
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

            const balance = await client.getAccountBalance(receiver.accountId);
            const tokenBalance = balance.tokens.find(
                (t) => t.tokenId === tokenId.toString(),
            );
            expect(tokenBalance).toBeDefined();
            expect(tokenBalance!.balance).toBe("250");
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

            const balance = await client.getAccountBalance(receiver.accountId);
            const tokenBalance = balance.tokens.find(
                (t) => t.tokenId === tokenId.toString(),
            );
            expect(tokenBalance!.balance).toBe("100");
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

            const balance = await client.getAccountBalance(spender.accountId);
            const tokenBalance = balance.tokens.find(
                (t) => t.tokenId === tokenId.toString(),
            );
            expect(tokenBalance!.balance).toBe("100");
        });
    });

    // ----------------------------------------------------------------
    // NFT transfers
    // ----------------------------------------------------------------

    describe("transferNft", () => {
        it("transfers an NFT from the operator to a recipient", async () => {
            const { tokenId } = await tokenService.createNft({
                tokenName: "Transfer Test NFT",
                tokenSymbol: "TNFT",
                treasuryAccountId: operatorAccountId,
                supplyKey: operatorKey.publicKey,
                additionalSigners: [operatorKey],
            });

            await tokenService.mintToken({
                tokenId,
                metadata: [Buffer.from("meta-1")],
                additionalSigners: [operatorKey],
            });
            const serial = 1;

            const receiver = await createTestAccount(client, 1);
            await tokenService.associateToken({
                tokenId,
                accountId: receiver.accountId,
                additionalSigners: [receiver.key],
            });

            await client.transferNft(
                tokenId,
                serial,
                receiver.accountId,
                operatorAccountId,
            );

            await waitForMirrorNodeRecord();

            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.account_id).toBe(receiver.accountId);
        });
    });

    // Scheduled transfers
    describe("scheduleTransferHbar", () => {
        it("returns a scheduleId and transactionId for a scheduled HBAR transfer", async () => {
            const receiver = await createTestAccount(client, 0);

            const result = await client.scheduleTransferHbar(
                receiver.accountId,
                1,
                operatorAccountId,
                { scheduleMemo: "integration test schedule" },
            );

            expect(result.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
        });
    });
});
