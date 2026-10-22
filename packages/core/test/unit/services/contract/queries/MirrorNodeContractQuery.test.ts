import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    ContractFunctionParameters,
    ContractId,
    MirrorNodeContractCallQuery,
    MirrorNodeContractEstimateQuery,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { HieroErrorCodes } from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK queries; only execute, the mirror node call, is stubbed.

/** The call data the SDK encodes for `name(params)`. */
function encoded(name: string, params?: ContractFunctionParameters) {
    return new MirrorNodeContractCallQuery().setFunction(
        name,
        params ?? new ContractFunctionParameters(),
    ).callData;
}

describe("MirrorNodeContractQuery (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;
    let callExecute: ReturnType<typeof vi.spyOn>;
    let estimateExecute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the mirror node. */
    const sentCall = () =>
        callExecute.mock.contexts[0] as MirrorNodeContractCallQuery;

    beforeEach(() => {
        callExecute = vi
            .spyOn(MirrorNodeContractCallQuery.prototype, "execute")
            .mockResolvedValue("0x2a");
        estimateExecute = vi
            .spyOn(MirrorNodeContractEstimateQuery.prototype, "execute")
            .mockResolvedValue(25_000);
        context = createMockContext();
        service = new ContractService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("simulateContractCall", () => {
        it("simulates a named function and returns the hex result", async () => {
            const result = await service.simulateContractCall({
                contractId: "0.0.12345",
                functionName: "get",
            });

            expect(result).toBe("0x2a");
            expect(callExecute).toHaveBeenCalledWith(context.client);
            const query = sentCall();
            expect(query.contractId?.toString()).toBe("0.0.12345");
            expect(query.callData).toEqual(encoded("get"));
            expect(query.JSONPayload).toMatchObject({ estimate: false });
        });

        it("encodes ABI-typed functionParameters", async () => {
            const params = new ContractFunctionParameters().addUint256(7);

            await service.simulateContractCall({
                contractId: "0.0.12345",
                functionName: "set",
                functionParameters: params,
            });

            expect(sentCall().callData).toEqual(encoded("set", params));
        });

        it("sends rawFunctionParameters as-is", async () => {
            const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

            await service.simulateContractCall({
                contractId: ContractId.fromString("0.0.12345"),
                rawFunctionParameters: raw,
            });

            expect(sentCall().callData).toEqual(raw);
        });

        it("converts the optional fields to SDK types", async () => {
            await service.simulateContractCall({
                contractId: "0.0.12345",
                functionName: "get",
                sender: "0.0.999",
                value: 5,
                gasLimit: 50_000,
                gasPrice: 100,
            });

            const query = sentCall();
            expect(query.sender?.toString()).toBe("0.0.999");
            expect(query.value?.toNumber()).toBe(5);
            expect(query.gasLimit?.toNumber()).toBe(50_000);
            expect(query.gasPrice?.toNumber()).toBe(100);
        });

        it("uses senderEvmAddress as msg.sender", async () => {
            const evmAddress = "0x1234567890abcdef1234567890abcdef12345678";

            await service.simulateContractCall({
                contractId: "0.0.12345",
                functionName: "get",
                senderEvmAddress: evmAddress,
            });

            expect(sentCall().JSONPayload).toMatchObject({ from: evmAddress });
        });

        it("rejects when neither functionName nor rawFunctionParameters is supplied", async () => {
            await expect(
                service.simulateContractCall({ contractId: "0.0.12345" }),
            ).rejects.toThrow(
                /requires either functionName or rawFunctionParameters/,
            );

            expect(callExecute).not.toHaveBeenCalled();
        });

        it("rejects when both functionName and rawFunctionParameters are supplied", async () => {
            await expect(
                service.simulateContractCall({
                    contractId: "0.0.12345",
                    functionName: "get",
                    rawFunctionParameters: new Uint8Array([0x01]),
                }),
            ).rejects.toThrow(
                /accepts functionName or rawFunctionParameters, not both/,
            );

            expect(callExecute).not.toHaveBeenCalled();
        });

        it("rejects when both sender and senderEvmAddress are supplied", async () => {
            await expect(
                service.simulateContractCall({
                    contractId: "0.0.12345",
                    functionName: "get",
                    sender: AccountId.fromString("0.0.999"),
                    senderEvmAddress:
                        "0x1234567890abcdef1234567890abcdef12345678",
                }),
            ).rejects.toThrow(/accepts sender or senderEvmAddress, not both/);

            expect(callExecute).not.toHaveBeenCalled();
        });

        it("rejects call data over 131072 bytes", async () => {
            await expect(
                service.simulateContractCall({
                    contractId: "0.0.12345",
                    rawFunctionParameters: new Uint8Array(131_073),
                }),
            ).rejects.toMatchObject({
                code: HieroErrorCodes.InputInvalid,
                message: expect.stringMatching(/exceeds 131072 bytes/),
            });

            expect(callExecute).not.toHaveBeenCalled();
        });

        it("accepts call data of exactly 131072 bytes", async () => {
            await service.simulateContractCall({
                contractId: "0.0.12345",
                rawFunctionParameters: new Uint8Array(131_072),
            });

            expect(callExecute).toHaveBeenCalledTimes(1);
        });

        it("wraps mirror node failures via normalizeError", async () => {
            callExecute.mockRejectedValueOnce(new Error("HTTP 400"));

            await expect(
                service.simulateContractCall({
                    contractId: "0.0.12345",
                    functionName: "get",
                }),
            ).rejects.toMatchObject({
                code: HieroErrorCodes.SdkError,
                message: "HTTP 400",
            });
        });

        it("does not emit listener events", async () => {
            await service.simulateContractCall({
                contractId: "0.0.12345",
                functionName: "get",
            });

            expect(context.emitBeforeTransaction).not.toHaveBeenCalled();
            expect(context.emitAfterTransaction).not.toHaveBeenCalled();
        });
    });

    describe("estimateContractGas", () => {
        it("estimates gas for a named function", async () => {
            const gas = await service.estimateContractGas({
                contractId: "0.0.12345",
                functionName: "set",
                functionParameters: new ContractFunctionParameters().addUint256(
                    7,
                ),
                sender: "0.0.999",
            });

            expect(gas).toBe(25_000);
            expect(estimateExecute).toHaveBeenCalledWith(context.client);
            const query = estimateExecute.mock
                .contexts[0] as MirrorNodeContractEstimateQuery;
            expect(query.sender?.toString()).toBe("0.0.999");
            expect(query.JSONPayload).toMatchObject({ estimate: true });
        });

        it("rejects when no call target is supplied", async () => {
            await expect(
                service.estimateContractGas({ contractId: "0.0.12345" }),
            ).rejects.toMatchObject({ code: HieroErrorCodes.InputInvalid });

            expect(estimateExecute).not.toHaveBeenCalled();
        });

        it("wraps mirror node failures via normalizeError", async () => {
            estimateExecute.mockRejectedValueOnce(new Error("HTTP 400"));

            await expect(
                service.estimateContractGas({
                    contractId: "0.0.12345",
                    functionName: "get",
                }),
            ).rejects.toMatchObject({ code: HieroErrorCodes.SdkError });
        });
    });
});
