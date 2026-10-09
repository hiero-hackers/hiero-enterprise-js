import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ContractId,
    ContractInfoQuery as SdkContractInfoQuery,
    Query,
    type ContractInfo,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data, as ContractInfo has no public constructor.

const info = {
    contractId: ContractId.fromString("0.0.12345"),
    contractMemo: "demo",
    isDeleted: false,
} as unknown as ContractInfo;

describe("ContractInfoQuery (via ContractService.getContractInfo)", () => {
    let context: IHieroContext;
    let service: ContractService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = () => execute.mock.contexts[0] as SdkContractInfoQuery;

    beforeEach(() => {
        execute = vi.spyOn(Query.prototype, "execute").mockResolvedValue(info);
        context = createMockContext();
        service = new ContractService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the SDK ContractInfo for the requested contract", async () => {
        const result = await service.getContractInfo("0.0.12345");

        expect(result).toBe(info);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(context.client);
        expect(sentQuery()).toBeInstanceOf(SdkContractInfoQuery);
        expect(sentQuery().contractId?.toString()).toBe("0.0.12345");
    });

    it("wraps network failures via normalizeError", async () => {
        execute.mockRejectedValueOnce(new Error("network down"));

        await expect(service.getContractInfo("0.0.12345")).rejects.toThrow(
            /network down/,
        );
    });
});
