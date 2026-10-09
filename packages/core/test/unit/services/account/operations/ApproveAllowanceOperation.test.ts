import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    PrivateKey,
    Hbar,
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

describe("ApproveAllowanceOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () =>
        run.mock.calls[0][0] as AccountAllowanceApproveTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("approveHbarAllowance", () => {
        it("approves an HBAR allowance and returns the executor result", async () => {
            const result = await service.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 10,
                    },
                ],
            });

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
            const tx = sentTx();
            expect(tx).toBeInstanceOf(AccountAllowanceApproveTransaction);
            expect(tx.hbarApprovals).toHaveLength(1);
            const [approval] = tx.hbarApprovals;
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.amount?.toTinybars().toString()).toBe(
                new Hbar(10).toTinybars().toString(),
            );
        });

        it("forwards additionalSigners to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();

            await service.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5,
                    },
                ],
                additionalSigners: [ownerKey],
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(AccountAllowanceApproveTransaction),
                expect.objectContaining({ additionalSigners: [ownerKey] }),
                expect.objectContaining({ type: "AccountAllowanceApprove" }),
            );
        });
    });

    describe("approveTokenAllowance", () => {
        it("approves a fungible token allowance", async () => {
            await service.approveTokenAllowance({
                tokenAllowances: [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5000,
                    },
                ],
            });

            const [approval] = sentTx().tokenApprovals;
            expect(approval.tokenId.toString()).toBe("0.0.500");
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.amount?.toNumber()).toBe(5000);
        });
    });

    describe("approveNftAllowance", () => {
        it("approves an NFT allowance for each serial", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        serialNumbers: [1, 2, 3],
                    },
                ],
            });

            const [approval] = sentTx().tokenNftApprovals;
            expect(approval.tokenId.toString()).toBe("0.0.600");
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.serialNumbers?.map((s) => s.toNumber())).toEqual([
                1, 2, 3,
            ]);
            expect(approval.allSerials).toBe(false);
            expect(approval.delegatingSpender).toBeFalsy();
        });

        it("approves an NFT allowance for all serials", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                    },
                ],
            });

            const [approval] = sentTx().tokenNftApprovals;
            expect(approval.tokenId.toString()).toBe("0.0.600");
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.allSerials).toBe(true);
            expect(approval.serialNumbers).toBeFalsy();
        });

        it("approves each serial with the delegating spender when set", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        serialNumbers: [1, 2],
                        delegatingSpender: "0.0.300",
                    },
                ],
            });

            const approvals = sentTx().tokenNftApprovals;
            expect(approvals).toHaveLength(1);
            const [approval] = approvals;
            expect(approval.tokenId.toString()).toBe("0.0.600");
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.serialNumbers?.map((s) => s.toNumber())).toEqual([
                1, 2,
            ]);
            expect(approval.delegatingSpender?.toString()).toBe("0.0.300");
        });

        it("ignores delegatingSpender when allSerials is true", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                        delegatingSpender: "0.0.300",
                    },
                ],
            });

            const [approval] = sentTx().tokenNftApprovals;
            expect(approval.allSerials).toBe(true);
            expect(approval.delegatingSpender).toBeFalsy();
        });
    });
});
