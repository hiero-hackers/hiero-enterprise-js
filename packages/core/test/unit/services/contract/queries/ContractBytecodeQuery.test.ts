import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ContractByteCodeQuery as SdkContractByteCodeQuery,
    Query,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.

const bytecode = new Uint8Array([0x60, 0x80, 0x60, 0x40, 0x52]);

describe("ContractBytecodeQuery (via ContractService.getContractBytecode)", () => {
    let context: IHieroContext;
    let service: ContractService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = () =>
        execute.mock.contexts[0] as SdkContractByteCodeQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(bytecode);
        context = createMockContext();
        service = new ContractService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the runtime bytecode for the requested contract", async () => {
        const result = await service.getContractBytecode("0.0.12345");

        expect(result).toBe(bytecode);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(context.client);
        expect(sentQuery()).toBeInstanceOf(SdkContractByteCodeQuery);
        expect(sentQuery().contractId?.toString()).toBe("0.0.12345");
    });

    it("wraps network failures via normalizeError", async () => {
        execute.mockRejectedValueOnce(new Error("network down"));

        await expect(service.getContractBytecode("0.0.12345")).rejects.toThrow(
            /network down/,
        );
    });
});
