import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ContractCallQuery as SdkContractCallQuery,
    ContractFunctionParameters,
    Long,
    Query,
    type ContractFunctionResult,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data built from real SDK values.

const result = {
    gasUsed: Long.fromNumber(1_234),
    bytes: new Uint8Array([0x00]),
} as unknown as ContractFunctionResult;

/** The function call bytes the SDK encodes for `name(params)`. */
function encoded(name: string, params?: ContractFunctionParameters) {
    return new SdkContractCallQuery().setFunction(name, params)
        .functionParameters;
}

describe("ContractCallQuery (via ContractService.callContract)", () => {
    let context: IHieroContext;
    let service: ContractService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = () => execute.mock.contexts[0] as SdkContractCallQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(result);
        context = createMockContext();
        service = new ContractService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls a named function and returns the SDK result", async () => {
        const returned = await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "get",
        });

        expect(returned).toBe(result);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(context.client);
        const query = sentQuery();
        expect(query).toBeInstanceOf(SdkContractCallQuery);
        expect(query.contractId?.toString()).toBe("0.0.12345");
        expect(query.gas?.toNumber()).toBe(50_000);
        expect(query.functionParameters).toEqual(encoded("get"));
    });

    it("encodes ABI-typed functionParameters when supplied", async () => {
        const params = new ContractFunctionParameters().addUint256(7);

        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "set",
            functionParameters: params,
        });

        expect(sentQuery().functionParameters).toEqual(encoded("set", params));
    });

    it("sends rawFunctionParameters as-is when supplied", async () => {
        const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            rawFunctionParameters: raw,
        });

        expect(sentQuery().functionParameters).toEqual(raw);
    });

    it("sets every optional field when supplied", async () => {
        // The SDK query exposes no maxResultSize getter.
        const setMaxResultSize = vi.spyOn(
            SdkContractCallQuery.prototype,
            "setMaxResultSize",
        );

        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "get",
            senderAccountId: "0.0.999",
            maxResultSize: 8_192,
        });

        expect(sentQuery().senderAccountId?.toString()).toBe("0.0.999");
        expect(setMaxResultSize).toHaveBeenCalledWith(8_192);
    });

    it("rejects when neither functionName nor rawFunctionParameters is supplied", async () => {
        await expect(
            service.callContract({
                contractId: "0.0.12345",
                gas: 50_000,
            }),
        ).rejects.toThrow(
            /requires either functionName or rawFunctionParameters/,
        );

        expect(execute).not.toHaveBeenCalled();
    });

    it("rejects when both functionName and rawFunctionParameters are supplied", async () => {
        await expect(
            service.callContract({
                contractId: "0.0.12345",
                gas: 50_000,
                functionName: "get",
                rawFunctionParameters: new Uint8Array([0x01]),
            }),
        ).rejects.toThrow(
            /accepts functionName or rawFunctionParameters, not both/,
        );

        expect(execute).not.toHaveBeenCalled();
    });

    it("wraps network failures via normalizeError", async () => {
        execute.mockRejectedValueOnce(new Error("network down"));

        await expect(
            service.callContract({
                contractId: "0.0.12345",
                gas: 50_000,
                functionName: "get",
            }),
        ).rejects.toThrow(/network down/);
    });
});
