import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../../../src/context/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";
import type { Transaction } from "@hiero-ledger/sdk";
import { Client, PrivateKey } from "@hiero-ledger/sdk";
import * as configModule from "../../../src/config/index.js";

// Mock the SDK
vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const mockClient = {
        setOperator: vi.fn().mockReturnThis(),
        setRequestTimeout: vi.fn().mockReturnThis(),
        setMaxAttempts: vi.fn().mockReturnThis(),
        setMinBackoff: vi.fn().mockReturnThis(),
        setMaxBackoff: vi.fn().mockReturnThis(),
        close: vi.fn(),
    };

    return {
        ...actual,
        Client: {
            forTestnet: vi.fn(() => mockClient),
            forMainnet: vi.fn(() => mockClient),
            forPreviewnet: vi.fn(() => mockClient),
            forNetwork: vi.fn(() => ({
                ...mockClient,
                setMirrorNetwork: vi.fn().mockReturnThis(),
            })),
        },
        AccountId: {
            fromString: vi.fn((id: string) => ({ toString: () => id })),
        },
        PrivateKey: {
            fromStringDer: vi.fn((key: string) => ({
                toString: () => key,
                publicKey: { toString: () => "mock-public-key-der" },
            })),
            fromStringED25519: vi.fn((key: string) => ({
                toString: () => key,
                publicKey: { toString: () => "mock-public-key-ed25519" },
            })),
            fromStringECDSA: vi.fn((key: string) => ({
                toString: () => key,
                publicKey: { toString: () => "mock-public-key-ecdsa" },
            })),
        },
    };
});

