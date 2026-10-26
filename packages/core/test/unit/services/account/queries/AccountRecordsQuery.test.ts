import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountRecordsQuery as SdkAccountRecordsQuery,
    Query,
    type TransactionRecord,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/MockContext.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Its response is plain data, as TransactionRecord has no public constructor.

const records = [
    { transactionMemo: "first" },
    { transactionMemo: "second" },
] as unknown as TransactionRecord[];

describe("AccountRecordsQuery (via AccountService.getAccountRecords)", () => {
    let context: IHieroContext;
    let service: AccountService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = () => execute.mock.contexts[0] as SdkAccountRecordsQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(records);
        context = createMockContext();
        service = new AccountService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the SDK records for the requested account", async () => {
        const result = await service.getAccountRecords("0.0.1234");

        expect(result).toBe(records);
        expect(execute).toHaveBeenCalledWith(context.client);
        expect(sentQuery()).toBeInstanceOf(SdkAccountRecordsQuery);
        expect(sentQuery().accountId?.toString()).toBe("0.0.1234");
    });

    it("reports the query to transaction listeners", async () => {
        await service.getAccountRecords("0.0.1234");

        expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "AccountRecordsQuery",
                serviceName: "AccountService",
                methodName: "getAccountRecords",
            }),
        );
    });

    it.each([
        [undefined, "accountId is required."],
        ["", 'accountId "" is not a valid account ID'],
        ["abc", 'accountId "abc" is not a valid account ID'],
    ])(
        "rejects accountId %j with INPUT_INVALID before querying",
        async (accountId, message) => {
            await expect(
                service.getAccountRecords(accountId as unknown as string),
            ).rejects.toMatchObject({
                name: "HieroError",
                code: "INPUT_INVALID",
                context: "AccountService.getAccountRecords",
                message: expect.stringContaining(message),
            });
            expect(execute).not.toHaveBeenCalled();
        },
    );

    it("wraps network failures via normalizeError", async () => {
        execute.mockRejectedValueOnce(new Error("network down"));

        await expect(service.getAccountRecords("0.0.1234")).rejects.toThrow(
            /network down/,
        );
    });
});
