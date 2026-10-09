import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ContractCreateTransaction,
    ContractId,
    FileId,
    Hbar,
    PrivateKey,
    ScheduleId,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: { contractId: ContractId.fromString("0.0.666") },
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("ContractCreateOperation (via ContractService)", () => {
    let service: ContractService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as ContractCreateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new ContractService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createContract", () => {
        it("creates a contract from a bytecode FileId and returns the contract ID", async () => {
            const { contractId } = await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
            });

            expect(contractId.toString()).toBe("0.0.666");
            const tx = sentTx();
            expect(tx).toBeInstanceOf(ContractCreateTransaction);
            expect(tx.bytecodeFileId?.toString()).toBe("0.0.555");
            expect(tx.gas?.toNumber()).toBe(100_000);
        });

        it("sends the ContractCreate event", async () => {
            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(ContractCreateTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "ContractCreate",
                    serviceName: "ContractService",
                    methodName: "createContract",
                }),
            );
        });

        it("accepts a FileId instance", async () => {
            const fileId = FileId.fromString("0.0.555");

            await service.createContract({
                bytecodeFileId: fileId,
                gas: 100_000,
            });

            expect(sentTx().bytecodeFileId?.toString()).toBe("0.0.555");
        });

        it("creates a contract from raw bytecode bytes (HIP-435)", async () => {
            const bytecode = new Uint8Array([0x60, 0x80, 0x60, 0x40]);

            const { contractId } = await service.createContract({
                bytecode,
                gas: 200_000,
            });

            expect(contractId.toString()).toBe("0.0.666");
            const tx = sentTx();
            expect(tx.bytecode).toEqual(bytecode);
            expect(tx.gas?.toNumber()).toBe(200_000);
        });

        it("sets every optional field that is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const constructorParameters = new Uint8Array([1, 2, 3]);

            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
                initialBalance: 10,
                adminKey,
                constructorParameters,
                contractMemo: "demo",
                autoRenewPeriod: 7_776_000,
                autoRenewAccountId: "0.0.123",
                stakedNodeId: 0,
                declineStakingReward: true,
                maxAutomaticTokenAssociations: 5,
            });

            const tx = sentTx();
            expect(tx.initialBalance?.toString()).toBe(new Hbar(10).toString());
            expect(tx.adminKey).toBe(adminKey);
            expect(tx.constructorParameters).toEqual(constructorParameters);
            expect(tx.contractMemo).toBe("demo");
            expect(tx.autoRenewPeriod.seconds.toNumber()).toBe(7_776_000);
            expect(tx.autoRenewAccountId?.toString()).toBe("0.0.123");
            expect(tx.stakedNodeId?.toNumber()).toBe(0);
            expect(tx.declineStakingRewards).toBe(true);
            expect(tx.maxAutomaticTokenAssociations).toBe(5);
        });

        it("sets stakedAccountId without a stakedNodeId", async () => {
            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
                stakedAccountId: "0.0.321",
            });

            const tx = sentTx();
            expect(tx.stakedAccountId?.toString()).toBe("0.0.321");
            expect(tx.stakedNodeId).toBeNull();
        });

        it("keeps the SDK defaults for omitted fields", async () => {
            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
            });

            const tx = sentTx();
            const defaults = new ContractCreateTransaction();
            expect(tx.bytecode).toEqual(defaults.bytecode);
            expect(tx.initialBalance).toEqual(defaults.initialBalance);
            expect(tx.adminKey).toEqual(defaults.adminKey);
            expect(tx.constructorParameters).toEqual(
                defaults.constructorParameters,
            );
            expect(tx.contractMemo).toEqual(defaults.contractMemo);
            expect(tx.autoRenewPeriod).toEqual(defaults.autoRenewPeriod);
            expect(tx.autoRenewAccountId).toEqual(defaults.autoRenewAccountId);
            expect(tx.stakedAccountId).toEqual(defaults.stakedAccountId);
            expect(tx.stakedNodeId).toEqual(defaults.stakedNodeId);
            expect(tx.declineStakingRewards).toEqual(
                defaults.declineStakingRewards,
            );
            expect(tx.maxAutomaticTokenAssociations).toEqual(
                defaults.maxAutomaticTokenAssociations,
            );
        });

        it("propagates validator errors before building a transaction", async () => {
            await expect(
                service.createContract({
                    gas: 100_000,
                } as unknown as Parameters<typeof service.createContract>[0]),
            ).rejects.toThrow(/bytecodeFileId or bytecode/);

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleCreateContract", () => {
        it("schedules the built transaction with the schedule options and returns the scheduleId", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleCreateContract(
                {
                    bytecodeFileId: "0.0.555",
                    gas: 100_000,
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "deploy via multisig",
                },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(ContractCreateTransaction);
            expect(
                (tx as ContractCreateTransaction).bytecodeFileId?.toString(),
            ).toBe("0.0.555");
            expect(scheduleOptions).toEqual({
                payerAccountId: "0.0.999",
                scheduleMemo: "deploy via multisig",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
