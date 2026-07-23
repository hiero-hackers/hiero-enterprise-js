import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    ContractExecuteTransaction,
    ContractFunctionParameters,
    ContractId,
    Hbar,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import {
    reattachMockChain,
    buildMockRecord,
} from "../../../../utils/sdk-mocks.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setContractId",
        "setGas",
        "setFunction",
        "setFunctionParameters",
        "setPayableAmount",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractExecuteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("ContractExecuteOperation (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new ContractService(context);
    });

    describe("executeContract", () => {
        it("invokes a named function with no parameters and resolves successfully", async () => {
            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
            });

            expect(result).toMatchObject({
                transactionId: expect.any(String),
                status: "SUCCESS",
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.setContractId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.setGas).toHaveBeenCalledWith(100_000);
            expect(tx.setFunction).toHaveBeenCalledWith("increment", undefined);
            expect(tx.setFunctionParameters).not.toHaveBeenCalled();
            expect(tx.setPayableAmount).not.toHaveBeenCalled();
            expect(mocks.response.getReceipt).toHaveBeenCalledWith(
                context.client,
            );
        });

        it("does not fetch the record unless withFunctionResult is set", async () => {
            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
            });

            expect(mocks.response.recordExecute).not.toHaveBeenCalled();
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
            mocks.response.recordExecute.mockResolvedValueOnce(
                buildMockRecord({
                    contractFunctionResult: {
                        bytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
                        gasUsed: { toNumber: () => 21_000 },
                        errorMessage: null,
                    },
                }),
            );

            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
                withFunctionResult: true,
            });

            expect(mocks.response.recordExecute).toHaveBeenCalledTimes(1);
            expect(result.functionResult).toEqual({
                returnDataHex: "0xdeadbeef",
                gasUsed: 21_000,
                errorMessage: null,
            });
        });

        it("surfaces the EVM revert message on functionResult.errorMessage", async () => {
            mocks.response.recordExecute.mockResolvedValueOnce(
                buildMockRecord({
                    contractFunctionResult: {
                        bytes: new Uint8Array([]),
                        gasUsed: { toNumber: () => 50_000 },
                        errorMessage: "execution reverted: not owner",
                    },
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
            mocks.response.recordExecute.mockResolvedValueOnce(
                buildMockRecord({ contractFunctionResult: null }),
            );

            const result = await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
                withFunctionResult: true,
            });

            expect(result.functionResult).toBeNull();
        });

        it("a failed opt-in record fetch throws the post-consensus error — the call landed, do not resubmit", async () => {
            mocks.response.recordExecute.mockRejectedValueOnce(
                new Error("network blip"),
            );

            const attempt = service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "increment",
                withFunctionResult: true,
            });

            await expect(attempt).rejects.toBeInstanceOf(HieroError);
            const error = await attempt.catch((e: HieroError) => e);
            expect(error.code).toBe(HieroErrorCodes.ResultMappingFailed);
            expect(error.transactionId).toBe("0.0.123@1234567890.000000000");
            expect(error.message).toContain("Do not resubmit");
        });

        it("forwards ABI-typed function parameters", async () => {
            const params = new ContractFunctionParameters().addUint256(42);

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "set",
                functionParameters: params,
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.setFunction).toHaveBeenCalledWith("set", params);
        });

        it("falls back to setFunctionParameters when only raw bytes are supplied", async () => {
            const raw = new Uint8Array([0x60, 0xfe, 0x47, 0xb1]);

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                rawFunctionParameters: raw,
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.setFunctionParameters).toHaveBeenCalledWith(raw);
            expect(tx.setFunction).not.toHaveBeenCalled();
        });

        it("forwards payableAmount when provided", async () => {
            const amount = new Hbar(2);

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "deposit",
                payableAmount: amount,
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.setPayableAmount).toHaveBeenCalledWith(amount);
        });

        it("accepts a ContractId instance", async () => {
            const contractId = ContractId.fromString("0.0.12345");

            await service.executeContract({
                contractId,
                gas: 100_000,
                functionName: "ping",
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.setContractId).toHaveBeenCalledWith(contractId);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const signerKey = PrivateKey.generateED25519();

            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "set",
                additionalSigners: [signerKey],
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(signerKey);
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.executeContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "set",
                transactionMemo: "ctx memo",
                transactionValidDuration: 120,
            });

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("ctx memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(120);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.executeContract({
                    contractId: "0.0.12345",
                    gas: 100_000,
                } as unknown as Parameters<typeof service.executeContract>[0]),
            ).rejects.toThrow(/functionName or rawFunctionParameters/);

            expect(
                vi.mocked(ContractExecuteTransaction),
            ).not.toHaveBeenCalled();
        });
    });

    describe("scheduleExecuteContract", () => {
        it("schedules a contract execution and returns the scheduleId", async () => {
            const result = await service.scheduleExecuteContract({
                contractId: "0.0.12345",
                gas: 100_000,
                functionName: "set",
            });

            expect(result.scheduleId.toString()).toBe("0.0.777");

            const tx = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("forwards schedule options to the scheduling transaction", async () => {
            await service.scheduleExecuteContract(
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

            expect(mocks.scheduleTx.setPayerAccountId).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "execute via multisig",
            );
        });
    });
});
