import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    AccountInfoQuery,
    AccountRecordsQuery,
    AddressBookQuery,
    ContractByteCodeQuery,
    ContractCreateFlow,
    ContractId,
    FeeEstimateQuery,
    FileContentsQuery,
    FileId,
    FileInfoQuery,
    Long,
    MirrorNodeAccountBalanceQuery,
    MirrorNodeContractCallQuery,
    MirrorNodeContractEstimateQuery,
    MirrorNodeTokenBalanceQuery,
    NftId,
    PrecheckStatusError,
    Query,
    ScheduleId,
    ScheduleInfoQuery,
    Status,
    Timestamp,
    TokenId,
    TokenInfoQuery,
    TokenNftInfoQuery,
    TokenRejectFlow,
    TopicId,
    TopicInfoQuery,
    TopicMessageQuery,
    Transaction,
    TransactionId,
    TransactionReceiptQuery,
} from "@hiero-ledger/sdk";
import { HieroContext } from "../../../src/context/index.js";
import { HieroError } from "../../../src/errors/index.js";
import type { TransactionEvent } from "../../../src/listeners/index.js";
import {
    METHOD_ENTRIES,
    MISSING_ID,
    PRIVATE_METHODS,
    SERVICE_CLASSES,
    SERVICE_METHODS,
    UNKNOWN_KEY,
    createServices,
    isNone,
    rejectionOf,
    rootCause,
    type CallEnv,
    type MethodEntry,
    type MethodEvents,
    type Services,
} from "../../utils/service-methods.js";

// Every public service method, driven from the table in
// test/utils/service-methods.ts. A real context and real SDK objects; only
// the calls that would reach a node or the mirror node are faked.

const OPERATOR_ID = "0.0.2";
const TX_ID = `${OPERATOR_ID}@1700000000.000000000`;

const receipt = {
    status: Status.Success,
    accountId: AccountId.fromString(MISSING_ID),
    contractId: ContractId.fromString(MISSING_ID),
    fileId: FileId.fromString(MISSING_ID),
    scheduleId: ScheduleId.fromString(MISSING_ID),
    scheduledTransactionId: null,
    tokenId: TokenId.fromString(MISSING_ID),
    topicId: TopicId.fromString(MISSING_ID),
    topicSequenceNumber: Long.ONE,
    topicRunningHash: new Uint8Array(),
    totalSupply: Long.ONE,
    serials: [],
    children: [],
};

const record = {
    prngNumber: 1,
    prngBytes: null,
    contractFunctionResult: null,
};

/** A transaction response whose receipt and record are canned. */
const response = {
    transactionId: TransactionId.fromString(TX_ID),
    getReceipt: () => Promise.resolve(receipt),
    getReceiptQuery: () => ({
        setIncludeChildren() {
            return this;
        },
        execute: () => Promise.resolve(receipt),
    }),
    getRecordQuery: () => ({ execute: () => Promise.resolve(record) }),
};

/** The answer a node gives each consensus query. */
function queryResult(query: unknown): unknown {
    if (query instanceof AccountInfoQuery) {
        return { key: UNKNOWN_KEY.publicKey };
    }

    if (query instanceof AccountRecordsQuery) return [];

    if (
        query instanceof ContractByteCodeQuery ||
        query instanceof FileContentsQuery
    ) {
        return new Uint8Array();
    }

    if (query instanceof TransactionReceiptQuery) return receipt;

    if (query instanceof FileInfoQuery) {
        return { fileId: FileId.fromString(MISSING_ID), size: Long.ONE };
    }

    if (query instanceof ScheduleInfoQuery) {
        return {
            scheduleId: ScheduleId.fromString(MISSING_ID),
            executed: null,
            deleted: null,
        };
    }

    if (query instanceof TokenInfoQuery) {
        return { tokenId: TokenId.fromString(MISSING_ID), totalSupply: 0 };
    }

    if (query instanceof TokenNftInfoQuery) {
        return [
            {
                nftId: NftId.fromString(`${MISSING_ID}/1`),
                accountId: AccountId.fromString(OPERATOR_ID),
                creationTime: Timestamp.fromDate(new Date(0)),
            },
        ];
    }

    if (query instanceof TopicInfoQuery) {
        return {
            topicId: TopicId.fromString(MISSING_ID),
            sequenceNumber: Long.ZERO,
        };
    }

    // ContractCallQuery, ContractInfoQuery, NetworkVersionInfoQuery,
    // TransactionRecordQuery: core hands the SDK object back unmapped.
    return {};
}

