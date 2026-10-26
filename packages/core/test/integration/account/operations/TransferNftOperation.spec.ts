import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { queryNftRecord } from "../../../utils/MirrorNodeRest.js";
import { createTestAccount } from "../../../utils/IntegrationFixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TransferNftOperation [Integration]", () => {
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
});
