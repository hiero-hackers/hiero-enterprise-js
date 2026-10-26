import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

describe("TokenService.createFungibleToken / createNft [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let treasuryKey: PrivateKey;
    let treasuryId: string;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);

        treasuryKey = PrivateKey.generateED25519();
        const treasury = await accountService.createAccount({
            publicKey: treasuryKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
            memo: "token integration treasury",
        });
        treasuryId = treasury.accountId.toString();
    });

    it("creates a fungible token with the operator as treasury", async () => {
        const ctx = setupIntegrationTestEnv();
        const { tokenId } = await new TokenService(ctx).createFungibleToken({
            tokenName: "Operator Treasury Token",
            tokenSymbol: "OTT",
            decimals: 2,
            initialSupply: 1_000,
            treasuryAccountId: ctx.operatorAccountId,
        });

        expect(tokenId).toBeDefined();
        expect(tokenId.toString()).toMatch(/^0\.0\.\d+$/);
    });

    it("creates a fungible token with an external treasury and admin key", async () => {
        const adminKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "External Treasury Token",
            tokenSymbol: "ETT",
            decimals: 0,
            initialSupply: 500,
            treasuryAccountId: treasuryId,
            adminKey: adminKey.publicKey,
            supplyKey: treasuryKey.publicKey,
            tokenMemo: "external treasury demo",
            additionalSigners: [treasuryKey, adminKey],
        });

        expect(tokenId).toBeDefined();
        expect(tokenId.toString()).toMatch(/^0\.0\.\d+$/);
    });

    it("creates a fungible token with finite max supply", async () => {
        const { tokenId } = await tokenService.createFungibleToken({
            tokenName: "Capped Token",
            tokenSymbol: "CAP",
            decimals: 4,
            initialSupply: 100,
            treasuryAccountId: treasuryId,
            maxSupply: 10_000,
            supplyKey: treasuryKey.publicKey,
            additionalSigners: [treasuryKey],
        });

        expect(tokenId).toBeDefined();
        expect(tokenId.toString()).toMatch(/^0\.0\.\d+$/);
    });

    it("creates an NFT collection with a treasury and supply key", async () => {
        const supplyKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createNft({
            tokenName: "Integration NFT",
            tokenSymbol: "INFT",
            treasuryAccountId: treasuryId,
            supplyKey: supplyKey.publicKey,
            additionalSigners: [treasuryKey],
        });

        expect(tokenId).toBeDefined();
        expect(tokenId.toString()).toMatch(/^0\.0\.\d+$/);
    });

    it("creates an NFT collection with a finite max supply", async () => {
        const supplyKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createNft({
            tokenName: "Capped NFT",
            tokenSymbol: "CNFT",
            treasuryAccountId: treasuryId,
            supplyKey: supplyKey.publicKey,
            maxSupply: 100,
            additionalSigners: [treasuryKey],
        });

        expect(tokenId).toBeDefined();
        expect(tokenId.toString()).toMatch(/^0\.0\.\d+$/);
    });

    it("schedules a fungible token creation and returns a scheduleId", async () => {
        const adminKey = PrivateKey.generateED25519();

        const scheduled = await tokenService.scheduleCreateFungibleToken(
            {
                tokenName: "Scheduled Token",
                tokenSymbol: "SCH",
                decimals: 0,
                initialSupply: 100,
                treasuryAccountId: treasuryId,
                adminKey: adminKey.publicKey,
                additionalSigners: [treasuryKey, adminKey],
            },
            { scheduleMemo: "integration scheduled fungible" },
        );

        expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
    });

    it("schedules an NFT collection creation and returns a scheduleId", async () => {
        const supplyKey = PrivateKey.generateED25519();

        const scheduled = await tokenService.scheduleCreateNft(
            {
                tokenName: "Scheduled NFT",
                tokenSymbol: "SNFT",
                treasuryAccountId: treasuryId,
                supplyKey: supplyKey.publicKey,
                additionalSigners: [treasuryKey],
            },
            { scheduleMemo: "integration scheduled nft" },
        );

        expect(scheduled.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
    });
});