describe("HieroContext", () => {
    const validConfig = {
        network: "testnet",
        operatorId: "0.0.2",
        operatorKey:
            "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
        operatorKeyType: OperatorKeyType.DER,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Construction", () => {
        it("creates a context with valid explicit config", () => {
            const ctx = new HieroContext(validConfig);

            expect(ctx.config).toEqual(validConfig);
            expect(ctx.operatorAccountId.toString()).toBe("0.0.2");
            expect(ctx.operatorPublicKey.toString()).toBe(
                "mock-public-key-der",
            );
            expect(Client.forTestnet).toHaveBeenCalled();
            expect(ctx.client.setOperator).toHaveBeenCalled();
        });

        it("creates independent instances (no singleton)", () => {
            const ctx1 = new HieroContext(validConfig);
            const ctx2 = new HieroContext(validConfig);

            expect(ctx1).not.toBe(ctx2);
        });

        it("resolves from environment variables if no config provided", () => {
            vi.spyOn(configModule, "assertEnvConfigValid").mockImplementation(
                () => {},
            );
            vi.spyOn(configModule, "resolveConfigFromEnv").mockReturnValue(
                validConfig,
            );

            const ctx = new HieroContext();

            expect(ctx.config).toEqual(validConfig);
            expect(configModule.assertEnvConfigValid).toHaveBeenCalled();
            expect(configModule.resolveConfigFromEnv).toHaveBeenCalled();
        });
    });

    describe("Network Resolution", () => {
        it("supports mainnet", () => {
            new HieroContext({ ...validConfig, network: "mainnet" });
            expect(Client.forMainnet).toHaveBeenCalled();
        });

        it("supports hedera-mainnet alias", () => {
            new HieroContext({ ...validConfig, network: "hedera-mainnet" });
            expect(Client.forMainnet).toHaveBeenCalled();
        });

        it("supports previewnet", () => {
            new HieroContext({ ...validConfig, network: "previewnet" });
            expect(Client.forPreviewnet).toHaveBeenCalled();
        });

        it("throws for unknown network without networkNodes", () => {
            expect(() => {
                new HieroContext({ ...validConfig, network: "invalid-net" });
            }).toThrow(/Unknown network/);
        });

        it("supports custom network with mirrorNodeUrl", () => {
            const ctx = new HieroContext({
                ...validConfig,
                network: "local",
                networkNodes: { "127.0.0.1:35211": "0.0.3" },
            });
            expect(Client.forNetwork).toHaveBeenCalled();
            expect(ctx).toBeDefined();
        });

        it("supports custom network with networkNodes only (no mirrorNodeUrl)", () => {
            // Custom SDK client only needs consensus node addresses;
            // the mirror node URL is a REST concern handled by the factory
            // (HieroConfig deliberately has no mirrorNodeUrl key).
            const ctx = new HieroContext({
                ...validConfig,
                network: "local",
                networkNodes: { "127.0.0.1:35211": "0.0.3" },
            });
            expect(Client.forNetwork).toHaveBeenCalled();
            expect(ctx).toBeDefined();
        });
    });

    describe("Closing", () => {
        it("closes the client on close()", () => {
            const ctx = new HieroContext(validConfig);
            ctx.close();
            expect(ctx.client.close).toHaveBeenCalled();
        });
    });

    describe("Private Key Access", () => {
        it("exposes operatorPublicKey but not the raw key", () => {
            const ctx = new HieroContext(validConfig);
            expect(ctx.operatorPublicKey).toBeDefined();
            // The private key is not on the public interface
            expect(
                (ctx as unknown as Record<string, unknown>)["_operatorKey"],
            ).toBeDefined();
            expect("operatorKey" in ctx).toBe(false);
        });

        it("signTransaction signs with the operator key", async () => {
            const ctx = new HieroContext(validConfig);
            const mockTx = {
                sign: vi.fn().mockResolvedValue("signed"),
            } as unknown as Transaction;
            const result = await ctx.signTransaction(mockTx);
            expect(mockTx.sign).toHaveBeenCalled();
            expect(result).toBe("signed");
        });
    });

    describe("Key Type Parsing", () => {
        it("parses DER key via PrivateKey.fromStringDer", () => {
            const ctx = new HieroContext({
                ...validConfig,
                operatorKeyType: OperatorKeyType.DER,
            });
            expect(PrivateKey.fromStringDer).toHaveBeenCalledWith(
                validConfig.operatorKey,
            );
            expect(ctx.operatorPublicKey.toString()).toBe(
                "mock-public-key-der",
            );
        });

        it("parses ED25519 key via PrivateKey.fromStringED25519", () => {
            const ctx = new HieroContext({
                ...validConfig,
                operatorKeyType: OperatorKeyType.ED25519,
            });
            expect(PrivateKey.fromStringED25519).toHaveBeenCalledWith(
                validConfig.operatorKey,
            );
            expect(ctx.operatorPublicKey.toString()).toBe(
                "mock-public-key-ed25519",
            );
        });

        it("parses ECDSA key via PrivateKey.fromStringECDSA", () => {
            const ctx = new HieroContext({
                ...validConfig,
                operatorKeyType: OperatorKeyType.ECDSA,
            });
            expect(PrivateKey.fromStringECDSA).toHaveBeenCalledWith(
                validConfig.operatorKey,
            );
            expect(ctx.operatorPublicKey.toString()).toBe(
                "mock-public-key-ecdsa",
            );
        });

        it("throws with a helpful message on invalid key material", () => {
            vi.mocked(PrivateKey.fromStringDer).mockImplementationOnce(() => {
                throw new Error("bad key");
            });
            expect(
                () =>
                    new HieroContext({
                        ...validConfig,
                        operatorKeyType: OperatorKeyType.DER,
                        operatorKey: "not-a-valid-key",
                    }),
            ).toThrow(/Invalid operator key/);
        });
    });

    describe("Transaction Listeners", () => {
        it("registers and removes transaction listeners", async () => {
            const ctx = new HieroContext(validConfig);
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

    describe("SDK Tuning", () => {
        it("applies tuning options from config", () => {
            const ctx = new HieroContext({
                ...validConfig,
                requestTimeoutMs: 30000,
                maxAttempts: 5,
                minBackoffMs: 500,
                maxBackoffMs: 8000,
            });
            expect(ctx.client.setRequestTimeout).toHaveBeenCalledWith(30000);
            expect(ctx.client.setMaxAttempts).toHaveBeenCalledWith(5);
            expect(ctx.client.setMinBackoff).toHaveBeenCalledWith(500);
            expect(ctx.client.setMaxBackoff).toHaveBeenCalledWith(8000);
        });
    });
});
