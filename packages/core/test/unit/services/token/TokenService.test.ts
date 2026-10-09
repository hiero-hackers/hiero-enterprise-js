import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    PrivateKey,
    TokenCreateTransaction,
    TokenId,
    TokenSupplyType,
    TokenType,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../utils/mock-context.js";

// The facade tests verify the contract the service guarantees on top of the
// operation: tokenType/decimals/initialSupply auto-injection and
// supplyType auto-resolution. The real transaction handed to the executor is
// inspected; only the executor, which sends it, is stubbed.

const receipt = {
    receipt: { tokenId: TokenId.fromString("0.0.500") },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenService [facade contract]", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenCreateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createFungibleToken", () => {
        it("always sets tokenType to FungibleCommon", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            expect(sentTx().tokenType).toBe(TokenType.FungibleCommon);
        });

        it("auto-sets supplyType to Finite when maxSupply is provided", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                maxSupply: 5_000,
            });

            expect(sentTx().supplyType).toBe(TokenSupplyType.Finite);
        });

        it("preserves an explicit supplyType over auto-resolution", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                supplyType: TokenSupplyType.Infinite,
                maxSupply: 5_000,
            });

            expect(sentTx().supplyType).toBe(TokenSupplyType.Infinite);
        });

        it("leaves supplyType unset when neither maxSupply nor supplyType is given", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            expect(sentTx().supplyType).toBe(
                new TokenCreateTransaction().supplyType,
            );
        });
    });

    describe("createNft", () => {
        const supplyKey = PrivateKey.generateED25519().publicKey;

        it("always sets tokenType to NonFungibleUnique", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
            });

            expect(sentTx().tokenType).toBe(TokenType.NonFungibleUnique);
        });

        it("forces decimals and initialSupply to 0", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
            });

            const tx = sentTx();
            expect(tx.decimals?.toNumber()).toBe(0);
            expect(tx.initialSupply?.toNumber()).toBe(0);
        });

        it("auto-sets supplyType to Finite when maxSupply is provided", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
                maxSupply: 1_000,
            });

            const tx = sentTx();
            expect(tx.supplyType).toBe(TokenSupplyType.Finite);
            expect(tx.maxSupply?.toNumber()).toBe(1_000);
        });

        it("requires supplyKey at the type level (validator confirms)", async () => {
            // Type-level: TS forbids omitting `supplyKey`. Runtime: validator
            // also throws if it's somehow missing.
            await expect(
                service.createNft({
                    tokenName: "Acme Art",
                    tokenSymbol: "ART",
                    treasuryAccountId: "0.0.555",
                    supplyKey: undefined as unknown as ReturnType<
                        typeof PrivateKey.generateED25519
                    >["publicKey"],
                }),
            ).rejects.toThrow(/Non-fungible tokens require a supplyKey/);

            expect(run).not.toHaveBeenCalled();
        });
    });
});
