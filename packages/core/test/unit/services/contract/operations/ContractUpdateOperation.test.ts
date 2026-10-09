import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ContractUpdateTransaction,
    PrivateKey,
    ScheduleId,
} from "@hiero-ledger/sdk";
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

describe("ContractUpdateOperation (via ContractService)", () => {
    let service: ContractService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as ContractUpdateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new ContractService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("updateContract", () => {
        it("updates only the contract ID and keeps SDK defaults when no other fields are set", async () => {
            const result = await service.updateContract({
                contractId: "0.0.12345",
            });

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });
            const tx = sentTx();
            const defaults = new ContractUpdateTransaction();
            expect(tx).toBeInstanceOf(ContractUpdateTransaction);
            expect(tx.contractId?.toString()).toBe("0.0.12345");
            expect(tx.adminKey).toEqual(defaults.adminKey);
            expect(tx.contractMemo).toEqual(defaults.contractMemo);
            expect(tx.autoRenewPeriod).toEqual(defaults.autoRenewPeriod);
            expect(tx.autoRenewAccountId).toEqual(defaults.autoRenewAccountId);
            expect(tx.expirationTime).toEqual(defaults.expirationTime);
            expect(tx.bytecodeFileId).toEqual(defaults.bytecodeFileId);
            expect(tx.stakedAccountId).toEqual(defaults.stakedAccountId);
            expect(tx.stakedNodeId).toEqual(defaults.stakedNodeId);
            expect(tx.declineStakingRewards).toEqual(
                defaults.declineStakingRewards,
            );
            expect(tx.maxAutomaticTokenAssociations).toEqual(
                defaults.maxAutomaticTokenAssociations,
            );
        });

        it("sends the ContractUpdate event", async () => {
            await service.updateContract({
                contractId: "0.0.12345",
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(ContractUpdateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "ContractUpdate",
                    serviceName: "ContractService",
                    methodName: "updateContract",
                }),
            );
        });

        it("sets every optional field that is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const expirationTime = new Date("2099-01-02T03:04:05.000Z");

            await service.updateContract({
                contractId: "0.0.12345",
                adminKey,
                contractMemo: "renamed",
                autoRenewPeriod: 7_776_000,
                autoRenewAccountId: "0.0.123",
                expirationTime,
                bytecodeFileId: "0.0.555",
                stakedNodeId: 0,
                declineStakingReward: true,
                maxAutomaticTokenAssociations: 5,
            });

            const tx = sentTx();
            expect(tx.adminKey).toBe(adminKey);
            expect(tx.contractMemo).toBe("renamed");
            expect(tx.autoRenewPeriod?.seconds.toNumber()).toBe(7_776_000);
            expect(tx.autoRenewAccountId?.toString()).toBe("0.0.123");
            expect(tx.expirationTime?.toDate()).toEqual(expirationTime);
            expect(tx.bytecodeFileId?.toString()).toBe("0.0.555");
            expect(tx.stakedNodeId?.toNumber()).toBe(0);
            expect(tx.declineStakingRewards).toBe(true);
            expect(tx.maxAutomaticTokenAssociations).toBe(5);
        });

        it("sets stakedAccountId without a stakedNodeId", async () => {
            await service.updateContract({
                contractId: "0.0.12345",
                stakedAccountId: "0.0.321",
            });

            const tx = sentTx();
            expect(tx.stakedAccountId?.toString()).toBe("0.0.321");
            expect(tx.stakedNodeId).toBeNull();
        });

        it("propagates validator errors before building a transaction", async () => {
            await expect(
                service.updateContract(
                    {} as unknown as Parameters<
                        typeof service.updateContract
                    >[0],
                ),
            ).rejects.toThrow(/contractId is required/);

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleUpdateContract", () => {
        it("schedules the built transaction with the schedule options and returns the scheduleId", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleUpdateContract(
                {
                    contractId: "0.0.12345",
                    contractMemo: "scheduled rename",
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "update via multisig",
                },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(ContractUpdateTransaction);
            expect((tx as ContractUpdateTransaction).contractMemo).toBe(
                "scheduled rename",
            );
            expect(scheduleOptions).toEqual({
                payerAccountId: "0.0.999",
                scheduleMemo: "update via multisig",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
