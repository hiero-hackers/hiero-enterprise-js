import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";
import { NftId, TokenType, TokenSupplyType } from "@hiero-ledger/sdk";

describe("TokenService info queries [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    describe("getTokenInfo", () => {
        it("returns the definition of a fungible token", async () => {
            const { tokenId } = await tokenService.createFungibleToken({
                tokenName: "Token Info Fungible Integration",
                tokenSymbol: "TIFI",
                decimals: 2,
                initialSupply: 1_000,
                treasuryAccountId: owner.accountId,
                adminKey: owner.key.publicKey,
                supplyKey: owner.key.publicKey,
                tokenMemo: "fungible info memo",
                maxSupply: 5_000,
                additionalSigners: [owner.key],
            });

            await waitForMirrorNodeRecord();

            const info = await tokenService.getTokenInfo(tokenId);

            expect(info.tokenId).toBe(tokenId.toString());
            expect(info.name).toBe("Token Info Fungible Integration");
            expect(info.symbol).toBe("TIFI");
            expect(info.decimals).toBe(2);
            expect(info.totalSupply).toBe("1000");
            expect(info.maxSupply).toBe("5000");
            expect(info.treasuryAccountId).toBe(owner.accountId);
            expect(info.tokenType).toBe(TokenType.FungibleCommon);
            expect(info.supplyType).toBe(TokenSupplyType.Finite);
            expect(info.tokenMemo).toBe("fungible info memo");
            expect(info.isDeleted).toBe(false);
            expect(info.adminKey).not.toBeNull();
            expect(info.supplyKey).not.toBeNull();
            expect(info.kycKey).toBeNull();
            expect(info.freezeKey).toBeNull();
            expect(info.pauseKey).toBeNull();
            expect(info.wipeKey).toBeNull();
        });

        it("returns the definition of an NFT collection (decimals 0, type NonFungibleUnique)", async () => {
            const { tokenId } = await tokenService.createNft({
                tokenName: "Token Info NFT Integration",
                tokenSymbol: "TINI",
                treasuryAccountId: owner.accountId,
                adminKey: owner.key.publicKey,
                supplyKey: owner.key.publicKey,
                tokenMemo: "nft info memo",
                additionalSigners: [owner.key],
            });

            await waitForMirrorNodeRecord();

            const info = await tokenService.getTokenInfo(tokenId);

            expect(info.tokenId).toBe(tokenId.toString());
            expect(info.tokenType).toBe(TokenType.NonFungibleUnique);
            expect(info.decimals).toBe(0);
            expect(info.totalSupply).toBe("0");
            expect(info.treasuryAccountId).toBe(owner.accountId);
            expect(info.tokenMemo).toBe("nft info memo");
            expect(info.adminKey).not.toBeNull();
            expect(info.supplyKey).not.toBeNull();
        });
    });

    describe("getNftInfo", () => {
        it("returns owner, creation time, and metadata for a minted NFT serial", async () => {
            const { tokenId } = await tokenService.createNft({
                tokenName: "NFT Info Single Integration",
                tokenSymbol: "NISI",
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });

            const metadata = Buffer.from("nft-info-serial-1");
            await tokenService.mintToken({
                tokenId,
                metadata: [metadata],
                additionalSigners: [owner.key],
            });

            await waitForMirrorNodeRecord();

            const nftId = new NftId(tokenId, 1);
            const info = await tokenService.getNftInfo(nftId);

            expect(info.nftId).toBe(`${tokenId}/1`);
            expect(info.tokenId).toBe(tokenId.toString());
            expect(info.serial).toBe("1");
            expect(info.accountId).toBe(owner.accountId);
            expect(info.spenderId).toBeNull();
            expect(info.metadata).not.toBeNull();
            expect(Buffer.from(info.metadata as Uint8Array).toString()).toBe(
                "nft-info-serial-1",
            );
            // creationTime should parse as a valid ISO date string.
            expect(Number.isNaN(Date.parse(info.creationTime))).toBe(false);
        });

        it("returns the post-transfer owner for a serial that was moved to another account", async () => {
            const receiver = await createTestAccount(accountService, 2);

            const { tokenId } = await tokenService.createNft({
                tokenName: "NFT Info Transfer Integration",
                tokenSymbol: "NITI",
                treasuryAccountId: owner.accountId,
                supplyKey: owner.key.publicKey,
                additionalSigners: [owner.key],
            });

            await tokenService.mintToken({
                tokenId,
                metadata: [Buffer.from("nft-info-transfer-1")],
                additionalSigners: [owner.key],
            });

            await tokenService.associateToken({
                accountId: receiver.accountId,
                tokenId,
                additionalSigners: [receiver.key],
            });

            // Airdrop credits the receiver immediately because the
            // receiver is associated and the sender does not need to
            // schedule the transfer separately.
            await tokenService.airdropNft({
                airdrops: [
                    {
                        tokenId,
                        serial: 1,
                        senderAccountId: owner.accountId,
                        receiverAccountId: receiver.accountId,
                    },
                ],
                additionalSigners: [owner.key],
            });

            await waitForMirrorNodeRecord();

            const info = await tokenService.getNftInfo(`${tokenId}/1`);

            expect(info.tokenId).toBe(tokenId.toString());
            expect(info.serial).toBe("1");
            expect(info.accountId).toBe(receiver.accountId);
        });
    });
});
