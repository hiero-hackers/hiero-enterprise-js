import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    AddressBookQuery,
    Client,
    FeeEstimateMode,
    FeeEstimateQuery,
    FeeEstimateResponse,
    Hbar,
    NetworkVersionInfoQuery,
    PrivateKey,
    Query,
    Status,
    TransactionId,
    TransactionReceiptQuery,
    TransactionRecordQuery,
    TransferTransaction,
    type NetworkVersionInfo,
    type NodeAddressBook,
    type Transaction,
    type TransactionReceipt,
    type TransactionRecord,
} from "@hiero-ledger/sdk";
import {
    NetworkService,
    type EstimateFeeOptions,
} from "../../../../src/services/network/index.js";
import { HieroErrorCodes } from "../../../../src/errors/index.js";
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

/** Malformed string IDs the SDK parser rejects with a raw TypeError/Error. */
const malformedIds = [
    "abc",
    "",
    "0.0.123",
    "0.0.123@1700000000",
    "not-an-account@1700000000.000000000",
];

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

        it.each(malformedIds)(
            "rejects malformed transactionId %j with INPUT_INVALID before querying",
            async (transactionId) => {
                await expect(
                    service.getTransactionReceipt({ transactionId }),
                ).rejects.toMatchObject({
                    name: "HieroError",
                    code: "INPUT_INVALID",
                    context: "NetworkService.getTransactionReceipt",
                    message: expect.stringContaining(
                        `transactionId "${transactionId}" is not a valid transaction ID`,
                    ),
                });
                expect(execute).not.toHaveBeenCalled();
                expect(context.emitBeforeTransaction).not.toHaveBeenCalled();
            },
        );

        it("rejects a missing transactionId with INPUT_INVALID before querying", async () => {
            await expect(
                service.getTransactionReceipt({
                    transactionId: undefined as unknown as string,
                }),
            ).rejects.toMatchObject({
                code: "INPUT_INVALID",
                context: "NetworkService.getTransactionReceipt",
                message: "transactionId is required.",
            });
            expect(execute).not.toHaveBeenCalled();
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

        it.each(malformedIds)(
            "rejects malformed transactionId %j with INPUT_INVALID before querying",
            async (transactionId) => {
                await expect(
                    service.getTransactionRecord({ transactionId }),
                ).rejects.toMatchObject({
                    name: "HieroError",
                    code: "INPUT_INVALID",
                    context: "NetworkService.getTransactionRecord",
                    message: expect.stringContaining(
                        `transactionId "${transactionId}" is not a valid transaction ID`,
                    ),
                });
                expect(execute).not.toHaveBeenCalled();
                expect(context.emitBeforeTransaction).not.toHaveBeenCalled();
            },
        );

        it("rejects a missing transactionId with INPUT_INVALID before querying", async () => {
            await expect(
                service.getTransactionRecord({
                    transactionId: undefined as unknown as string,
                }),
            ).rejects.toMatchObject({
                code: "INPUT_INVALID",
                context: "NetworkService.getTransactionRecord",
                message: "transactionId is required.",
            });
            expect(execute).not.toHaveBeenCalled();
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

    describe("getAddressBook", () => {
        const book = { nodeAddresses: [] } as unknown as NodeAddressBook;
        let stream: ReturnType<typeof vi.spyOn>;

        /** The address book query sent to the mirror node. */
        const sentBookQuery = () => stream.mock.contexts[0] as AddressBookQuery;

        beforeEach(() => {
            // A mirror-node stream: AddressBookQuery overrides execute.
            stream = vi
                .spyOn(AddressBookQuery.prototype, "execute")
                .mockResolvedValue(book);
        });

        it("reads file 0.0.102 by default", async () => {
            const result = await service.getAddressBook();

            expect(result).toBe(book);
            expect(stream).toHaveBeenCalledWith(context.client);
            expect(sentBookQuery().fileId?.toString()).toBe("0.0.102");
            expect(sentBookQuery().limit).toBeNull();
        });

        it("passes the file ID and limit", async () => {
            await service.getAddressBook({ fileId: "0.0.101", limit: 3 });

            expect(sentBookQuery().fileId?.toString()).toBe("0.0.101");
            expect(sentBookQuery().limit).toBe(3);
        });

        it.each([
            [{ limit: 0 }, "limit must be an integer >= 1, got 0."],
            [{ limit: 1.5 }, "limit must be an integer >= 1, got 1.5."],
            [{ fileId: "abc" }, 'got "abc"'],
            [{ fileId: "0.0.150" }, 'got "0.0.150"'],
        ])(
            "rejects %j with INPUT_INVALID before querying",
            async (options, message) => {
                await expect(
                    service.getAddressBook(options),
                ).rejects.toMatchObject({
                    code: "INPUT_INVALID",
                    context: "NetworkService.getAddressBook",
                    message: expect.stringContaining(message),
                });
                expect(stream).not.toHaveBeenCalled();
            },
        );

        it("normalizes a stream failure", async () => {
            stream.mockRejectedValueOnce(
                new Error("failed to query address book"),
            );

            await expect(service.getAddressBook()).rejects.toMatchObject({
                name: "HieroError",
                context: "NetworkService.getAddressBook",
            });
        });
    });

    describe("estimateFee", () => {
        const response = FeeEstimateResponse._fromJSON({
            high_volume_multiplier: 1,
            network: { multiplier: 9, subtotal: 900000 },
            node: {
                base: 100000,
                extras: [
                    {
                        name: "SIGNATURES",
                        included: 1,
                        count: 2,
                        charged: 1,
                        fee_per_unit: 50000,
                        subtotal: 50000,
                    },
                ],
            },
            service: { base: 0, extras: [] },
            total: 1050000,
        });
        let estimate: ReturnType<typeof vi.spyOn>;

        /** The fee estimate query sent to the mirror node. */
        const sentFeeQuery = () =>
            estimate.mock.contexts[0] as FeeEstimateQuery;

        const transfer = () =>
            new TransferTransaction()
                .addHbarTransfer("0.0.2", Hbar.fromTinybars(-1))
                .addHbarTransfer("0.0.3", Hbar.fromTinybars(1))
                .setNodeAccountIds([AccountId.fromString("0.0.3")])
                .setTransactionId(TransactionId.generate("0.0.1234"))
                .freeze();

        beforeEach(() => {
            // A mirror-node REST call: FeeEstimateQuery is not a gRPC Query.
            estimate = vi
                .spyOn(FeeEstimateQuery.prototype, "execute")
                .mockResolvedValue(response);
        });

        it("returns the fee components and total as plain data", async () => {
            const result = await service.estimateFee(transfer());

            expect(estimate).toHaveBeenCalledWith(context.client);
            expect(result).toEqual({
                network: { multiplier: 9, subtotal: "900000" },
                node: {
                    base: "100000",
                    extras: [
                        {
                            name: "SIGNATURES",
                            included: 1,
                            count: 2,
                            charged: 1,
                            feePerUnit: "50000",
                            subtotal: "50000",
                        },
                    ],
                },
                service: { base: "0", extras: [] },
                highVolumeMultiplier: 1,
                total: "1050000",
            });
        });

        it("uses the SDK defaults when no options are given", async () => {
            await service.estimateFee(transfer());

            expect(sentFeeQuery().getMode()).toBe(FeeEstimateMode.INTRINSIC);
            expect(sentFeeQuery().getHighVolumeThrottle()).toBe(0);
        });

        it("passes the mode and high-volume throttle", async () => {
            await service.estimateFee(transfer(), {
                mode: FeeEstimateMode.STATE,
                highVolumeThrottle: 10000,
            });

            expect(sentFeeQuery().getMode()).toBe(FeeEstimateMode.STATE);
            expect(sentFeeQuery().getHighVolumeThrottle()).toBe(10000);
        });

        it("rejects an unfrozen transaction with INPUT_INVALID", async () => {
            const tx = new TransferTransaction()
                .addHbarTransfer("0.0.2", Hbar.fromTinybars(-1))
                .addHbarTransfer("0.0.3", Hbar.fromTinybars(1));

            await expect(service.estimateFee(tx)).rejects.toMatchObject({
                code: HieroErrorCodes.InputInvalid,
                message: expect.stringMatching(/must be frozen/),
            });

            expect(estimate).not.toHaveBeenCalled();
            expect(tx.isFrozen()).toBe(false);
        });

        it("keeps the payer and signatures when the query freezes the copy", async () => {
            const key = PrivateKey.generateED25519();
            const tx = transfer();
            await tx.sign(key);

            await service.estimateFee(tx);

            // FeeEstimateQuery freezes its transaction again before sending.
            const copy = sentFeeQuery().transaction!;
            const client = Client.forNetwork({
                "127.0.0.1:50211": "0.0.3",
            }).setOperator("0.0.2", PrivateKey.generateED25519());
            copy.freezeWith(client);
            client.close();

            expect(copy).not.toBe(tx);
            expect(Buffer.from(copy.toBytes())).toEqual(
                Buffer.from(tx.toBytes()),
            );
        });

        it("does not notify listeners", async () => {
            await service.estimateFee(transfer());

            expect(context.emitBeforeTransaction).not.toHaveBeenCalled();
            expect(context.emitAfterTransaction).not.toHaveBeenCalled();
        });

        it.each([
            [{ mode: 2 }, "mode must be FeeEstimateMode.STATE (0)"],
            [{ highVolumeThrottle: -1 }, "got -1."],
            [{ highVolumeThrottle: 1.5 }, "got 1.5."],
            [{ highVolumeThrottle: 10001 }, "got 10001."],
        ])(
            "rejects %j with INPUT_INVALID before estimating",
            async (options, message) => {
                await expect(
                    service.estimateFee(
                        transfer(),
                        options as EstimateFeeOptions,
                    ),
                ).rejects.toMatchObject({
                    code: "INPUT_INVALID",
                    context: "NetworkService.estimateFee",
                    message: expect.stringContaining(message),
                });
                expect(estimate).not.toHaveBeenCalled();
            },
        );

        it("rejects a missing transaction with INPUT_INVALID", async () => {
            await expect(
                service.estimateFee(undefined as unknown as Transaction),
            ).rejects.toMatchObject({
                code: "INPUT_INVALID",
                context: "NetworkService.estimateFee",
            });
            expect(estimate).not.toHaveBeenCalled();
        });

        it("normalizes a mirror node failure", async () => {
            estimate.mockRejectedValueOnce(
                new Error("Failed to estimate fees: HTTP 400: Bad Request"),
            );

            await expect(service.estimateFee(transfer())).rejects.toMatchObject(
                {
                    name: "HieroError",
                    code: "SDK_ERROR",
                    context: "NetworkService.estimateFee",
                },
            );
        });
    });
});
