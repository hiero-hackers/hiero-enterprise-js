import { describe, it, expect, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import type { MirrorClientObserver } from "../../../src/client/index.js";

/**
 * #145 — client observer telemetry. Each test pins one of the contract's
 * guarantees: balanced start/end pairs on every settle path, logical-request
 * granularity (retries do not produce extra pairs), retry visibility with
 * the wire's own delay/status, and full error isolation.
 */
describe("MirrorNodeClient observer (#145)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const recordingObserver = (): {
        observer: MirrorClientObserver;
        starts: Array<{ path: string }>;
        retries: Array<{ attempt: number; delayMs: number; status?: number }>;
        ends: Array<{
            path: string;
            attempts: number;
            status?: number;
            errorCode?: string;
            durationMs: number;
        }>;
    } => {
        const starts: Array<{ path: string }> = [];
        const retries: Array<{
            attempt: number;
            delayMs: number;
            status?: number;
        }> = [];
        const ends: Array<{
            path: string;
            attempts: number;
            status?: number;
            errorCode?: string;
            durationMs: number;
        }> = [];
        return {
            starts,
            retries,
            ends,
            observer: {
                onRequestStart: (e) => starts.push(e),
                onRetry: (e) => retries.push(e),
                onRequestEnd: (e) => ends.push(e),
            },
        };
    };

    const client = (observer: MirrorClientObserver) =>
        new MirrorNodeClient("https://testnet.mirrornode.hedera.com", {
            observer,
        });

    const ok = (json: string) =>
        new Response(json, {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    it("emits one balanced start/end pair with status on success", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ok('{"account":"0.0.98","balance":{"balance":1,"tokens":[]}}'),
        );
        const { observer, starts, ends } = recordingObserver();

        await client(observer).queryAccount("0.0.98");

        expect(starts).toHaveLength(1);
        expect(starts[0].path).toContain("/api/v1/accounts/0.0.98");
        expect(ends).toHaveLength(1);
        expect(ends[0]).toMatchObject({ attempts: 1, status: 200 });
        expect(ends[0].errorCode).toBeUndefined();
        expect(ends[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("still emits exactly one end — with status and errorCode — when the request throws", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(null, { status: 404, statusText: "Not Found" }),
        );
        const { observer, starts, ends } = recordingObserver();

        await expect(
            client(observer).queryAccount("0.0.404"),
        ).rejects.toThrow();

        expect(starts).toHaveLength(1);
        expect(ends).toHaveLength(1);
        expect(ends[0]).toMatchObject({
            attempts: 1,
            status: 404,
            errorCode: "NOT_FOUND",
        });
    });

    it("reports retries separately — one logical pair, N attempts", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 429,
                    // Zero delay keeps the test on real timers.
                    headers: { "retry-after": "0" },
                }),
            )
            .mockResolvedValueOnce(
                ok('{"account":"0.0.98","balance":{"balance":1,"tokens":[]}}'),
            );
        const { observer, starts, retries, ends } = recordingObserver();

        await client(observer).queryAccount("0.0.98");

        expect(fetchMock).toHaveBeenCalledTimes(2);
        // A retried request must NOT double-count for spinner consumers:
        expect(starts).toHaveLength(1);
        expect(ends).toHaveLength(1);
        expect(ends[0]).toMatchObject({ attempts: 2, status: 200 });
        // …but the retry itself is visible, with the wire's own facts:
        expect(retries).toEqual([
            {
                path: "/api/v1/accounts/0.0.98",
                attempt: 1,
                delayMs: 0,
                status: 429,
            },
        ]);
    });

    it("emits an end event on timeout, carrying the TIMED_OUT code", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
            Object.assign(new Error("aborted"), { name: "AbortError" }),
        );
        const { observer, retries, ends } = recordingObserver();
        const c = new MirrorNodeClient("https://x", {
            observer,
            timeoutMs: 5,
            maxRetries: 1,
        });

        await expect(c.queryAccount("0.0.98")).rejects.toThrow(/timed out/);

        expect(retries).toHaveLength(1);
        expect(retries[0].status).toBeUndefined();
        expect(ends).toHaveLength(1);
        expect(ends[0]).toMatchObject({ attempts: 2, errorCode: "TIMED_OUT" });
        expect(ends[0].status).toBeUndefined();
    });

    it("reports the wire status even when the failure comes after the response", async () => {
        // A 200 whose body is not JSON: the transport rejects with the
        // typed MalformedResponse error. The end event must still carry
        // the wire status the response DID have, and must mark the
        // failure — no rejection may masquerade as success.
        vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("not json at all"));
        const rec = recordingObserver();

        await expect(
            client(rec.observer).queryAccount("0.0.98"),
        ).rejects.toThrow();

        expect(rec.ends).toHaveLength(1);
        expect(rec.ends[0].status).toBe(200);
        expect(rec.ends[0].errorCode).toBe("MALFORMED_RESPONSE");
    });

    it("scopes the bracket to transport — schema mismatch after a 200 ends as success", async () => {
        // Valid JSON, invalid schema: validation runs in the query method,
        // AFTER the transport bracket. The observer sees a transport
        // success (the wire worked); the caller's promise still rejects.
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ok('{"unexpected":"shape"}'),
        );
        const rec = recordingObserver();

        await expect(
            client(rec.observer).queryAccount("0.0.98"),
        ).rejects.toThrow(/schema|expected/i);

        expect(rec.ends).toHaveLength(1);
        expect(rec.ends[0].status).toBe(200);
        expect(rec.ends[0].errorCode).toBeUndefined();
    });

    it("isolates observer errors — a throwing observer never affects the request", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ok('{"account":"0.0.98","balance":{"balance":1,"tokens":[]}}'),
        );
        const hostile: MirrorClientObserver = {
            onRequestStart: () => {
                throw new Error("observer bug");
            },
            onRequestEnd: () => {
                throw new Error("observer bug");
            },
        };

        const info = await client(hostile).queryAccount("0.0.98");
        expect(info.accountId).toBe("0.0.98");
    });

    it("the withRetryOn404() view reports through the same observer", async () => {
        // The view is the same logical client to its consumer — telemetry
        // must not silently vanish when a caller opts into 404 retries.
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ok('{"account":"0.0.98","balance":{"balance":1,"tokens":[]}}'),
        );
        const { observer, starts, ends } = recordingObserver();

        await client(observer).withRetryOn404().queryAccount("0.0.98");

        expect(starts).toHaveLength(1);
        expect(ends).toHaveLength(1);
        expect(ends[0]).toMatchObject({ attempts: 1, status: 200 });
    });

    it("works unchanged when no observer is configured (zero-cost default)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ok('{"account":"0.0.98","balance":{"balance":1,"tokens":[]}}'),
        );
        const bare = new MirrorNodeClient(
            "https://testnet.mirrornode.hedera.com",
        );

        await expect(bare.queryAccount("0.0.98")).resolves.toBeDefined();
    });
});
