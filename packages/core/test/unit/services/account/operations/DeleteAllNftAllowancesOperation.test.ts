import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    PrivateKey,
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

describe("DeleteAllNftAllowancesOperation (via AccountService)", () => {
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

    it("revokes an approve-for-all-serials allowance", async () => {
        const result = await service.deleteAllNftAllowances([
            {
                tokenId: "0.0.600",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.200",
            },
        ]);

        expect(result).toMatchObject({
            transactionId: receipt.transactionId,
            status: "SUCCESS",
        });
        const tx = sentTx();
        expect(tx).toBeInstanceOf(AccountAllowanceApproveTransaction);
        expect(tx.tokenNftApprovals).toHaveLength(1);
        const [approval] = tx.tokenNftApprovals;
        expect(approval.tokenId.toString()).toBe("0.0.600");
        expect(approval.ownerAccountId?.toString()).toBe("0.0.100");
        expect(approval.spenderAccountId?.toString()).toBe("0.0.200");
        // allSerials: false is the revocation
        expect(approval.allSerials).toBe(false);
    });

    it("revokes several approve-for-all-serials allowances in one transaction", async () => {
        await service.deleteAllNftAllowances([
            {
                tokenId: "0.0.600",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.200",
            },
            {
                tokenId: "0.0.700",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.300",
            },
        ]);

        const approvals = sentTx().tokenNftApprovals.map((a) => ({
            tokenId: a.tokenId.toString(),
            owner: a.ownerAccountId?.toString(),
            spender: a.spenderAccountId?.toString(),
            allSerials: a.allSerials,
        }));
        expect(approvals).toEqual([
            {
                tokenId: "0.0.600",
                owner: "0.0.100",
                spender: "0.0.200",
                allSerials: false,
            },
            {
                tokenId: "0.0.700",
                owner: "0.0.100",
                spender: "0.0.300",
                allSerials: false,
            },
        ]);
    });

    it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
        const ownerKey = PrivateKey.generateED25519();
        await service.deleteAllNftAllowances(
            [
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ],
            { additionalSigners: [ownerKey] },
        );

        expect(run).toHaveBeenCalledWith(
            expect.any(AccountAllowanceApproveTransaction),
            expect.objectContaining({ additionalSigners: [ownerKey] }),
            expect.objectContaining({ type: "AccountAllowanceApprove" }),
        );
    });

    it("rejects when tokenId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]),
        ).rejects.toThrow(/tokenId is required/);
        expect(run).not.toHaveBeenCalled();
    });

    it("rejects when ownerAccountId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "",
                    spenderAccountId: "0.0.200",
                },
            ]),
        ).rejects.toThrow(/ownerAccountId is required/);
    });

    it("rejects when spenderAccountId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "",
                },
            ]),
        ).rejects.toThrow(/spenderAccountId is required/);
    });
});
