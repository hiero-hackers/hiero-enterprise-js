import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { SmartContractClient } from "../src/services/smart-contract-client.js";
import {
    ContractCreateTransaction,
    ContractExecuteTransaction,
    ContractCallQuery,
    ContractDeleteTransaction,
    ContractCreateFlow,
    ContractFunctionParameters,
} from "@hashgraph/sdk";

vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    const mockTx = {
        setBytecodeFileId: vi.fn().mockReturnThis(),
        setBytecode: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setConstructorParameters: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setContractMemo: vi.fn().mockReturnThis(),

        setContractId: vi.fn().mockReturnThis(),
        setFunction: vi.fn().mockReturnThis(),
        setPayableAmount: vi.fn().mockReturnThis(),
        setTransferAccountId: vi.fn().mockReturnThis(),
        setTransferContractId: vi.fn().mockReturnThis(),

        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: { toString: () => "0.0.123@1234567890" },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    contractId: { toString: () => "0.0.999" },
                }),
                getRecord: vi.fn().mockResolvedValue({
                    contractFunctionResult: {
                        gasUsed: { toNumber: () => 100 },
                        bytes: new Uint8Array([1, 2, 3]),
                        getUint256: () => 42,
                        getString: () => "hello",
                        getBool: () => true,
                    },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                contractId: { toString: () => "0.0.999" },
            }),
            getRecord: vi.fn().mockResolvedValue({
                contractFunctionResult: {
                    gasUsed: { toNumber: () => 100 },
                    bytes: new Uint8Array([1, 2, 3]),
                    getUint256: () => 42,
                    getString: () => "hello",
                    getBool: () => true,
                },
            }),
        }),
    };

    const mockQuery = {
        setContractId: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setFunction: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            getUint256: () => 42,
            getString: () => "hello",
            getBool: () => true,
        }),
    };

    return {
        ...actual,
        ContractCreateFlow: vi.fn(() => ({ ...mockTx })),
        ContractCreateTransaction: vi.fn(() => ({ ...mockTx })),
        ContractExecuteTransaction: vi.fn(() => ({ ...mockTx })),
        ContractDeleteTransaction: vi.fn(() => ({ ...mockTx })),
        ContractCallQuery: vi.fn(() => ({ ...mockQuery })),
        ContractFunctionParameters: vi.fn(() => ({
            addUint256: vi.fn().mockReturnThis(),
            addString: vi.fn().mockReturnThis(),
            addAddress: vi.fn().mockReturnThis(),
            addBool: vi.fn().mockReturnThis(),
        })),
    };
});

describe("SmartContractClient", () => {
    let context: HieroContext;
    let client: SmartContractClient;
    const dummyKey =
        "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey: dummyKey,
        });
        client = new SmartContractClient(context);
    });

    describe("createContract", () => {
        it("creates a contract from a file ID", async () => {
            const contractId = await client.createContract("0.0.888", 100000);

            expect(contractId).toBe("0.0.999");

            const txMock = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setBytecodeFileId).toHaveBeenCalledWith(
                expect.any(Object),
            );
            expect(txMock.setGas).toHaveBeenCalledWith(100000);
        });
    });

    describe("createContractFromBytecode", () => {
        it("creates a contract directly from bytecode array", async () => {
            const bytecode = new Uint8Array([1, 2, 3, 4]);
            const contractId = await client.createContractFromBytecode(
                bytecode,
                200000,
            );

            expect(contractId).toBe("0.0.999");

            const txMock = vi.mocked(ContractCreateFlow).mock.results[0].value;
            expect(txMock.setBytecode).toHaveBeenCalledWith(bytecode);
            expect(txMock.setGas).toHaveBeenCalledWith(200000);
        });
    });

    describe("callContractFunction", () => {
        it("calls a contract function (mutation)", async () => {
            const params = new ContractFunctionParameters().addUint256(1);
            const result = await client.callContractFunction(
                "0.0.999",
                "setValue",
                500000,
                params,
            );

            expect(result).toBeDefined();

            const txMock = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            expect(txMock.setContractId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setFunction).toHaveBeenCalledWith("setValue", params);
            expect(txMock.setGas).toHaveBeenCalledWith(500000);
        });

        it("calls a contract function with payable hbars", async () => {
            await client.callContractFunction(
                "0.0.999",
                "payMe",
                100000,
                undefined,
                50,
            );

            const txMock = vi.mocked(ContractExecuteTransaction).mock.results[0]
                .value;
            // The precise parameter depends on how Hbar mapping works, but we assert setPayableAmount was called
            expect(txMock.setPayableAmount).toHaveBeenCalled();
        });
    });

    describe("deleteContract", () => {
        it("deletes a contract via account transfer", async () => {
            await client.deleteContract("0.0.999", "0.0.2");

            const txMock = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.setContractId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setTransferAccountId).toHaveBeenCalledWith("0.0.2");
        });
    });
});
