import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    PrivateKey,
    ScheduleId,
    TokenKeyValidation,
    TokenUpdateTransaction,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenUpdateOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenUpdateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("submits an update with only tokenId and keeps the SDK defaults", async () => {
        await service.updateToken({ tokenId: "0.0.500" });

        const tx = sentTx();
        const defaults = new TokenUpdateTransaction();
        expect(tx).toBeInstanceOf(TokenUpdateTransaction);
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.tokenName).toEqual(defaults.tokenName);
        expect(tx.tokenSymbol).toEqual(defaults.tokenSymbol);
        expect(tx.treasuryAccountId).toEqual(defaults.treasuryAccountId);
        expect(tx.adminKey).toEqual(defaults.adminKey);
        expect(tx.kycKey).toEqual(defaults.kycKey);
        expect(tx.freezeKey).toEqual(defaults.freezeKey);
        expect(tx.wipeKey).toEqual(defaults.wipeKey);
        expect(tx.supplyKey).toEqual(defaults.supplyKey);
        expect(tx.autoRenewAccountId).toEqual(defaults.autoRenewAccountId);
        expect(tx.expirationTime).toEqual(defaults.expirationTime);
        expect(tx.autoRenewPeriod).toEqual(defaults.autoRenewPeriod);
        expect(tx.tokenMemo).toEqual(defaults.tokenMemo);
        expect(tx.feeScheduleKey).toEqual(defaults.feeScheduleKey);
        expect(tx.pauseKey).toEqual(defaults.pauseKey);
        expect(tx.metadataKey).toEqual(defaults.metadataKey);
        expect(tx.metadata).toEqual(defaults.metadata);
        expect(tx.keyVerificationMode).toEqual(defaults.keyVerificationMode);
    });

    it("applies all provided update fields", async () => {
        const adminKey = PrivateKey.generateED25519().publicKey;
        const kycKey = PrivateKey.generateED25519().publicKey;
        const freezeKey = PrivateKey.generateED25519().publicKey;
        const wipeKey = PrivateKey.generateED25519().publicKey;
        const supplyKey = PrivateKey.generateED25519().publicKey;
        const feeScheduleKey = PrivateKey.generateED25519().publicKey;
        const pauseKey = PrivateKey.generateED25519().publicKey;
        const metadataKey = PrivateKey.generateED25519().publicKey;
        const expirationTime = new Date("2099-01-02T03:04:05.000Z");
        const metadata = new Uint8Array([1, 2, 3]);

        await service.updateToken({
            tokenId: "0.0.500",
            tokenName: "Renamed",
            tokenSymbol: "RNM",
            treasuryAccountId: "0.0.999",
            adminKey,
            kycKey,
            freezeKey,
            wipeKey,
            supplyKey,
            autoRenewAccountId: "0.0.888",
            expirationTime,
            autoRenewPeriod: 7_776_000,
            tokenMemo: "updated memo",
            feeScheduleKey,
            pauseKey,
            metadataKey,
            metadata,
            keyVerificationMode: TokenKeyValidation.FullValidation,
        });

        const tx = sentTx();
        expect(tx.tokenId?.toString()).toBe("0.0.500");
        expect(tx.tokenName).toBe("Renamed");
        expect(tx.tokenSymbol).toBe("RNM");
        expect(tx.treasuryAccountId?.toString()).toBe("0.0.999");
        expect(tx.adminKey).toBe(adminKey);
        expect(tx.kycKey).toBe(kycKey);
        expect(tx.freezeKey).toBe(freezeKey);
        expect(tx.wipeKey).toBe(wipeKey);
        expect(tx.supplyKey).toBe(supplyKey);
        expect(tx.autoRenewAccountId?.toString()).toBe("0.0.888");
        expect(tx.expirationTime?.toDate()).toEqual(expirationTime);
        expect(tx.autoRenewPeriod?.seconds.toNumber()).toBe(7_776_000);
        expect(tx.tokenMemo).toBe("updated memo");
        expect(tx.feeScheduleKey).toBe(feeScheduleKey);
        expect(tx.pauseKey).toBe(pauseKey);
        expect(tx.metadataKey).toBe(metadataKey);
        expect(tx.metadata).toEqual(metadata);
        expect(tx.keyVerificationMode).toBe(TokenKeyValidation.FullValidation);
    });

    it("passes the options to the executor with the TokenUpdate event", async () => {
        const adminSigner = PrivateKey.generateED25519();

        await service.updateToken({
            tokenId: "0.0.500",
            tokenName: "Renamed",
            transactionMemo: "update memo",
            additionalSigners: [adminSigner],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenUpdateTransaction),
            expect.objectContaining({
                transactionMemo: "update memo",
                additionalSigners: [adminSigner],
            }),
            expect.objectContaining({
                type: "TokenUpdate",
                serviceName: "TokenService",
                methodName: "updateToken",
            }),
        );
    });

    it("schedules the built update with the schedule options", async () => {
        const scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);

        const result = await service.scheduleUpdateToken(
            {
                tokenId: "0.0.500",
                tokenName: "Renamed",
            },
            { scheduleMemo: "pending approval" },
        );

        const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
        expect(tx).toBeInstanceOf(TokenUpdateTransaction);
        expect((tx as TokenUpdateTransaction).tokenName).toBe("Renamed");
        expect(scheduleOptions).toEqual({ scheduleMemo: "pending approval" });
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("throws when tokenId is missing", async () => {
        await expect(
            service.updateToken({
                tokenId: undefined as unknown as string,
            }),
        ).rejects.toThrow(/tokenId is required/);
    });

    it("throws when tokenName exceeds 100 bytes", async () => {
        await expect(
            service.updateToken({
                tokenId: "0.0.500",
                tokenName: "a".repeat(101),
            }),
        ).rejects.toThrow(/tokenName exceeds 100 bytes/);
    });
});
