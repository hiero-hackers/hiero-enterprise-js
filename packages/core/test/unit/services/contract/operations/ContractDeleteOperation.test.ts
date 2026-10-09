import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContractDeleteTransaction, ScheduleId } from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("ContractDeleteOperation (via ContractService)", () => {
    let service: ContractService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as ContractDeleteTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new ContractService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("deleteContract", () => {
        it("deletes the contract and sends its balance to transferAccountId", async () => {
            const result = await service.deleteContract({
                contractId: "0.0.12345",
                transferAccountId: "0.0.2",
            });

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
            const tx = sentTx();
            expect(tx).toBeInstanceOf(ContractDeleteTransaction);
            expect(tx.contractId?.toString()).toBe("0.0.12345");
            expect(tx.transferAccountId?.toString()).toBe("0.0.2");
            expect(tx.transferContractId).toBeNull();
        });

        it("sends the ContractDelete event", async () => {
            await service.deleteContract({
                contractId: "0.0.12345",
                transferAccountId: "0.0.2",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(ContractDeleteTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "ContractDelete",
                    serviceName: "ContractService",
                    methodName: "deleteContract",
                }),
            );
        });

        it("deletes the contract and sends its balance to transferContractId", async () => {
            await service.deleteContract({
                contractId: "0.0.12345",
                transferContractId: "0.0.999",
            });

            const tx = sentTx();
            expect(tx.contractId?.toString()).toBe("0.0.12345");
            expect(tx.transferContractId?.toString()).toBe("0.0.999");
            expect(tx.transferAccountId).toBeNull();
        });

        it("propagates validator errors before building a transaction", async () => {
            await expect(
                service.deleteContract(
                    {} as unknown as Parameters<
                        typeof service.deleteContract
                    >[0],
                ),
            ).rejects.toThrow(/contractId is required/);

            expect(run).not.toHaveBeenCalled();
        });

        it("rejects when no transfer target is provided", async () => {
            await expect(
                service.deleteContract({
                    contractId: "0.0.12345",
                }),
            ).rejects.toThrow(/transfer target is required/);

            expect(run).not.toHaveBeenCalled();
        });

        it("rejects when both transfer targets are provided", async () => {
            await expect(
                service.deleteContract({
                    contractId: "0.0.12345",
                    transferAccountId: "0.0.2",
                    transferContractId: "0.0.999",
                }),
            ).rejects.toThrow(/transferAccountId or transferContractId/);

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleDeleteContract", () => {
        it("schedules the built transaction with the schedule options and returns the scheduleId", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleDeleteContract(
                {
                    contractId: "0.0.12345",
                    transferAccountId: "0.0.2",
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "delete via multisig",
                },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(ContractDeleteTransaction);
            expect(
                (tx as ContractDeleteTransaction).contractId?.toString(),
            ).toBe("0.0.12345");
            expect(scheduleOptions).toEqual({
                payerAccountId: "0.0.999",
                scheduleMemo: "delete via multisig",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