/** What a node answers when it rejects a transaction or query. */
const networkRejection = () =>
    new PrecheckStatusError({
        status: Status.InvalidSignature,
        transactionId: TransactionId.fromString(TX_ID),
        nodeId: AccountId.fromString("0.0.3"),
        contractFunctionResult: null,
    });

const label = (entry: MethodEntry) => `${entry.service}.${entry.method}`;

const executorEntries = METHOD_ENTRIES.filter(
    (entry): entry is MethodEntry & { events: MethodEvents } =>
        !isNone(entry.events),
);

describe("service method events", () => {
    let ctx: HieroContext;
    let services: Services;
    let env: CallEnv;
    let before: TransactionEvent[];
    let after: TransactionEvent[];
    /** Every fake that stands in for a node or the mirror node. */
    let network: ReturnType<typeof vi.spyOn>[];

    beforeEach(() => {
        ctx = new HieroContext({
            network: "testnet",
            operatorId: OPERATOR_ID,
            operatorKeyType: "der",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
        });
        before = [];
        after = [];
        ctx.addTransactionListener({
            onBeforeTransaction: (event) => {
                before.push(event);
            },
            onAfterTransaction: (event) => {
                after.push(event);
            },
        });
        services = createServices(ctx);
        env = { client: ctx.client, operatorId: OPERATOR_ID };

        network = [
            vi
                .spyOn(Transaction.prototype, "execute")
                .mockImplementation(() => Promise.resolve(response as never)),
            vi.spyOn(Query.prototype, "execute").mockImplementation(function (
                this: unknown,
            ) {
                return Promise.resolve(queryResult(this));
            }),
            vi
                .spyOn(ContractCreateFlow.prototype, "execute")
                .mockImplementation(() => Promise.resolve(response as never)),
            vi
                .spyOn(TokenRejectFlow.prototype, "execute")
                .mockImplementation(() => Promise.resolve(response as never)),
            vi
                .spyOn(MirrorNodeAccountBalanceQuery.prototype, "execute")
                .mockImplementation(() =>
                    Promise.resolve({
                        hbars: { toTinybars: () => Long.ONE },
                    } as never),
                ),
            vi
                .spyOn(MirrorNodeTokenBalanceQuery.prototype, "execute")
                .mockImplementation(() =>
                    Promise.resolve({
                        tokenId: TokenId.fromString(MISSING_ID),
                        balance: Long.ONE,
                        decimals: 0,
                    }),
                ),
            vi
                .spyOn(MirrorNodeContractCallQuery.prototype, "execute")
                .mockImplementation(() => Promise.resolve("0x")),
            vi
                .spyOn(MirrorNodeContractEstimateQuery.prototype, "execute")
                .mockImplementation(() => Promise.resolve(21_000)),
            vi
                .spyOn(AddressBookQuery.prototype, "execute")
                .mockImplementation(() =>
                    Promise.resolve({ nodeAddresses: [] } as never),
                ),
            vi
                .spyOn(FeeEstimateQuery.prototype, "execute")
                .mockImplementation(() =>
                    Promise.resolve({
                        networkFee: { multiplier: 1, subtotal: Long.ONE },
                        nodeFee: { base: Long.ONE, extras: [] },
                        serviceFee: { base: Long.ONE, extras: [] },
                        highVolumeMultiplier: Long.ONE,
                        total: Long.ONE,
                    }),
                ),
            vi
                .spyOn(TopicMessageQuery.prototype, "subscribe")
                .mockImplementation(
                    () =>
                        ({
                            unsubscribe: vi.fn(),
                        }) as never,
                ),
        ];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        ctx.close();
    });

    describe("coverage", () => {
        const privateMethods = new Map(Object.entries(PRIVATE_METHODS));
        const tables = new Map(Object.entries(SERVICE_METHODS));

        it.each(Object.entries(SERVICE_CLASSES))(
            "has an entry for every public method of %s",
            (service, serviceClass) => {
                const proto = serviceClass.prototype as object;
                const methods = Object.getOwnPropertyNames(proto).filter(
                    (name) =>
                        name !== "constructor" &&
                        typeof Object.getOwnPropertyDescriptor(proto, name)
                            ?.value === "function" &&
                        !(privateMethods.get(service) ?? []).includes(name),
                );
                const table = Object.keys(tables.get(service) ?? {});

                expect(
                    methods.filter((name) => !table.includes(name)),
                    "public methods without a table entry",
                ).toEqual([]);
                expect(
                    table.filter((name) => !methods.includes(name)),
                    "table entries for methods that don't exist",
                ).toEqual([]);
            },
        );
    });

    describe("a successful call", () => {
        it.each(executorEntries.map((entry) => [label(entry), entry]))(
            "%s emits one before and one after event",
            async (_, entry) => {
                await entry.call(services, env);

                const expected = {
                    type: entry.events.type,
                    serviceName: entry.service,
                    methodName: entry.events.methodName,
                };
                expect(before).toEqual([expect.objectContaining(expected)]);
                expect(before[0].status).toBeUndefined();
                expect(before[0].error).toBeUndefined();
                expect(after).toEqual([
                    expect.objectContaining({
                        ...expected,
                        status: "SUCCESS",
                        durationMs: expect.any(Number),
                    }),
                ]);
                expect(after[0].error).toBeUndefined();

                if (entry.events.kind !== "query") {
                    expect(after[0].transactionId).toBe(TX_ID);
                }
            },
        );

        it.each(
            METHOD_ENTRIES.filter((entry) => isNone(entry.events)).map(
                (entry) => [label(entry), entry],
            ),
        )("%s is not an executor path and emits no event", async (_, entry) => {
            await entry.call(services, env);

            expect(before).toEqual([]);
            expect(after).toEqual([]);
        });
    });

    describe("a network rejection", () => {
        beforeEach(() => {
            for (const fn of network) {
                fn.mockRejectedValue(networkRejection());
            }
        });

        it.each(executorEntries.map((entry) => [label(entry), entry]))(
            "%s throws a HieroError and the after-event carries the error",
            async (_, entry) => {
                const error = await rejectionOf(() =>
                    entry.call(services, env),
                );

                const context = `${entry.service}.${entry.events.methodName}`;
                expect(error).toBeInstanceOf(HieroError);
                expect(error).toMatchObject({
                    code: "SDK_ERROR",
                    sdkStatus: "INVALID_SIGNATURE",
                    context,
                    transactionId: TX_ID,
                });
                expect(before).toHaveLength(1);
                expect(after).toEqual([
                    expect.objectContaining({
                        type: entry.events.type,
                        methodName: entry.events.methodName,
                        error: rootCause(error),
                    }),
                ]);
                expect(after[0].status).toBeUndefined();
            },
        );
    });

    describe("input core validates", () => {
        it.each(
            METHOD_ENTRIES.filter((entry) => entry.hasInvalid).map((entry) => [
                label(entry),
                entry,
            ]),
        )(
            "%s is rejected with INPUT_INVALID before any event",
            async (_, entry) => {
                const error = await rejectionOf(() =>
                    entry.callInvalid(services, env),
                );

                expect(error).toBeInstanceOf(HieroError);
                expect((error as HieroError).code).toBe("INPUT_INVALID");
                expect(before).toEqual([]);
                expect(after).toEqual([]);
                for (const fn of network) {
                    expect(fn).not.toHaveBeenCalled();
                }
            },
        );
    });

    // Characterization: pins what happens today when the SDK itself throws
    // while core assembles a transaction or query (a setter, or
    // `AccountId.fromString` in the executor's base options). Nothing has
    // been sent, so no event fires either way; whether the error is
    // wrapped depends on where it is thrown.
    describe("an SDK throw while building", () => {
        function expectNoEventAndNothingSent() {
            expect(before).toEqual([]);
            expect(after).toEqual([]);
            for (const fn of network) {
                expect(fn).not.toHaveBeenCalled();
            }
        }

        it("in BaseOperation.build() surfaces the raw SDK error", async () => {
            const error = await rejectionOf(() =>
                services.TopicService.createTopic({
                    autoRenewAccountId: "not-an-account",
                }),
            );

            expect(error).toBeInstanceOf(Error);
            expect(error).not.toBeInstanceOf(HieroError);
            expectNoEventAndNothingSent();
        });

        it("in BaseOperation.build() for a validated option surfaces the raw SDK error", async () => {
            // The validator checks the token id is present, not that it parses.
            const error = await rejectionOf(() =>
                services.TokenService.pauseToken({ tokenId: "not-a-token" }),
            );

            expect(error).not.toBeInstanceOf(HieroError);
            expectNoEventAndNothingSent();
        });

        it("in TransactionExecutor base options surfaces the raw SDK error", async () => {
            const error = await rejectionOf(() =>
                services.TopicService.createTopic({
                    nodeAccountIds: ["not-a-node"],
                }),
            );

            expect(error).not.toBeInstanceOf(HieroError);
            expectNoEventAndNothingSent();
        });

        it("in the schedule payer surfaces the raw SDK error", async () => {
            const error = await rejectionOf(() =>
                services.TopicService.scheduleCreateTopic(
                    {},
                    { payerAccountId: "not-an-account" },
                ),
            );

            expect(error).not.toBeInstanceOf(HieroError);
            expectNoEventAndNothingSent();
        });

        it("in a flow surfaces the raw SDK error", async () => {
            const error = await rejectionOf(() =>
                services.TokenService.rejectTokensFlow({
                    ownerId: OPERATOR_ID,
                    fungibleTokenIds: ["not-a-token"],
                }),
            );

            expect(error).not.toBeInstanceOf(HieroError);
            expectNoEventAndNothingSent();
        });

        it("in QueryExecutor base options called directly surfaces the raw SDK error", async () => {
            const error = await rejectionOf(() =>
                services.NetworkService.getNetworkVersionInfo({
                    nodeAccountIds: ["not-a-node"],
                }),
            );

            expect(error).not.toBeInstanceOf(HieroError);
            expectNoEventAndNothingSent();
        });

        it("in a query wrapper is normalized to SDK_ERROR, not INPUT_INVALID", async () => {
            // Query classes build inside their try/catch, so the SDK's
            // parse error goes through normalizeError.
            const error = await rejectionOf(() =>
                services.TopicService.getTopicInfo("not-a-topic"),
            );

            expect(error).toBeInstanceOf(HieroError);
            expect(error).toMatchObject({
                code: "SDK_ERROR",
                context: "TopicService.getTopicInfo",
                sdkStatus: undefined,
            });
            expectNoEventAndNothingSent();
        });

        it("in a query wrapper's base options is normalized to SDK_ERROR", async () => {
            const error = await rejectionOf(() =>
                services.TopicService.getTopicInfo(MISSING_ID, {
                    nodeAccountIds: ["not-a-node"],
                }),
            );

            expect(error).toMatchObject({
                code: "SDK_ERROR",
                context: "TopicService.getTopicInfo",
            });
            expectNoEventAndNothingSent();
        });
    });

    describe("input core does not validate", () => {
        it("appendToFile with empty contents fails in the SDK after the before-event", async () => {
            // Characterization: FileAppendValidator only checks contents is
            // present, so the empty append reaches the executor and the SDK
            // fails it at freeze, inside the event pair.
            const error = await rejectionOf(() =>
                services.FileService.appendToFile({
                    fileId: MISSING_ID,
                    contents: "",
                }),
            );

            expect(error).toMatchObject({
                code: "SDK_ERROR",
                context: "FileService.appendToFile",
            });
            expect(before).toHaveLength(1);
            expect(after).toEqual([
                expect.objectContaining({ error: expect.any(Error) }),
            ]);
            for (const fn of network) {
                expect(fn).not.toHaveBeenCalled();
            }
        });
    });

    describe("a call that sends more than one transaction", () => {
        it("createFile with contents over one transaction emits a FileCreate then a FileAppend pair", async () => {
            await services.FileService.createFile({
                contents: new Uint8Array(10_000),
            });

            const names = (events: TransactionEvent[]) =>
                events.map((event) => `${event.type}/${event.methodName}`);
            expect(names(before)).toEqual([
                "FileCreate/createFile",
                "FileAppend/appendToFile",
            ]);
            expect(names(after)).toEqual(names(before));
        });
    });
});
