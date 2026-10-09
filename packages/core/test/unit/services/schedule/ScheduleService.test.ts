import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    KeyList,
    PrivateKey,
    Query,
    ScheduleDeleteTransaction,
    ScheduleId,
    ScheduleInfoQuery,
    ScheduleSignTransaction,
    Status,
    Timestamp,
    TransactionId,
    type ScheduleInfo,
} from "@hiero-ledger/sdk";
import { ScheduleService } from "../../../../src/services/schedule/index.js";
import { TransactionExecutor } from "../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../utils/mock-context.js";

// Builds real SDK transactions and queries; only the network step is
// stubbed: TransactionExecutor.run for transactions and Query.execute for
// queries. ScheduleInfo has no public constructor, so it is plain data.

const SCHEDULE_ID = "0.0.777";

function runResult(scheduledTransactionId: TransactionId | null = null) {
    return {
        receipt: {
            status: Status.Success,
            scheduleId: ScheduleId.fromString(SCHEDULE_ID),
            scheduledTransactionId,
        },
        transactionId: "0.0.2@1234567890.000000000",
        status: "SUCCESS",
    };
}

function scheduleInfo(overrides: Partial<ScheduleInfo> = {}): ScheduleInfo {
    return {
        scheduleId: ScheduleId.fromString(SCHEDULE_ID),
        creatorAccountId: AccountId.fromString("0.0.2"),
        payerAccountId: AccountId.fromString("0.0.2"),
        scheduleMemo: "pending approval",
        executed: null,
        deleted: null,
        expirationTime: Timestamp.fromDate(
            new Date("2099-01-01T00:00:00.000Z"),
        ),
        scheduledTransactionId: TransactionId.fromString(
            "0.0.2@9999999999.000000000",
        ),
        signers: new KeyList(),
        waitForExpiry: false,
        ...overrides,
    } as ScheduleInfo;
}

