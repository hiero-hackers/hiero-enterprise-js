import { describe, it, expect, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../src/client/MirrorNodeClient.js";
import { segment } from "../../src/utils/MirrorNodeQuery.js";
import { jsonResponse } from "../utils/http.js";

/**
 * Robustness / input-hygiene regressions for the mirror client.
 *
 * The mirror node is a public, keyless, read-only API, so these are not
 * server-side vulnerabilities — but a typed client shouldn't let a
 * caller-supplied path parameter (entity ID, hash, timestamp), which often
 * flows from an untrusted HTTP route param, escape its segment and quietly
 * resolve to a *different* endpoint or inject query parameters. That would
 * break the calling app's own `findByX(id)` contract. Path segments are
 * percent-encoded to prevent it. Separately, a stalled response body must
 * not hold a RequestGate slot open indefinitely — that one is squarely the
 * client's concern (slot starvation the server can't prevent for us).
 */
describe("security", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe("path-segment encoding", () => {
        let spy: ReturnType<typeof vi.spyOn>;
        const url = () => String(spy.mock.calls.at(-1)?.[0]);
        const mock = () => {
            spy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(jsonResponse({ account: "x" }));
        };

        it("contains path traversal to a single segment", async () => {
            mock();
            await new MirrorNodeClient("https://x")
                .queryAccount("../../network/nodes")
                .catch(() => {});
            expect(url()).toBe(
                "https://x/api/v1/accounts/..%2F..%2Fnetwork%2Fnodes",
            );
            expect(url()).not.toContain("/network/nodes");
        });

        it("neutralizes query-parameter injection via a path segment", async () => {
            mock();
            await new MirrorNodeClient("https://x")
                .queryTopic("0.0.7?limit=99999")
                .catch(() => {});
            expect(url()).toBe("https://x/api/v1/topics/0.0.7%3Flimit%3D99999");
            expect(url()).not.toContain("?limit=");
        });

        it("escapes spaces and fragments", async () => {
            mock();
            await new MirrorNodeClient("https://x")
                .queryTokenById("0.0.5 x#f")
                .catch(() => {});
            expect(url()).toBe("https://x/api/v1/tokens/0.0.5%20x%23f");
        });

        it("leaves legitimate IDs and EVM addresses untouched", async () => {
            mock();
            const client = new MirrorNodeClient("https://x");
            await client.queryAccount("0.0.98").catch(() => {});
            expect(url()).toBe("https://x/api/v1/accounts/0.0.98");
            await client
                .queryContract("0x000000000000000000000000000000000006f89a")
                .catch(() => {});
            expect(url()).toBe(
                "https://x/api/v1/contracts/0x000000000000000000000000000000000006f89a",
            );
        });

        it("segment() encodes path-hostile characters", () => {
            expect(segment("0.0.98")).toBe("0.0.98");
            expect(segment(123)).toBe("123");
            expect(segment("a/b?c#d e&f")).toBe("a%2Fb%3Fc%23d%20e%26f");
        });
    });

    describe("body-read timeout", () => {
        it("times out a response whose body never arrives", async () => {
            vi.useFakeTimers();
            vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: "OK",
                    headers: new Headers(),
                    // Body that never settles until the request is aborted.
                    // The client reads bodies via .text() (lossless parse).
                    text: () =>
                        new Promise((_, reject) => {
                            init?.signal?.addEventListener("abort", () =>
                                reject(
                                    Object.assign(new Error("aborted"), {
                                        name: "AbortError",
                                    }),
                                ),
                            );
                        }),
                } as unknown as Response),
            );

            const client = new MirrorNodeClient("https://x", {
                timeoutMs: 10,
                maxRetries: 0,
            });
            const promise = client.queryAccount("0.0.98");
            const assertion = expect(promise).rejects.toMatchObject({
                code: "TIMED_OUT",
            });
            await vi.advanceTimersByTimeAsync(50);
            await assertion;
        });
    });
});
