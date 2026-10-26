import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { queryNftRecord } from "../../../utils/MirrorNodeRest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

function decodeMirrorMetadata(value: string | undefined): string {
    if (value == null) return "";
    return Buffer.from(value, "base64").toString("utf-8");
}

describe("TokenService updateNfts operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("updates the metadata of a single NFT serial", async () => {
        const metadataKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createNft({
            tokenName: "Update NFT Single",
            tokenSymbol: "UNS",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            metadataKey: metadataKey.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("v1")],
            additionalSigners: [owner.key],
        });

        await tokenService.updateNfts({
            tokenId,
            serialNumbers: [1],
            metadata: Buffer.from("v2"),
            additionalSigners: [metadataKey],
        });

        await waitForMirrorNodeRecord();

        const nft = await queryNftRecord(tokenId, 1);
        expect(decodeMirrorMetadata(nft.metadata)).toBe("v2");
    });

    it("updates multiple serials in one transaction and leaves others untouched", async () => {
        const metadataKey = PrivateKey.generateED25519();

        const { tokenId } = await tokenService.createNft({
            tokenName: "Update NFT Batch",
            tokenSymbol: "UNB",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            metadataKey: metadataKey.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [
                Buffer.from("orig-1"),
                Buffer.from("orig-2"),
                Buffer.from("orig-3"),
            ],
            additionalSigners: [owner.key],
        });

        await tokenService.updateNfts({
            tokenId,
            serialNumbers: [1, 3],
            metadata: Buffer.from("rotated"),
            additionalSigners: [metadataKey],
        });

        await waitForMirrorNodeRecord();

        const [nft1, nft2, nft3] = await Promise.all([
            queryNftRecord(tokenId, 1),
            queryNftRecord(tokenId, 2),
            queryNftRecord(tokenId, 3),
        ]);

        expect(decodeMirrorMetadata(nft1.metadata)).toBe("rotated");
        expect(decodeMirrorMetadata(nft2.metadata)).toBe("orig-2");
        expect(decodeMirrorMetadata(nft3.metadata)).toBe("rotated");
    });
});