describe("ScheduleService", () => {
    let scheduleService: ScheduleService;
    let run: ReturnType<typeof vi.spyOn>;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The transaction, options and event handed to the executor. */
    const sentTx = <T>() => run.mock.calls[0][0] as T;
    const sentOptions = () => run.mock.calls[0][1];
    const sentEvent = () => run.mock.calls[0][2];

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(runResult() as never);
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(scheduleInfo());
        scheduleService = new ScheduleService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── sign() ───────────────────────────────────────────────────────────────

    describe("sign", () => {
        it("builds a ScheduleSignTransaction for the schedule", async () => {
            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                additionalSigners: [PrivateKey.generateED25519()],
            });

            const tx = sentTx<ScheduleSignTransaction>();
            expect(tx).toBeInstanceOf(ScheduleSignTransaction);
            expect(tx.scheduleId?.toString()).toBe(SCHEDULE_ID);
        });

        it("passes additionalSigners to the executor", async () => {
            const signerKey = PrivateKey.generateED25519();

            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                additionalSigners: [signerKey],
            });

            expect(sentOptions().additionalSigners).toEqual([signerKey]);
        });

        it("omits scheduledTransactionId when the receipt does not carry one", async () => {
            const result = await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                additionalSigners: [PrivateKey.generateED25519()],
            });

            expect(result).toMatchObject({
                transactionId: "0.0.2@1234567890.000000000",
                status: "SUCCESS",
            });
            expect(result.scheduledTransactionId).toBeNull();
        });

        it("carries the scheduled transaction id reported by the receipt", async () => {
            const scheduledTxId = TransactionId.fromString(
                "0.0.500@1234567890.000000001",
            ).setScheduled(true);
            run.mockResolvedValue(runResult(scheduledTxId) as never);

            const result = await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                additionalSigners: [PrivateKey.generateED25519()],
            });

            expect(result.scheduledTransactionId?.toString()).toBe(
                "0.0.500@1234567890.000000001?scheduled",
            );
        });

        it("passes external (HSM/KMS) signers to the executor", async () => {
            const walletKey = PrivateKey.generateECDSA();
            const externalSigner = {
                publicKey: walletKey.publicKey,
                sign: (msg: Uint8Array): Promise<Uint8Array> =>
                    Promise.resolve(walletKey.sign(msg)),
            };

            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                externalSigners: [externalSigner],
            });

            expect(sentOptions().externalSigners).toEqual([externalSigner]);
        });

        it("passes base TransactionOptions to the executor", async () => {
            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                transactionMemo: "multisig round 2",
                maxTransactionFee: 2,
            });

            expect(sentOptions()).toMatchObject({
                transactionMemo: "multisig round 2",
                maxTransactionFee: 2,
            });
        });

        it("sends the ScheduleSign event", async () => {
            await scheduleService.sign({ scheduleId: SCHEDULE_ID });

            expect(sentEvent()).toMatchObject({
                type: "ScheduleSign",
                serviceName: "ScheduleService",
                methodName: "sign",
            });
        });
    });

    // ── cancel() ─────────────────────────────────────────────────────────────

    describe("cancel", () => {
        it("builds a ScheduleDeleteTransaction for the schedule", async () => {
            const adminKey = PrivateKey.generateED25519();

            await scheduleService.cancel({ scheduleId: SCHEDULE_ID, adminKey });

            const tx = sentTx<ScheduleDeleteTransaction>();
            expect(tx).toBeInstanceOf(ScheduleDeleteTransaction);
            expect(tx.scheduleId?.toString()).toBe(SCHEDULE_ID);
        });

        it("signs with adminKey", async () => {
            const adminKey = PrivateKey.generateED25519();

            await scheduleService.cancel({ scheduleId: SCHEDULE_ID, adminKey });

            // adminKey is the first (and only) signer
            expect(sentOptions().additionalSigners).toEqual([adminKey]);
        });

        it("places adminKey before any additional signers", async () => {
            const adminKey = PrivateKey.generateED25519();
            const extraKey = PrivateKey.generateED25519();

            await scheduleService.cancel({
                scheduleId: SCHEDULE_ID,
                adminKey,
                additionalSigners: [extraKey],
            });

            expect(sentOptions().additionalSigners).toEqual([
                adminKey,
                extraKey,
            ]);
        });

        it("sends the ScheduleDelete event and returns the result", async () => {
            const adminKey = PrivateKey.generateED25519();

            const result = await scheduleService.cancel({
                scheduleId: SCHEDULE_ID,
                adminKey,
            });

            expect(sentEvent()).toMatchObject({
                type: "ScheduleDelete",
                serviceName: "ScheduleService",
                methodName: "cancel",
            });
            expect(result.status).toBe("SUCCESS");
        });
    });

    // ── getInfo() ────────────────────────────────────────────────────────────

    describe("getInfo", () => {
        it("returns structured schedule info for a pending schedule", async () => {
            const info = await scheduleService.getInfo(SCHEDULE_ID);

            const query = execute.mock.contexts[0] as ScheduleInfoQuery;
            expect(query).toBeInstanceOf(ScheduleInfoQuery);
            expect(query.scheduleId?.toString()).toBe(SCHEDULE_ID);

            expect(info.scheduleId).toBe(SCHEDULE_ID);
            expect(info.scheduleMemo).toBe("pending approval");
            expect(info.creatorAccountId).toBe("0.0.2");
            expect(info.isPending).toBe(true);
            expect(info.isExecuted).toBe(false);
            expect(info.isDeleted).toBe(false);
            expect(info.signerCount).toBe(0);
            expect(info.waitForExpiry).toBe(false);
            expect(info.expiresAt).toBe("2099-01-01T00:00:00.000Z");
        });

        it("reflects executed state correctly", async () => {
            execute.mockResolvedValueOnce(
                scheduleInfo({
                    executed: Timestamp.fromDate(
                        new Date("2025-06-01T12:00:00.000Z"),
                    ),
                }),
            );

            const info = await scheduleService.getInfo(SCHEDULE_ID);

            expect(info.isExecuted).toBe(true);
            expect(info.isPending).toBe(false);
            expect(info.executedAt).toBe("2025-06-01T12:00:00.000Z");
        });

        it("reflects deleted state correctly", async () => {
            execute.mockResolvedValueOnce(
                scheduleInfo({
                    deleted: Timestamp.fromDate(
                        new Date("2025-06-01T14:00:00.000Z"),
                    ),
                }),
            );

            const info = await scheduleService.getInfo(SCHEDULE_ID);

            expect(info.isDeleted).toBe(true);
            expect(info.isPending).toBe(false);
            expect(info.deletedAt).toBe("2025-06-01T14:00:00.000Z");
        });

        it("counts signers from the KeyList", async () => {
            execute.mockResolvedValueOnce(
                scheduleInfo({
                    signers: KeyList.of(
                        PrivateKey.generateED25519().publicKey,
                        PrivateKey.generateED25519().publicKey,
                    ),
                }),
            );

            const info = await scheduleService.getInfo(SCHEDULE_ID);

            expect(info.signerCount).toBe(2);
        });

        it("wraps errors in a HieroError", async () => {
            execute.mockRejectedValueOnce(new Error("INVALID_SCHEDULE_ID"));

            await expect(
                scheduleService.getInfo("0.0.999"),
            ).rejects.toMatchObject({
                name: "HieroError",
                context: "ScheduleService.getInfo",
            });
        });
    });
});
