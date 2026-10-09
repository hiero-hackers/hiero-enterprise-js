import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    Query,
    ScheduleId,
    TransactionId,
    TransactionReceiptQuery,
    TransactionResponse,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; the executor and the child-receipt query's
// Query.execute, the network steps, are stubbed.

const evmAddress = "0x" + "a".repeat(40);
const transactionId = TransactionId.fromString("0.0.2@1700000000.000000000");

const receipt = {
    response: new TransactionResponse({
        nodeId: AccountId.fromString("0.0.3"),
        transactionHash: new Uint8Array(),
        transactionId,
    }),
    receipt: {},
    status: "SUCCESS",
    transactionId: transactionId.toString(),
};

describe("AutoCreateEvmAccountOperation (via AccountService)", () => {
    let service: AccountService;
    let run: ReturnType<typeof vi.spyOn>;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TransferTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue({ children: [] });
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("autoCreateEvmAccount", () => {
        it("transfers HBAR to seed the EVM address and returns the child account", async () => {
            execute.mockResolvedValueOnce({
                children: [{ accountId: AccountId.fromString("0.0.4321") }],
            });

            const result = await service.autoCreateEvmAccount({
                evmAddress,
                amount: 5,
            });

            expect(sentTx()).toBeInstanceOf(TransferTransaction);
            const transfers = sentTx().hbarTransfers;
            expect(transfers.get("0.0.2")?.toBigNumber().toNumber()).toBe(-5);
            expect(
                transfers
                    .get(AccountId.fromEvmAddress(0, 0, evmAddress))
                    ?.toBigNumber()
                    .toNumber(),
            ).toBe(5);

            // The account id is read from the transfer's child receipts.
            const query = execute.mock.contexts[0] as TransactionReceiptQuery;
            expect(query).toBeInstanceOf(TransactionReceiptQuery);
            expect(query.transactionId?.toString()).toBe(
                transactionId.toString(),
            );
            expect(query.includeChildren).toBe(true);

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
            expect(result.accountId?.toString()).toBe("0.0.4321");
        });

        it("resolves without accountId for a warm address — never throws after funds moved", async () => {
            const result = await service.autoCreateEvmAccount({
                evmAddress,
                amount: 5,
            });

            // The transfer landed (the caller must not retry); it just
            // created nothing.
            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
            expect(result.accountId).toBeNull();
        });

        it("a failed child-receipt lookup throws the post-consensus error — never a silent accountId: null", async () => {
            // The transfer reached consensus, then the child receipt query
            // fails. That is not "warm address, nothing created": the caller
            // must learn the check failed and not resubmit.
            execute.mockRejectedValueOnce(new Error("network blip"));

            const attempt = service.autoCreateEvmAccount({
                evmAddress,
                amount: 5,
            });

            await expect(attempt).rejects.toBeInstanceOf(HieroError);
            await expect(attempt).rejects.toMatchObject({
                code: HieroErrorCodes.ResultMappingFailed,
                transactionId: receipt.transactionId,
                message: expect.stringContaining("Do not resubmit"),
            });
        });

        it("keeps a non-Error failure as the cause", async () => {
            execute.mockRejectedValueOnce("socket closed");

            await expect(
                service.autoCreateEvmAccount({ evmAddress, amount: 5 }),
            ).rejects.toMatchObject({
                cause: "socket closed",
                message: expect.stringContaining("failed: socket closed."),
            });
        });
    });

    describe("scheduleAutoCreateEvmAccount", () => {
        it("schedules the hollow-account transfer", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleAutoCreateEvmAccount({
                evmAddress,
                amount: 5,
            });

            const tx = scheduleRun.mock.calls[0][0] as TransferTransaction;
            expect(
                tx.hbarTransfers.get("0.0.2")?.toBigNumber().toNumber(),
            ).toBe(-5);
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
