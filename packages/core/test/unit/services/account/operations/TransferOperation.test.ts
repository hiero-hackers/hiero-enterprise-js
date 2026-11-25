import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    Hbar,
    PrivateKey,
    ScheduleId,
    Status,
    TokenId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

/** HBAR legs of a transaction as [account, tinybars, approved]. */
const hbarLegs = (tx: TransferTransaction) =>
    tx.hbarTransfersList.map((t) => [
        t.accountId.toString(),
        t.amount.toTinybars().toString(),
        t.isApproved,
    ]);

/** The SDK keeps token legs in a protected list. */
interface TokenLeg {
    tokenId: TokenId;
    accountId: AccountId;
    amount: { toString(): string };
    expectedDecimals: number | null;
    isApproved: boolean;
}

/** Token legs of a transaction as [token, account, amount, decimals, approved]. */
const tokenLegs = (tx: TransferTransaction) =>
    (tx as unknown as { _tokenTransfers: TokenLeg[] })._tokenTransfers.map(
        (t) => [
            t.tokenId.toString(),
            t.accountId.toString(),
            t.amount.toString(),
            t.expectedDecimals,
            t.isApproved,
        ],
    );

/** NFT legs of one token as [serial, sender, receiver, approved]. */
const nftLegs = (tx: TransferTransaction, tokenId: string) =>
    (tx.nftTransfers.get(tokenId) ?? []).map((t) => [
        t.serial.toNumber(),
        t.sender.toString(),
        t.recipient.toString(),
        t.isApproved,
    ]);

