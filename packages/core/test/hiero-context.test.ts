import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { Client } from "@hashgraph/sdk";
import * as configModule from "../src/config/index.js";

// Mock the SDK
vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    const mockClient = {
        setOperator: vi.fn().mockReturnThis(),
        close: vi.fn(),
    };

    return {
        ...actual,
        Client: {
            forTestnet: vi.fn(() => mockClient),
            forMainnet: vi.fn(() => mockClient),
            forPreviewnet: vi.fn(() => mockClient),
        },
        AccountId: {
            fromString: vi.fn((id: string) => ({ toString: () => id })),
        },
        PrivateKey: {
            fromStringDer: vi.fn((key: string) => ({ toString: () => key })),
        },
    };
});

describe("HieroContext", () => {
    const validConfig = {
        network: "testnet",
        operatorId: "0.0.2",
        operatorKey:
            "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208", // dummy key
    };

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
    });

    describe("Initialization & Singleton Retrieval", () => {
        it("throws an error if get() is called before initialization", () => {
            expect(() => HieroContext.get()).toThrow(
                /has not been initialized/,
            );
        });

        it("initializes optimally with valid explicit config", () => {
            const ctx = HieroContext.initialize(validConfig);

            expect(ctx.config).toEqual(validConfig);
            expect(ctx.operatorAccountId.toString()).toBe("0.0.2");
            expect(ctx.operatorKey.toString()).toBe(validConfig.operatorKey);
            expect(Client.forTestnet).toHaveBeenCalled();
            expect(ctx.client.setOperator).toHaveBeenCalled();
        });

        it("returns the exact same instance on subsequent initialize() calls", () => {
            const ctx1 = HieroContext.initialize(validConfig);
            const ctx2 = HieroContext.initialize(validConfig);
            const ctx3 = HieroContext.get();

            expect(ctx1).toBe(ctx2);
            expect(ctx1).toBe(ctx3);
        });

        it("resolves from environment variables if no config provided", () => {
            vi.spyOn(configModule, "assertEnvConfigValid").mockImplementation(
                () => {},
            );
            vi.spyOn(configModule, "resolveConfigFromEnv").mockReturnValue(
                validConfig,
            );

            const ctx = HieroContext.initialize();

            expect(ctx.config).toEqual(validConfig);
            expect(configModule.assertEnvConfigValid).toHaveBeenCalled();
            expect(configModule.resolveConfigFromEnv).toHaveBeenCalled();
        });
    });

    describe("Network Resolution", () => {
        it("supports mainnet", () => {
            HieroContext.initialize({ ...validConfig, network: "mainnet" });
            expect(Client.forMainnet).toHaveBeenCalled();
        });

        it("supports hedera-mainnet alias", () => {
            HieroContext.initialize({
                ...validConfig,
                network: "hedera-mainnet",
            });
            expect(Client.forMainnet).toHaveBeenCalled();
        });

        it("supports previewnet", () => {
            HieroContext.initialize({ ...validConfig, network: "previewnet" });
            expect(Client.forPreviewnet).toHaveBeenCalled();
        });

        it("throws an unsupported network error for invalid networks", () => {
            expect(() => {
                HieroContext.initialize({
                    ...validConfig,
                    network: "invalid-net",
                });
            }).toThrow(/Custom networks are not yet supported/);
        });
    });

    describe("Singleton Resetting", () => {
        it("closes the client and nullifies the instance on reset", () => {
            const ctx = HieroContext.initialize(validConfig);

            HieroContext.reset();

            expect(ctx.client.close).toHaveBeenCalled();
            expect(() => HieroContext.get()).toThrow();
        });

        it("does nothing if resetting when already null", () => {
            expect(() => HieroContext.reset()).not.toThrow();
        });
    });

    describe("Transaction Listeners", () => {
        it("registers and removes transaction listeners dynamically", async () => {
            const ctx = HieroContext.initialize(validConfig);
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
});
