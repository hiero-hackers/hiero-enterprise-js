import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    NetworkVersionInfoQuery,
    Query,
    Status,
    TransactionId,
    TransactionReceiptQuery,
    TransactionRecordQuery,
    type NetworkVersionInfo,
    type TransactionReceipt,
    type TransactionRecord,
} from "@hiero-ledger/sdk";
import { NetworkService } from "../../../../src/services/network/index.js";
import { createMockContext } from "../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../src/context/index.js";

// Builds real SDK queries; only Query.execute, the network call, is stubbed.
// Responses are plain data built from real SDK values.

const receipt = { status: Status.Success } as unknown as TransactionReceipt;
const record = {
    receipt,
    transactionId: TransactionId.fromString("0.0.123@1700000000.000000000"),
} as unknown as TransactionRecord;
const versionInfo = {
    protobufVersion: { major: 0, minor: 50, patch: 0 },
    servicesVersion: { major: 0, minor: 50, patch: 1 },
} as unknown as NetworkVersionInfo;

describe("NetworkService [facade contract]", () => {
    let context: IHieroContext;
    let service: NetworkService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = <T>() => execute.mock.contexts[0] as T;

    beforeEach(() => {
        execute = vi.spyOn(Query.prototype, "execute");
        context = createMockContext();
        service = new NetworkService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getTransactionReceipt", () => {
        beforeEach(() => {
            execute.mockResolvedValue(receipt);
        });

        it("sends a receipt query for the parsed transaction ID and returns the receipt", async () => {
            const result = await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(execute).toHaveBeenCalledTimes(1);
            const query = sentQuery<TransactionReceiptQuery>();
            expect(query).toBeInstanceOf(TransactionReceiptQuery);
            expect(query.transactionId?.toString()).toBe(
                "0.0.123@1700000000.000000000",
            );
            expect(result).toBe(receipt);
        });

        it("accepts a TransactionId instance", async () => {
            const txId = TransactionId.fromString(
                "0.0.456@1700000001.000000000",
            );

            await service.getTransactionReceipt({ transactionId: txId });

            expect(
                sentQuery<TransactionReceiptQuery>().transactionId?.toString(),
            ).toBe("0.0.456@1700000001.000000000");
        });

        it("sets includeChildren and includeDuplicates when provided", async () => {
            await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
                includeChildren: true,
                includeDuplicates: true,
            });

            const query = sentQuery<TransactionReceiptQuery>();
            expect(query.includeChildren).toBe(true);
            expect(query.includeDuplicates).toBe(true);
        });

        it("leaves includeChildren and includeDuplicates off when omitted", async () => {
            await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
            });

            const query = sentQuery<TransactionReceiptQuery>();
            expect(query.includeChildren).toBe(false);
            expect(query.includeDuplicates).toBe(false);
        });

        it("emits lifecycle events with the receipt query type metadata", async () => {
            await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TransactionReceiptQuery",
                    serviceName: "NetworkService",
                    methodName: "getTransactionReceipt",
                    transactionId: "0.0.123@1700000000.000000000",
                }),
            );
        });
    });

    describe("getTransactionRecord", () => {
        beforeEach(() => {
            execute.mockResolvedValue(record);
        });

        it("sends a record query for the parsed transaction ID and returns the record", async () => {
            const result = await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(execute).toHaveBeenCalledTimes(1);
            const query = sentQuery<TransactionRecordQuery>();
            expect(query).toBeInstanceOf(TransactionRecordQuery);
            expect(query.transactionId?.toString()).toBe(
                "0.0.123@1700000000.000000000",
            );
            expect(result).toBe(record);
        });

        it("sets includeChildren when provided", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
                includeChildren: true,
            });

            const query = sentQuery<TransactionRecordQuery>();
            expect(query.includeChildren).toBe(true);
            expect(query.includeDuplicates).toBe(false);
        });

        it("sets includeDuplicates when provided", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
                includeDuplicates: true,
            });

            const query = sentQuery<TransactionRecordQuery>();
            expect(query.includeDuplicates).toBe(true);
            expect(query.includeChildren).toBe(false);
        });

        it("leaves includeChildren and includeDuplicates off when omitted", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
            });

            const query = sentQuery<TransactionRecordQuery>();
            expect(query.includeChildren).toBe(false);
            expect(query.includeDuplicates).toBe(false);
        });

        it("accepts a TransactionId instance", async () => {
            const txId = TransactionId.fromString(
                "0.0.456@1700000001.000000000",
            );

            await service.getTransactionRecord({ transactionId: txId });

            expect(
                sentQuery<TransactionRecordQuery>().transactionId?.toString(),
            ).toBe("0.0.456@1700000001.000000000");
        });

        it("emits lifecycle events with the record query type metadata", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TransactionRecordQuery",
                    methodName: "getTransactionRecord",
                }),
            );
        });
    });

    describe("getNetworkVersionInfo", () => {
        beforeEach(() => {
            execute.mockResolvedValue(versionInfo);
        });

        it("sends a version info query and returns the version info", async () => {
            const result = await service.getNetworkVersionInfo();

            expect(execute).toHaveBeenCalledTimes(1);
            expect(sentQuery<NetworkVersionInfoQuery>()).toBeInstanceOf(
                NetworkVersionInfoQuery,
            );
            expect(result).toBe(versionInfo);
        });

        it("emits lifecycle events with the version query type metadata", async () => {
            await service.getNetworkVersionInfo();

            expect(context.emitBeforeTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "NetworkVersionInfoQuery",
                    serviceName: "NetworkService",
                    methodName: "getNetworkVersionInfo",
                }),
            );
            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "NetworkVersionInfoQuery",
                    status: "SUCCESS",
                }),
            );
        });
    });
});
