import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CustomFixedFee,
    PrivateKey,
    ScheduleId,
    TokenCreateTransaction,
    TokenId,
    TokenSupplyType,
    TokenType,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TokenCreateOperation } from "../../../../../src/services/token/operations/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { HieroError } from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { tokenId: TokenId.fromString("0.0.500") },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenCreateOperation (via TokenService)", () => {
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
        it("builds a fungible token and returns its token ID", async () => {
            const { tokenId } = await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            expect(tokenId.toString()).toBe("0.0.500");
            const tx = sentTx();
            expect(tx).toBeInstanceOf(TokenCreateTransaction);
            expect(tx.tokenName).toBe("Acme");
            expect(tx.tokenSymbol).toBe("ACME");
            expect(tx.treasuryAccountId?.toString()).toBe("0.0.555");
            expect(tx.tokenType).toBe(TokenType.FungibleCommon);
        });

        it("sends the TokenCreate event", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TokenCreateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "TokenCreate",
                    serviceName: "TokenService",
                    methodName: "createToken",
                }),
            );
        });

        it("sets every optional field that is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const supplyKey = PrivateKey.generateED25519().publicKey;
            const kycKey = PrivateKey.generateED25519().publicKey;
            const freezeKey = PrivateKey.generateED25519().publicKey;
            const pauseKey = PrivateKey.generateED25519().publicKey;
            const wipeKey = PrivateKey.generateED25519().publicKey;
            const feeScheduleKey = PrivateKey.generateED25519().publicKey;
            const metadataKey = PrivateKey.generateED25519().publicKey;
            const metadata = new Uint8Array([1, 2, 3]);
            const expirationTime = new Date("2099-01-02T03:04:05.000Z");

            await service.createFungibleToken({
                tokenName: "Full",
                tokenSymbol: "FULL",
                treasuryAccountId: "0.0.555",
                decimals: 2,
                initialSupply: 1_000_000,
                adminKey,
                supplyKey,
                kycKey,
                freezeKey,
                pauseKey,
                wipeKey,
                feeScheduleKey,
                metadataKey,
                metadata,
                freezeDefault: false,
                autoRenewAccountId: "0.0.556",
                expirationTime,
                autoRenewPeriod: 7_000_000,
                tokenMemo: "fully configured token",
                maxSupply: 10_000_000,
            });

            const tx = sentTx();
            expect(tx.decimals?.toNumber()).toBe(2);
            expect(tx.initialSupply?.toNumber()).toBe(1_000_000);
            expect(tx.adminKey).toBe(adminKey);
            expect(tx.supplyKey).toBe(supplyKey);
            expect(tx.kycKey).toBe(kycKey);
            expect(tx.freezeKey).toBe(freezeKey);
            expect(tx.pauseKey).toBe(pauseKey);
            expect(tx.wipeKey).toBe(wipeKey);
            expect(tx.feeScheduleKey).toBe(feeScheduleKey);
            expect(tx.metadataKey).toBe(metadataKey);
            expect(tx.metadata).toEqual(metadata);
            expect(tx.freezeDefault).toBe(false);
            expect(tx.autoRenewAccountId?.toString()).toBe("0.0.556");
            expect(tx.expirationTime?.toDate()).toEqual(expirationTime);
            expect(tx.autoRenewPeriod?.seconds.toNumber()).toBe(7_000_000);
            expect(tx.tokenMemo).toBe("fully configured token");
            expect(tx.maxSupply?.toNumber()).toBe(10_000_000);
        });

        it("keeps the SDK defaults for omitted fields", async () => {
            await service.createFungibleToken({
                tokenName: "Minimal",
                tokenSymbol: "MIN",
                treasuryAccountId: "0.0.555",
            });

            const tx = sentTx();
            const defaults = new TokenCreateTransaction();
            expect(tx.decimals).toEqual(defaults.decimals);
            expect(tx.initialSupply).toEqual(defaults.initialSupply);
            expect(tx.maxSupply).toEqual(defaults.maxSupply);
            expect(tx.adminKey).toBeNull();
            expect(tx.supplyKey).toBeNull();
            expect(tx.tokenMemo).toBe(defaults.tokenMemo);
            expect(tx.customFees).toEqual([]);
        });

        it("sets custom fees when the array is not empty", async () => {
            const fee = new CustomFixedFee()
                .setAmount(10)
                .setFeeCollectorAccountId("0.0.555");

            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                customFees: [fee],
            });

            expect(sentTx().customFees).toEqual([fee]);
        });

        it("rejects invalid options before building a transaction", async () => {
            await expect(
                service.createFungibleToken({
                    tokenName: "",
                    tokenSymbol: "ACME",
                    treasuryAccountId: "0.0.555",
                }),
            ).rejects.toBeInstanceOf(HieroError);

            expect(run).not.toHaveBeenCalled();
        });

        it("throws SDK_ERROR when the receipt has no token ID", async () => {
            run.mockResolvedValueOnce({
                ...receipt,
                receipt: { tokenId: null },
            } as never);

            await expect(
                service.createFungibleToken({
                    tokenName: "Acme",
                    tokenSymbol: "ACME",
                    treasuryAccountId: "0.0.555",
                }),
            ).rejects.toMatchObject({
                code: "SDK_ERROR",
                transactionId: receipt.transactionId,
            });
        });
    });

    describe("createNft", () => {
        it("builds an NFT collection with no decimals or initial supply", async () => {
            const supplyKey = PrivateKey.generateED25519().publicKey;

            const { tokenId } = await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
            });

            expect(tokenId.toString()).toBe("0.0.500");
            const tx = sentTx();
            expect(tx.tokenType).toBe(TokenType.NonFungibleUnique);
            expect(tx.decimals?.toNumber()).toBe(0);
            expect(tx.initialSupply?.toNumber()).toBe(0);
            expect(tx.supplyKey).toBe(supplyKey);
        });

        it("sets a finite supply type when maxSupply is provided", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey: PrivateKey.generateED25519().publicKey,
                maxSupply: 1_000,
            });

            const tx = sentTx();
            expect(tx.supplyType).toBe(TokenSupplyType.Finite);
            expect(tx.maxSupply?.toNumber()).toBe(1_000);
        });
    });

    describe("scheduleCreateFungibleToken", () => {
        it("schedules the built transaction with the schedule options", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleCreateFungibleToken(
                {
                    tokenName: "Acme",
                    tokenSymbol: "ACME",
                    treasuryAccountId: "0.0.555",
                },
                { scheduleMemo: "pending approval" },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect((tx as TokenCreateTransaction).tokenName).toBe("Acme");
            expect(scheduleOptions).toEqual({
                scheduleMemo: "pending approval",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });

    describe("TokenCreateOperation (direct usage)", () => {
        it("leaves the token type unset when tokenType is omitted", async () => {
            // TokenService always sets tokenType; the operation used
            // directly must keep the SDK default.
            await new TokenCreateOperation(createMockContext()).execute({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            expect(sentTx().tokenType).toBe(
                new TokenCreateTransaction().tokenType,
            );
        });
    });
});