describe("TransferOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;
    let scheduleRun: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TransferTransaction;

    /** The transaction handed to the executor to schedule. */
    const scheduledTx = () =>
        scheduleRun.mock.calls[0][0] as TransferTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("transfer", () => {
        it("sends HBAR from several senders to several receivers", async () => {
            const result = await service.transfer({
                hbarTransfers: [
                    { accountId: "0.0.100", amount: -3 },
                    { accountId: "0.0.101", amount: Hbar.fromTinybars(-5) },
                    { accountId: "0.0.200", amount: 1 },
                    {
                        accountId: AccountId.fromString("0.0.201"),
                        amount: Hbar.fromTinybars(200_000_005),
                    },
                ],
            });

            expect(result.status).toBe("SUCCESS");
            expect(hbarLegs(sentTx())).toEqual([
                ["0.0.100", "-300000000", false],
                ["0.0.101", "-5", false],
                ["0.0.200", "100000000", false],
                ["0.0.201", "200000005", false],
            ]);
        });

        it("sends HBAR, tokens and NFTs in one transaction", async () => {
            await service.transfer({
                hbarTransfers: [
                    { accountId: "0.0.100", amount: -1 },
                    { accountId: "0.0.200", amount: 1 },
                ],
                tokenTransfers: [
                    { tokenId: "0.0.456", accountId: "0.0.200", amount: -10 },
                    { tokenId: "0.0.456", accountId: "0.0.100", amount: 10 },
                ],
                nftTransfers: [
                    {
                        tokenId: TokenId.fromString("0.0.789"),
                        serial: 3,
                        senderAccountId: "0.0.200",
                        receiverAccountId: "0.0.100",
                    },
                ],
            });

            const tx = sentTx();
            expect(hbarLegs(tx)).toEqual([
                ["0.0.100", "-100000000", false],
                ["0.0.200", "100000000", false],
            ]);
            expect(tokenLegs(tx)).toEqual([
                ["0.0.456", "0.0.200", "-10", null, false],
                ["0.0.456", "0.0.100", "10", null, false],
            ]);
            expect(nftLegs(tx, "0.0.789")).toEqual([
                [3, "0.0.200", "0.0.100", false],
            ]);
        });

        it("marks approved legs as allowance transfers", async () => {
            await service.transfer({
                hbarTransfers: [
                    { accountId: "0.0.100", amount: -1, approved: true },
                    { accountId: "0.0.200", amount: 1 },
                ],
                tokenTransfers: [
                    {
                        tokenId: "0.0.456",
                        accountId: "0.0.100",
                        amount: -10,
                        approved: true,
                    },
                    { tokenId: "0.0.456", accountId: "0.0.200", amount: 10 },
                ],
                nftTransfers: [
                    {
                        tokenId: "0.0.789",
                        serial: 1,
                        senderAccountId: "0.0.100",
                        receiverAccountId: "0.0.200",
                        approved: true,
                    },
                ],
                payer: "0.0.300",
            });

            const tx = sentTx();
            expect(hbarLegs(tx).map((leg) => leg[2])).toEqual([true, false]);
            expect(tokenLegs(tx).map((leg) => leg[4])).toEqual([true, false]);
            expect(nftLegs(tx, "0.0.789").map((leg) => leg[3])).toEqual([true]);
            expect(run).toHaveBeenCalledWith(
                expect.any(TransferTransaction),
                expect.objectContaining({ payer: "0.0.300" }),
                expect.objectContaining({ methodName: "transfer" }),
            );
        });

        it("adds expectedDecimals to token legs, approved or not", async () => {
            await service.transfer({
                tokenTransfers: [
                    {
                        tokenId: "0.0.456",
                        accountId: "0.0.100",
                        amount: -10,
                        expectedDecimals: 2,
                        approved: true,
                    },
                    {
                        tokenId: "0.0.456",
                        accountId: "0.0.200",
                        amount: 10,
                        expectedDecimals: 2,
                    },
                ],
            });

            expect(tokenLegs(sentTx())).toEqual([
                ["0.0.456", "0.0.100", "-10", 2, true],
                ["0.0.456", "0.0.200", "10", 2, false],
            ]);
        });

        it("forwards additionalSigners to the executor", async () => {
            const senderKey = PrivateKey.generateED25519();
            await service.transfer({
                hbarTransfers: [
                    { accountId: "0.0.100", amount: -1 },
                    { accountId: "0.0.200", amount: 1 },
                ],
                additionalSigners: [senderKey],
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(TransferTransaction),
                expect.objectContaining({ additionalSigners: [senderKey] }),
                expect.objectContaining({ type: "CryptoTransfer" }),
            );
        });

        it("rejects HBAR legs that don't sum to zero", async () => {
            await expect(
                service.transfer({
                    hbarTransfers: [
                        { accountId: "0.0.100", amount: -2 },
                        { accountId: "0.0.200", amount: 1 },
                    ],
                }),
            ).rejects.toMatchObject({
                sdkStatus: Status.InvalidAccountAmounts.toString(),
            });
            expect(run).not.toHaveBeenCalled();
        });

        it("rejects token legs that don't sum to zero", async () => {
            await expect(
                service.transfer({
                    tokenTransfers: [
                        {
                            tokenId: "0.0.456",
                            accountId: "0.0.100",
                            amount: -2,
                        },
                    ],
                }),
            ).rejects.toMatchObject({
                sdkStatus: Status.TransfersNotZeroSumForToken.toString(),
            });
            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleTransfer", () => {
        it("returns the scheduleId and forwards schedule options", async () => {
            const result = await service.scheduleTransfer({
                hbarTransfers: [
                    { accountId: "0.0.100", amount: -1 },
                    { accountId: "0.0.200", amount: 1 },
                ],
                payerAccountId: "0.0.999",
                scheduleMemo: "payroll",
            });

            expect(result.scheduleId.toString()).toBe("0.0.777");
            expect(hbarLegs(scheduledTx())).toEqual([
                ["0.0.100", "-100000000", false],
                ["0.0.200", "100000000", false],
            ]);
            expect(scheduleRun.mock.calls[0][1]).not.toHaveProperty(
                "payerAccountId",
            );
            expect(scheduleRun.mock.calls[0][3]).toMatchObject({
                payerAccountId: "0.0.999",
                scheduleMemo: "payroll",
            });
        });

        it("validates the legs before scheduling", async () => {
            await expect(service.scheduleTransfer({})).rejects.toThrow(
                /At least one transfer/,
            );
            expect(scheduleRun).not.toHaveBeenCalled();
        });
    });
});
