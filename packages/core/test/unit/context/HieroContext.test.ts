import { describe, it, expect, vi, afterEach } from "vitest";
import { inspect } from "node:util";
import {
    Client,
    ContractFunctionParameters,
    ContractId,
    DefaultHttpTransport,
    FeeEstimateQuery,
    MirrorNodeAccountBalanceQuery,
    MirrorNodeContractCallQuery,
    PrivateKey,
    TransactionId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { HieroContext } from "../../../src/context/index.js";
import type { HieroConfig } from "../../../src/config/index.js";
import { HieroError, HieroErrorCodes } from "../../../src/errors/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";
import * as configModule from "../../../src/config/index.js";

// Uses the real SDK: clients are built offline, and a real key is needed to
// check that it never leaks.

const operatorKey =
    "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
const privateKey = PrivateKey.fromStringDer(operatorKey);
const ecdsaKey = PrivateKey.fromStringECDSA(
    "7f109a9e3b0d8ecfba9cc23a3614433ce0fa7ddcc80f2a8f10b222179a5a80d6",
);

describe("HieroContext", () => {
    const validConfig = {
        network: "testnet",
        operatorId: "0.0.2",
        operatorKey,
        operatorKeyType: OperatorKeyType.DER,
    };

    const contexts: HieroContext[] = [];
    const create = (config?: HieroConfig) => {
        const ctx = new HieroContext(config);
        contexts.push(ctx);
        return ctx;
    };

    afterEach(() => {
        contexts.splice(0).forEach((ctx) => ctx.close());
        vi.restoreAllMocks();
    });

    describe("Construction", () => {
        it("creates a context with valid explicit config", () => {
            const ctx = create(validConfig);

            expect(ctx.config).toEqual({
                ...validConfig,
                operatorKey: "[redacted]",
            });
            expect(ctx.operatorAccountId.toString()).toBe("0.0.2");
            expect(ctx.operatorPublicKey.toString()).toBe(
                privateKey.publicKey.toString(),
            );
            expect(ctx.client.operatorAccountId?.toString()).toBe("0.0.2");
        });

        it("creates independent instances (no singleton)", () => {
            const ctx1 = create(validConfig);
            const ctx2 = create(validConfig);

            expect(ctx1).not.toBe(ctx2);
            expect(ctx1.client).not.toBe(ctx2.client);
        });

        it("resolves from environment variables if no config provided", () => {
            vi.spyOn(configModule, "resolveConfigFromEnv").mockReturnValue(
                validConfig,
            );

            const ctx = create();

            expect(ctx.config).toEqual({
                ...validConfig,
                operatorKey: "[redacted]",
            });
            expect(configModule.resolveConfigFromEnv).toHaveBeenCalled();
        });

        it("throws CONFIG_INVALID for an unknown HIERO_OPERATOR_KEY_TYPE", () => {
            const env = process.env;
            process.env = {
                HIERO_NETWORK: "testnet",
                HIERO_OPERATOR_ID: "0.0.2",
                HIERO_OPERATOR_KEY: "abc",
                HIERO_OPERATOR_KEY_TYPE: "rsa",
            };
            try {
                expect(() => create()).toThrow(
                    expect.objectContaining({
                        code: HieroErrorCodes.ConfigInvalid,
                        message: expect.stringContaining('"rsa"'),
                    }),
                );
            } finally {
                process.env = env;
            }
        });
    });

    describe("Invalid credentials", () => {
        it("throws CONFIG_INVALID for a malformed operatorId without creating a client", () => {
            const forTestnet = vi.spyOn(Client, "forTestnet");

            let thrown: unknown;
            try {
                create({ ...validConfig, operatorId: "not-an-id" });
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(HieroError);
            expect(thrown).toMatchObject({
                code: HieroErrorCodes.ConfigInvalid,
            });
            expect((thrown as HieroError).message).toContain("not-an-id");
            expect(forTestnet).not.toHaveBeenCalled();
        });

        it("does not create a client when the operator key is invalid", () => {
            const forTestnet = vi.spyOn(Client, "forTestnet");

            expect(() =>
                create({ ...validConfig, operatorKey: "not-a-valid-key" }),
            ).toThrow(/Invalid operator key/);
            expect(forTestnet).not.toHaveBeenCalled();
        });
    });

    describe("Network Resolution", () => {
        it.each([
            ["mainnet", "mainnet"],
            ["hedera-mainnet", "mainnet"],
            ["testnet", "testnet"],
            ["previewnet", "previewnet"],
        ])("supports %s", (network, ledger) => {
            const ctx = create({ ...validConfig, network });

            expect(ctx.client.ledgerId?.toString()).toBe(ledger);
        });

        it("throws for unknown network without networkNodes", () => {
            expect(() =>
                create({ ...validConfig, network: "invalid-net" }),
            ).toThrow(/Unknown network/);
        });

        it("supports a custom network with networkNodes", () => {
            const ctx = create({
                ...validConfig,
                network: "local",
                networkNodes: { "127.0.0.1:35211": "0.0.3" },
            });

            expect(ctx.client.network["127.0.0.1:35211"]?.toString()).toBe(
                "0.0.3",
            );
        });
    });

    describe("Closing", () => {
        it("closes the client on close()", () => {
            const ctx = create(validConfig);
            const close = vi.spyOn(ctx.client, "close");

            ctx.close();

            expect(close).toHaveBeenCalled();
        });
    });

    describe("Operator key", () => {
        it("redacts operatorKey in config", () => {
            const ctx = create(validConfig);

            expect(ctx.config.operatorKey).toBe("[redacted]");
            expect(JSON.stringify(ctx.config)).not.toContain(operatorKey);
        });

        it("does not modify the caller's config", () => {
            const callerConfig = { ...validConfig };
            const ctx = create(callerConfig);

            expect(ctx.config).not.toBe(callerConfig);
            expect(callerConfig.operatorKey).toBe(operatorKey);
        });

        it("keeps the key out of inspect output", () => {
            const output = inspect(create(validConfig), {
                depth: Infinity,
                maxArrayLength: Infinity,
            });

            expect(output).not.toContain(privateKey.toStringRaw());
            expect(output).not.toContain(
                Array.from(privateKey.toBytesRaw()).join(", "),
            );
        });

        it("signs transactions with the operator key", async () => {
            const ctx = create(validConfig);
            const tx = new TransferTransaction()
                .setNodeAccountIds([ctx.operatorAccountId])
                .setTransactionId(TransactionId.generate(ctx.operatorAccountId))
                .freeze();

            await ctx.signTransaction(tx);

            expect(privateKey.publicKey.verifyTransaction(tx)).toBe(true);
        });
    });

    describe("Key Type Parsing", () => {
        it.each([
            [OperatorKeyType.DER, operatorKey, privateKey],
            [OperatorKeyType.ED25519, privateKey.toStringRaw(), privateKey],
            [OperatorKeyType.ECDSA, ecdsaKey.toStringRaw(), ecdsaKey],
        ])("parses a %s key", (operatorKeyType, key, expected) => {
            const ctx = create({
                ...validConfig,
                operatorKeyType,
                operatorKey: key,
            });

            expect(ctx.operatorPublicKey.toString()).toBe(
                expected.publicKey.toString(),
            );
        });

        it("throws CONFIG_INVALID for an unknown key type", () => {
            expect(() =>
                create({ ...validConfig, operatorKeyType: "rsa" }),
            ).toThrow(
                expect.objectContaining({
                    code: HieroErrorCodes.ConfigInvalid,
                }),
            );
        });
    });

    describe("Transaction Listeners", () => {
        it("registers and removes transaction listeners", async () => {
            const ctx = create(validConfig);
            const mockListener = {
                onBeforeTransaction: vi.fn(),
                onAfterTransaction: vi.fn(),
            };

            ctx.addTransactionListener(mockListener);

            await ctx.emitBeforeTransaction({
                type: "AccountCreate",
                serviceName: "Test",
                methodName: "test",
                timestamp: new Date(),
            });
            expect(mockListener.onBeforeTransaction).toHaveBeenCalledTimes(1);

            ctx.removeTransactionListener(mockListener);

            await ctx.emitAfterTransaction({
                type: "AccountCreate",
                serviceName: "Test",
                methodName: "test",
                timestamp: new Date(),
                status: "SUCCESS",
            });
            expect(mockListener.onAfterTransaction).not.toHaveBeenCalled();
        });
    });

    describe("Listener failures", () => {
        const event = {
            type: "AccountCreate",
            serviceName: "AccountService",
            methodName: "createAccount",
            timestamp: new Date(),
        };

        it("isolates throwing onAfterTransaction listeners and still notifies the rest", async () => {
            const emitWarning = vi
                .spyOn(process, "emitWarning")
                .mockImplementation(() => undefined);
            const ctx = create(validConfig);
            const later = { onAfterTransaction: vi.fn() };
            ctx.addTransactionListener({
                onAfterTransaction: () => {
                    throw new Error("sync listener bug");
                },
            });
            ctx.addTransactionListener({
                onAfterTransaction: () =>
                    Promise.reject(new Error("async listener bug")),
            });
            ctx.addTransactionListener(later);

            await expect(
                ctx.emitAfterTransaction(event),
            ).resolves.toBeUndefined();

            expect(later.onAfterTransaction).toHaveBeenCalledWith(event);
            expect(emitWarning).toHaveBeenCalledTimes(2);
            expect(emitWarning).toHaveBeenCalledWith(
                expect.stringContaining(
                    "AccountService.createAccount: sync listener bug",
                ),
                expect.objectContaining({ code: "HIERO_LISTENER_ERROR" }),
            );
        });

        it("still runs later listeners when a listener throws an unprintable value", async () => {
            const emitWarning = vi
                .spyOn(process, "emitWarning")
                .mockImplementation(() => undefined);
            const ctx = create(validConfig);
            const later = { onAfterTransaction: vi.fn() };
            ctx.addTransactionListener({
                onAfterTransaction: () => {
                    throw Object.create(null);
                },
            });
            ctx.addTransactionListener(later);

            await expect(
                ctx.emitAfterTransaction(event),
            ).resolves.toBeUndefined();
            expect(later.onAfterTransaction).toHaveBeenCalledWith(event);
            expect(emitWarning).toHaveBeenCalledTimes(1);
        });

        it("isolates throwing onBeforeTransaction listeners and still notifies the rest", async () => {
            const emitWarning = vi
                .spyOn(process, "emitWarning")
                .mockImplementation(() => undefined);
            const ctx = create(validConfig);
            const later = { onBeforeTransaction: vi.fn() };
            ctx.addTransactionListener({
                onBeforeTransaction: () => {
                    throw new Error("metrics backend down");
                },
            });
            ctx.addTransactionListener(later);

            await expect(
                ctx.emitBeforeTransaction(event),
            ).resolves.toBeUndefined();
            expect(later.onBeforeTransaction).toHaveBeenCalledWith(event);
            expect(emitWarning).toHaveBeenCalledWith(
                expect.stringContaining(
                    "onBeforeTransaction listener threw for AccountService.createAccount: metrics backend down",
                ),
                expect.objectContaining({ code: "HIERO_LISTENER_ERROR" }),
            );
        });
    });

    describe("SDK Tuning", () => {
        it("applies tuning options from config", () => {
            const ctx = create({
                ...validConfig,
                requestTimeoutMs: 30000,
                maxAttempts: 5,
                minBackoffMs: 500,
                maxBackoffMs: 8000,
            });

            expect(ctx.client.requestTimeout).toBe(30000);
            expect(ctx.client.maxAttempts).toBe(5);
            expect(ctx.client.minBackoff).toBe(500);
            expect(ctx.client.maxBackoff).toBe(8000);
        });
    });

    describe("Timeouts", () => {
        it("applies grpcDeadlineMs", () => {
            const ctx = create({ ...validConfig, grpcDeadlineMs: 2000 });

            expect(ctx.client.grpcDeadline).toBe(2000);
        });

        it("leaves the SDK default deadline when grpcDeadlineMs is unset", () => {
            const defaultDeadline = create(validConfig).client.grpcDeadline;

            expect(
                create({ ...validConfig, requestTimeoutMs: 60000 }).client
                    .grpcDeadline,
            ).toBe(defaultDeadline);
        });

        // The SDK warns whenever the gRPC deadline is not below the request
        // timeout, checking against the other value's current setting.
        it.each([
            ["lowering both", { requestTimeoutMs: 5000, grpcDeadlineMs: 2000 }],
            [
                "raising both",
                { requestTimeoutMs: 300000, grpcDeadlineMs: 150000 },
            ],
        ])("applies a valid pair without SDK warnings (%s)", (_, timeouts) => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

            const ctx = create({ ...validConfig, ...timeouts });

            expect(ctx.client.requestTimeout).toBe(timeouts.requestTimeoutMs);
            expect(ctx.client.grpcDeadline).toBe(timeouts.grpcDeadlineMs);
            expect(warn).not.toHaveBeenCalled();
        });

        it("still lets the SDK warn about an inverted pair", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

            create({
                ...validConfig,
                requestTimeoutMs: 2000,
                grpcDeadlineMs: 5000,
            });

            expect(warn).toHaveBeenCalled();
        });
    });

    describe("Mirror node", () => {
        const localConfig = {
            ...validConfig,
            network: "local",
            networkNodes: { "127.0.0.1:50211": "0.0.3" },
        };

        it("applies mirrorNetwork to the client", () => {
            const ctx = create({
                ...localConfig,
                mirrorNetwork: ["localhost:5600"],
            });

            expect(ctx.client.mirrorNetwork).toEqual(["localhost:5600"]);
        });

        it("leaves the client's mirror network empty when mirrorNetwork is unset", () => {
            expect(create(localConfig).client.mirrorNetwork).toEqual([]);
        });

        it("sends mirror REST calls to mirrorNodeUrl", async () => {
            const ctx = create({
                ...localConfig,
                mirrorNetwork: ["localhost:5600"],
                mirrorNodeUrl: "http://localhost:38081",
            });
            const roundTrip = vi
                .spyOn(DefaultHttpTransport.prototype, "roundTrip")
                .mockRejectedValue(new Error("stop"));

            await new MirrorNodeAccountBalanceQuery()
                .setAccountId("0.0.2")
                .execute(ctx.client)
                .catch(() => undefined);

            expect(roundTrip.mock.calls[0][0].url).toMatch(
                /^http:\/\/localhost:38081\/api\/v1\//,
            );
        });

        it.each([
            [
                "rest-java",
                () =>
                    new FeeEstimateQuery().setTransaction(
                        new TransferTransaction(),
                    ),
                /^http:\/\/localhost:8084\/api\/v1\/network\/fees/,
            ],
            [
                "web3",
                () =>
                    new MirrorNodeContractCallQuery()
                        .setContractId(ContractId.fromString("0.0.1001"))
                        .setFunction("get", new ContractFunctionParameters()),
                /^http:\/\/localhost:8545\/api\/v1\/contracts\/call/,
            ],
        ])(
            "leaves a local mirror's %s port alone when mirrorNodeUrl is set",
            async (_name, query, expected) => {
                const ctx = create({
                    ...localConfig,
                    mirrorNetwork: ["localhost:5600"],
                    mirrorNodeUrl: "http://localhost:38081",
                });
                const roundTrip = vi
                    .spyOn(DefaultHttpTransport.prototype, "roundTrip")
                    .mockRejectedValue(new Error("stop"));

                await query()
                    .execute(ctx.client)
                    .catch(() => undefined);

                expect(roundTrip.mock.calls[0][0].url).toMatch(expected);
            },
        );

        it("sends every REST call to mirrorNodeUrl with several mirror nodes", async () => {
            const ctx = create({
                ...localConfig,
                mirrorNetwork: ["localhost:5600", "127.0.0.1:5600"],
                mirrorNodeUrl: "http://localhost:38081",
            });
            const roundTrip = vi
                .spyOn(DefaultHttpTransport.prototype, "roundTrip")
                .mockRejectedValue(new Error("stop"));

            for (let i = 0; i < 2; i++) {
                await new MirrorNodeAccountBalanceQuery()
                    .setAccountId("0.0.2")
                    .execute(ctx.client)
                    .catch(() => undefined);
            }

            const urls = roundTrip.mock.calls.map(([request]) => request.url);
            expect(new Set(urls.map((url) => new URL(url).origin))).toEqual(
                new Set(["http://localhost:38081"]),
            );
        });

        it("sends a hosted mirror's fee estimate to mirrorNodeUrl", async () => {
            const ctx = create({
                ...localConfig,
                mirrorNetwork: ["mirror.example.com:443"],
                mirrorNodeUrl: "http://localhost:38081",
            });
            const roundTrip = vi
                .spyOn(DefaultHttpTransport.prototype, "roundTrip")
                .mockRejectedValue(new Error("stop"));

            await new FeeEstimateQuery()
                .setTransaction(new TransferTransaction())
                .execute(ctx.client)
                .catch(() => undefined);

            expect(roundTrip.mock.calls[0][0].url).toMatch(
                /^http:\/\/localhost:38081\/api\/v1\/network\/fees/,
            );
        });

        it("keeps the SDK's mirror transport when mirrorNodeUrl is unset", () => {
            const ctx = create({
                ...localConfig,
                mirrorNetwork: ["localhost:5600"],
            });

            expect(ctx.client.getMirrorNodeHttpConfig().transport).toBeNull();
        });

        it.each(["localhost:5551", "not a url"])(
            "rejects the invalid mirrorNodeUrl %s",
            (mirrorNodeUrl) => {
                expect(() => create({ ...localConfig, mirrorNodeUrl })).toThrow(
                    expect.objectContaining({
                        code: HieroErrorCodes.ConfigInvalid,
                    }),
                );
            },
        );
    });
});
