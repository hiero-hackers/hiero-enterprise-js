import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../../../src/services/account/index.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["addHbarTransfer"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TransferTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("AutoCreateEvmAccountOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

    describe("autoCreateEvmAccount", () => {
        it("transfers HBAR to seed the EVM address and returns the child account", async () => {
            // The new account id arrives on the transfer's child receipt —
            // the operation asks the executor for child receipts.
            mocks.receipt.children = [
                { accountId: { toString: () => "0.0.4321" } },
            ];

            const result = await service.autoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mocks.tx.addHbarTransfer).toHaveBeenCalledTimes(2);
            expect(mocks.tx.execute).toHaveBeenCalledWith(context.client);
            expect(mocks.response.getReceiptQuery).toHaveBeenCalled();
            expect(result).toMatchObject({
                transactionId: "0.0.123@1234567890.000000000",
                status: "SUCCESS",
            });
            expect(result.accountId?.toString()).toBe("0.0.4321");
        });

        it("resolves without accountId for a warm address — never throws after funds moved", async () => {
            mocks.receipt.children = [];

            const result = await service.autoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            // The transfer landed (the caller must not retry); it just
            // created nothing.
            expect(result).toMatchObject({
                transactionId: "0.0.123@1234567890.000000000",
                status: "SUCCESS",
            });
            expect(result.accountId).toBeNull();
        });

        it("a failed child-receipt lookup throws the post-consensus error — never a silent accountId: null", async () => {
            // The transfer reached consensus, then the follow-up child
            // receipt query fails (network blip). That is NOT the same as
            // "warm address, nothing created": the caller must learn the
            // check failed, keep the transaction id, and not resubmit.
            mocks.response.receiptQueryExecute.mockRejectedValueOnce(
                new Error("network blip"),
            );

            const attempt = service.autoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            await expect(attempt).rejects.toBeInstanceOf(HieroError);
            const error = await attempt.catch((e: HieroError) => e);
            expect(error.code).toBe(HieroErrorCodes.ResultMappingFailed);
            expect(error.transactionId).toBe("0.0.123@1234567890.000000000");
            expect(error.message).toContain("Do not resubmit");
        });
    });

    describe("scheduleAutoCreateEvmAccount", () => {
        it("schedules the hollow-account transfer", async () => {
            const result = await service.scheduleAutoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mocks.tx.schedule).toHaveBeenCalled();
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
