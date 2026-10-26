import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    ContractId,
    EvmHookStorageSlot,
    HookStoreTransaction,
    Long,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/MockContext.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

const slot = new EvmHookStorageSlot({
    key: new Uint8Array([0x01]),
    value: new Uint8Array([0x2a]),
});

describe("HookStoreOperation (via ContractService)", () => {
    let service: ContractService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as HookStoreTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new ContractService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("updateHookStorage", () => {
        it("updates the storage of an account-owned hook", async () => {
            const result = await service.updateHookStorage({
                accountId: "0.0.1234",
                hookId: 1,
                storageUpdates: [slot],
            });

            expect(result).toMatchObject({
                transactionId: receipt.transactionId,
                status: "SUCCESS",
            });

            const tx = sentTx();
            expect(tx).toBeInstanceOf(HookStoreTransaction);
            expect(tx.hookId?.entityId?.accountId?.toString()).toBe("0.0.1234");
            expect(tx.hookId?.entityId?.contractId).toBeNull();
            expect(tx.hookId?.hookId?.toString()).toBe("1");
            expect(tx.storageUpdates).toEqual([slot]);
        });

        it("updates the storage of a contract-owned hook", async () => {
            await service.updateHookStorage({
                contractId: ContractId.fromString("0.0.5678"),
                hookId: Long.fromString("9007199254740993"),
                storageUpdates: [slot],
            });

            const tx = sentTx();
            expect(tx.hookId?.entityId?.contractId?.toString()).toBe(
                "0.0.5678",
            );
            expect(tx.hookId?.entityId?.accountId).toBeNull();
            expect(tx.hookId?.hookId?.toString()).toBe("9007199254740993");
        });

        it("accepts an AccountId instance as the owner", async () => {
            await service.updateHookStorage({
                accountId: AccountId.fromString("0.0.42"),
                hookId: 0,
                storageUpdates: [slot],
            });

            expect(sentTx().hookId?.entityId?.accountId?.toString()).toBe(
                "0.0.42",
            );
        });

        it("sends the HookStore event and forwards TransactionOptions", async () => {
            await service.updateHookStorage({
                accountId: "0.0.1234",
                hookId: 1,
                storageUpdates: [slot],
                transactionMemo: "base memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(HookStoreTransaction),
                expect.objectContaining({ transactionMemo: "base memo" }),
                expect.objectContaining({
                    type: "HookStore",
                    serviceName: "ContractService",
                    methodName: "updateHookStorage",
                }),
            );
        });

        it("rejects invalid options before sending", async () => {
            await expect(
                service.updateHookStorage({
                    accountId: "0.0.1234",
                    hookId: 1,
                    storageUpdates: [],
                }),
            ).rejects.toMatchObject({
                name: "HieroError",
                code: "INPUT_INVALID",
                message: expect.stringContaining("at least one update"),
            });

            expect(run).not.toHaveBeenCalled();
        });
    });
});
