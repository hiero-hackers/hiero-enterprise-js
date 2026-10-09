import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    AccountAllowanceDeleteTransaction,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Covers `deleteHbarAllowance` + `deleteTokenAllowance` (both approve with
// amount=0 on `AccountAllowanceApproveTransaction`) and `deleteNftAllowance`
// (per-serial revocation on `AccountAllowanceDeleteTransaction`). Builds real
// SDK transactions; only the executor, which sends them, is stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("DeleteAllowanceOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The approve transaction handed to the executor. */
    const sentApproveTx = () =>
        run.mock.calls[0][0] as AccountAllowanceApproveTransaction;

    /** The delete transaction handed to the executor. */
    const sentDeleteTx = () =>
        run.mock.calls[0][0] as AccountAllowanceDeleteTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("deleteHbarAllowance", () => {
        it("revokes an HBAR allowance by approving amount=0", async () => {
            const result = await service.deleteHbarAllowance([
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
            const tx = sentApproveTx();
            expect(tx).toBeInstanceOf(AccountAllowanceApproveTransaction);
            expect(tx.hbarApprovals).toHaveLength(1);
            const [approval] = tx.hbarApprovals;
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.amount?.toTinybars().toNumber()).toBe(0);
        });

        it("revokes several HBAR allowances in one transaction", async () => {
            await service.deleteHbarAllowance([
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.300",
                },
            ]);

            const approvals = sentApproveTx().hbarApprovals.map((a) => ({
                owner: a.ownerAccountId?.toString(),
                spender: a.spenderAccountId?.toString(),
                amount: a.amount?.toTinybars().toNumber(),
            }));
            expect(approvals).toEqual([
                { owner: "0.0.100", spender: "0.0.200", amount: 0 },
                { owner: "0.0.100", spender: "0.0.300", amount: 0 },
            ]);
        });

        it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();
            await service.deleteHbarAllowance(
                [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ],
                { additionalSigners: [ownerKey] },
            );

            expect(run).toHaveBeenCalledWith(
                expect.any(AccountAllowanceApproveTransaction),
                expect.objectContaining({ additionalSigners: [ownerKey] }),
                expect.anything(),
            );
        });
    });

    describe("deleteTokenAllowance", () => {
        it("revokes a fungible token allowance by approving amount=0", async () => {
            await service.deleteTokenAllowance([
                {
                    tokenId: "0.0.500",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            const approvals = sentApproveTx().tokenApprovals;
            expect(approvals).toHaveLength(1);
            const [approval] = approvals;
            expect(approval.tokenId.toString()).toBe("0.0.500");
            expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
            expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
            expect(approval.amount?.toNumber()).toBe(0);
        });

        it("revokes allowances for several tokens in one transaction", async () => {
            await service.deleteTokenAllowance([
                {
                    tokenId: "0.0.500",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
                {
                    tokenId: "0.0.501",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.300",
                },
            ]);

            const approvals = sentApproveTx().tokenApprovals.map((a) => ({
                tokenId: a.tokenId.toString(),
                owner: a.ownerAccountId?.toString(),
                spender: a.spenderAccountId?.toString(),
                amount: a.amount?.toNumber(),
            }));
            expect(approvals).toEqual([
                {
                    tokenId: "0.0.500",
                    owner: "0.0.100",
                    spender: "0.0.200",
                    amount: 0,
                },
                {
                    tokenId: "0.0.501",
                    owner: "0.0.100",
                    spender: "0.0.300",
                    amount: 0,
                },
            ]);
        });

        it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();
            await service.deleteTokenAllowance(
                [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ],
                { additionalSigners: [ownerKey] },
            );

            expect(run).toHaveBeenCalledWith(
                expect.any(AccountAllowanceApproveTransaction),
                expect.objectContaining({ additionalSigners: [ownerKey] }),
                expect.anything(),
            );
        });
    });

    describe("deleteNftAllowance", () => {
        it("deletes the NFT allowance for each serial", async () => {
            await service.deleteNftAllowance([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [1, 2, 3],
                },
            ]);

            const tx = sentDeleteTx();
            expect(tx).toBeInstanceOf(AccountAllowanceDeleteTransaction);
            expect(tx.tokenNftAllowanceDeletions).toHaveLength(1);
            const [deletion] = tx.tokenNftAllowanceDeletions;
            expect(deletion.tokenId.toString()).toBe("0.0.600");
            expect(deletion.ownerAccountId?.toString()).toBe("0.0.100");
            expect(deletion.serialNumbers?.map((s) => s.toNumber())).toEqual([
                1, 2, 3,
            ]);
        });

        it("deletes NFT allowances for several tokens in one transaction", async () => {
            await service.deleteNftAllowance([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [1],
                },
                {
                    tokenId: "0.0.700",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [5, 6],
                },
            ]);

            const deletions = sentDeleteTx().tokenNftAllowanceDeletions.map(
                (d) => ({
                    tokenId: d.tokenId.toString(),
                    owner: d.ownerAccountId?.toString(),
                    serials: d.serialNumbers?.map((s) => s.toNumber()),
                }),
            );
            expect(deletions).toEqual([
                { tokenId: "0.0.600", owner: "0.0.100", serials: [1] },
                { tokenId: "0.0.700", owner: "0.0.100", serials: [5, 6] },
            ]);
        });

        it("rejects when tokenId is missing", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [1],
                    },
                ]),
            ).rejects.toThrow(/tokenId is required/);
            expect(run).not.toHaveBeenCalled();
        });

        it("rejects when ownerAccountId is missing", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "",
                        serialNumbers: [1],
                    },
                ]),
            ).rejects.toThrow(/ownerAccountId is required/);
        });

        it("rejects when serialNumbers is empty", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [],
                    },
                ]),
            ).rejects.toThrow(/serialNumbers must contain at least one entry/);
        });

        it("rejects with invalid serial numbers", async () => {
            for (const serial of [0, -1, 1.5]) {
                await expect(
                    service.deleteNftAllowance([
                        {
                            tokenId: "0.0.600",
                            ownerAccountId: "0.0.100",
                            serialNumbers: [serial],
                        },
                    ]),
                ).rejects.toThrow(/positive integers/);
            }
        });
    });
});
