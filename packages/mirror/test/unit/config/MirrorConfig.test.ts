import { describe, it, expect, afterEach, vi } from "vitest";
import {
    resolveMirrorNodeUrl,
    mirrorConfigFromEnv,
    createMirrorNodeClient,
} from "../../../src/config/MirrorConfig.js";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { MirrorError } from "../../../src/errors/MirrorError.js";

describe("resolveMirrorNodeUrl", () => {
    it("resolves known networks (case-insensitive)", () => {
        expect(resolveMirrorNodeUrl("testnet")).toBe(
            "https://testnet.mirrornode.hedera.com",
        );
        expect(resolveMirrorNodeUrl("MAINNET")).toBe(
            "https://mainnet.mirrornode.hedera.com",
        );
        expect(resolveMirrorNodeUrl("hedera-previewnet")).toBe(
            "https://previewnet.mirrornode.hedera.com",
        );
    });

    it("prefers an explicit URL over the network name", () => {
        expect(resolveMirrorNodeUrl("testnet", "http://custom:8080")).toBe(
            "http://custom:8080",
        );
    });

    it("throws MirrorError for unknown networks without an explicit URL", () => {
        expect(() => resolveMirrorNodeUrl("devnet")).toThrow(MirrorError);
    });
});

describe("mirrorConfigFromEnv", () => {
    const env = process.env;

    it("reads url and numeric tuning vars", () => {
        process.env = {
            HIERO_NETWORK: "testnet",
            HIERO_MIRROR_NODE_URL: "http://custom:8080",
            HIERO_MIRROR_NODE_TIMEOUT_MS: "5000",
            HIERO_MIRROR_NODE_MAX_RETRIES: "5",
            HIERO_MIRROR_NODE_RETRY_ON_404: "true",
            HIERO_MIRROR_NODE_MAX_CONCURRENT: "Infinity",
            HIERO_MIRROR_NODE_MAX_REQUESTS_PER_SECOND: "50",
        };
        expect(mirrorConfigFromEnv()).toEqual({
            network: "testnet",
            mirrorNodeUrl: "http://custom:8080",
            mirrorNodeTimeoutMs: 5000,
            mirrorNodeMaxRetries: 5,
            mirrorNodeRetryOn404: true,
            mirrorNodeMaxConcurrent: Infinity,
            mirrorNodeMaxRequestsPerSecond: 50,
        });
        process.env = env;
    });

    it("treats an unset retry-on-404 var as undefined (default off)", () => {
        process.env = { HIERO_NETWORK: "testnet" };
        expect(mirrorConfigFromEnv().mirrorNodeRetryOn404).toBeUndefined();
        process.env = env;
    });

    it('reads "false"/"0" as an explicit false, not just true', () => {
        process.env = { HIERO_MIRROR_NODE_RETRY_ON_404: "false" };
        expect(mirrorConfigFromEnv().mirrorNodeRetryOn404).toBe(false);
        process.env = { HIERO_MIRROR_NODE_RETRY_ON_404: "0" };
        expect(mirrorConfigFromEnv().mirrorNodeRetryOn404).toBe(false);
        process.env = env;
    });

    it("throws on an unrecognized retry-on-404 value instead of silently defaulting to false", () => {
        process.env = { HIERO_MIRROR_NODE_RETRY_ON_404: "ture" };
        expect(() => mirrorConfigFromEnv()).toThrow(
            /HIERO_MIRROR_NODE_RETRY_ON_404 must be/,
        );
        process.env = env;
    });

    it("leaves unset vars undefined", () => {
        process.env = {};
        const config = mirrorConfigFromEnv();
        expect(config.mirrorNodeUrl).toBeUndefined();
        expect(config.mirrorNodeTimeoutMs).toBeUndefined();
        process.env = env;
    });
});

describe("createMirrorNodeClient", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("builds a client from an explicit config", () => {
        const client = createMirrorNodeClient({
            network: "testnet",
            mirrorNodeMaxConcurrent: 5,
        });
        expect(client).toBeInstanceOf(MirrorNodeClient);
    });

    it("throws when neither network nor URL resolves", () => {
        expect(() => createMirrorNodeClient({ network: "nope" })).toThrow(
            MirrorError,
        );
    });

    it("fails fast with a clear message when the config is empty", () => {
        expect(() => createMirrorNodeClient({})).toThrow(
            /must provide either "mirrorNodeUrl" or "network"/,
        );
    });

    it("surfaces invalid tuning through RequestGate validation", () => {
        expect(() =>
            createMirrorNodeClient({
                network: "testnet",
                mirrorNodeMaxConcurrent: 0,
            }),
        ).toThrow(MirrorError);
    });

    it("forwards mirrorNodeRetryOn404 to the client", async () => {
        vi.useFakeTimers();
        const spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(null, { status: 404, statusText: "Not Found" }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        account: "0.0.1",
                        balance: { balance: 1, tokens: [] },
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        const client = createMirrorNodeClient({
            network: "testnet",
            mirrorNodeRetryOn404: true,
        });

        const promise = client.queryAccount("0.0.1");
        await vi.advanceTimersByTimeAsync(1_000);

        expect((await promise).accountId).toBe("0.0.1");
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

describe("config default branches", () => {
    const env = process.env;

    it("createMirrorNodeClient falls back to env when no config given", () => {
        process.env = { HIERO_NETWORK: "testnet" };
        expect(createMirrorNodeClient()).toBeInstanceOf(MirrorNodeClient);
        process.env = env;
    });

    it("MirrorError defaults its code when none is provided", async () => {
        const { MirrorError, MirrorErrorCodes } =
            await import("../../../src/errors/MirrorError.js");
        const error = new MirrorError("boom");
        expect(error.code).toBe(MirrorErrorCodes.MirrorNodeError);
        expect(error.context).toBeUndefined();
    });
});

describe("createMirrorNodeClient — observer forwarding (#182)", () => {
    const observer = { onRequestStart() {}, onRequestEnd() {} };

    it("forwards an observer from the config to the client", () => {
        // Before the fix this was silently dropped: MirrorConfig had no
        // `observer` field and the factory built its options from five other
        // values, so the #145 telemetry hook was unreachable through the
        // documented entry point and UI consumers had to bypass the factory.
        const client = createMirrorNodeClient({
            mirrorNodeUrl: "https://example.test",
            observer,
        });

        expect((client as unknown as { observer?: unknown }).observer).toBe(
            observer,
        );
    });

    it("matches what the constructor does with the same observer", () => {
        // The factory should be a superset of `new MirrorNodeClient(...)`, not
        // a lossy shortcut — that equivalence is the actual contract.
        const viaFactory = createMirrorNodeClient({
            mirrorNodeUrl: "https://example.test",
            observer,
        });
        const viaCtor = new MirrorNodeClient("https://example.test", {
            observer,
        });

        const read = (c: unknown) => (c as { observer?: unknown }).observer;
        expect(read(viaFactory)).toBe(read(viaCtor));
    });

    it("leaves the observer undefined when the config omits it", () => {
        const client = createMirrorNodeClient({
            mirrorNodeUrl: "https://example.test",
        });

        expect(
            (client as unknown as { observer?: unknown }).observer,
        ).toBeUndefined();
    });
});
