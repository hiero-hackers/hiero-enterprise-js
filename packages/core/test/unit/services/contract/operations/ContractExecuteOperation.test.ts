import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    ContractId,
    Hbar,
    Long,
    Query,
    ScheduleId,
    TransactionId,
    TransactionRecordQuery,
    TransactionResponse,
    type TransactionRecord,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";

// Builds real SDK transactions; only the network steps are stubbed: the
// executor, which sends the transaction, and Query.execute, which fetches
// the record. The record is plain data, as TransactionRecord has no public
// constructor.

const transactionId = "0.0.123@1234567890.000000000";

const receipt = {
    response: new TransactionResponse({
        nodeId: AccountId.fromString("0.0.3"),
        transactionHash: new Uint8Array(),
        transactionId: TransactionId.fromString(transactionId),
    }),
    receipt: {},
    status: "SUCCESS",
    transactionId,
};

function record(contractFunctionResult: unknown): TransactionRecord {
    return { contractFunctionResult } as unknown as TransactionRecord;
}

/** The function call bytes the SDK encodes for `name(params)`. */
function encoded(name: string, params?: ContractFunctionParameters) {
    return new ContractExecuteTransaction().setFunction(name, params)
        .functionParameters;
}

describe("ContractExecuteOperation (via ContractService)", () => {
    let service: ContractService;
    let run: ReturnType<typeof vi.spyOn>;
    let recordQuery: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as ContractExecuteTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        recordQuery = vi.spyOn(Query.prototype, "execute");
        service = new ContractService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("executeContract", () => {
        it("calls a named function with no parameters", async () => {
            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
            });

            expect(result).toMatchObject({ transactionId, status: "SUCCESS" });
            const tx = sentTx();
            expect(tx).toBeInstanceOf(ContractExecuteTransaction);
            expect(tx.contractId?.toString()).toBe("0.0.12345");
            expect(tx.gas?.toNumber()).toBe(100_000);
            expect(tx.functionParameters).toEqual(encoded("increment"));
            expect(tx.payableAmount).toEqual(
                new ContractExecuteTransaction().payableAmount,
            );
        });

        it("sends the ContractExecute event", async () => {
            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "set",
                transactionMemo: "ctx memo",
            });

            expect(run).toHaveBeenCalledWith(
                expect.any(ContractExecuteTransaction),
                expect.objectContaining({ transactionMemo: "ctx memo" }),
                expect.objectContaining({
                    type: "ContractExecute",
                    serviceName: "ContractService",
                    methodName: "executeContract",
                }),
            );
        });

        it("does not fetch the record unless withFunctionResult is set", async () => {
            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
            });

            expect(recordQuery).not.toHaveBeenCalled();
        });

        it("returns functionResult: null when not requested — the field is always present", async () => {
            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
            });

            expect(result.functionResult).toBeNull();
        });

        it("withFunctionResult: true fetches the record once and distills the EVM outcome", async () => {
            recordQuery.mockResolvedValueOnce(
                record({
                    bytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
                    gasUsed: Long.fromNumber(21_000),
                    errorMessage: null,
                }),
            );

            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
                withFunctionResult: true,
            });

            expect(recordQuery).toHaveBeenCalledTimes(1);
            const query = recordQuery.mock
                .contexts[0] as TransactionRecordQuery;
            expect(query).toBeInstanceOf(TransactionRecordQuery);
            expect(query.transactionId?.toString()).toBe(transactionId);
            expect(result.functionResult).toEqual({
                returnDataHex: "0xdeadbeef",
                gasUsed: 21_000,
                errorMessage: null,
            });
        });

        it("surfaces the EVM revert message on functionResult.errorMessage", async () => {
            recordQuery.mockResolvedValueOnce(
                record({
                    bytes: new Uint8Array([]),
                    gasUsed: Long.fromNumber(50_000),
                    errorMessage: "execution reverted: not owner",
                }),
            );

            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "restricted",
                withFunctionResult: true,
            });

            expect(result.functionResult?.errorMessage).toBe(
                "execution reverted: not owner",
            );
        });

        it("returns functionResult: null when the record carries no contract function result", async () => {
            recordQuery.mockResolvedValueOnce(record(null));

            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
                withFunctionResult: true,
            });

            expect(result.functionResult).toBeNull();
        });

        it("a failed opt-in record fetch throws the post-consensus error — the call landed, do not resubmit", async () => {
            recordQuery.mockRejectedValueOnce(new Error("network blip"));

            const attempt = service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
                withFunctionResult: true,
            });

            await expect(attempt).rejects.toBeInstanceOf(HieroError);
            await expect(attempt).rejects.toMatchObject({
                code: HieroErrorCodes.ResultMappingFailed,
                transactionId,
                message: expect.stringContaining("Do not resubmit"),
            });
        });

        it("keeps a non-Error record-fetch failure as the cause", async () => {
            recordQuery.mockRejectedValueOnce("socket closed");

            await expect(
                service.executeContract({
                    contractId: "0.0.12345",
                    gas: 100_000,
                    functionName: "increment",
                    withFunctionResult: true,
                }),
            ).rejects.toMatchObject({
                cause: "socket closed",
                message: expect.stringContaining("failed: socket closed."),
            });
        });

        it("encodes ABI-typed function parameters", async () => {
            const params = new ContractFunctionParameters().addUint256(42);

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "set",
                functionParameters: params,
            });

            expect(sentTx().functionParameters).toEqual(encoded("set", params));
        });

        it("sends raw function parameters as-is when no functionName is given", async () => {
            const raw = new Uint8Array([0x60, 0xfe, 0x47, 0xb1]);

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                rawFunctionParameters: raw,
            });

            expect(sentTx().functionParameters).toEqual(raw);
        });

        it("sets payableAmount when provided", async () => {
            const amount = new Hbar(2);

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "deposit",
                payableAmount: amount,
            });

            expect(sentTx().payableAmount?.toString()).toBe(amount.toString());
        });

        it("accepts a ContractId instance", async () => {
            const contractId = ContractId.fromString("0.0.12345");

            await service.executeContract({
                contractId,
                gas: 100_000,
                functionName: "ping",
            });

            expect(sentTx().contractId?.toString()).toBe("0.0.12345");
        });

        it("propagates validator errors before building a transaction", async () => {
            await expect(
                service.executeContract({
                    contractId: "0.0.12345",
                    gas: 100_000,
                } as unknown as Parameters<typeof service.executeContract>[0]),
            ).rejects.toThrow(/functionName or rawFunctionParameters/);

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe("scheduleExecuteContract", () => {
        it("schedules the built transaction with the schedule options and returns the scheduleId", async () => {
            const scheduleRun = vi
                .spyOn(TransactionExecutor.prototype, "scheduleRun")
                .mockResolvedValue({
                    scheduleId: ScheduleId.fromString("0.0.777"),
                } as never);

            const result = await service.scheduleExecuteContract(
                {
                    contractId: "0.0.12345",
                    gas: 100_000,
                    functionName: "set",
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "execute via multisig",
                },
            );

            const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
            expect(tx).toBeInstanceOf(ContractExecuteTransaction);
            expect(
                (tx as ContractExecuteTransaction).functionParameters,
            ).toEqual(encoded("set"));
            expect(scheduleOptions).toEqual({
                payerAccountId: "0.0.999",
                scheduleMemo: "execute via multisig",
            });
            expect(result.scheduleId.toString()).toBe("0.0.777");
        });
    });
});
