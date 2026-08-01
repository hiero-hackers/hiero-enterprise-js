import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import {
    MirrorError,
    MirrorErrorCodes,
} from "../../../src/errors/MirrorError.js";
import type { MirrorRequestEndEvent } from "../../../src/client/MirrorClientObserver.js";

/**
 * A body that arrives but is not JSON — typically a proxy or gateway
 * answering with an HTML error page — must surface as a typed
 * `MirrorError` (`MalformedResponse`), not a bare `SyntaxError`: it is
 * the one transport failure that would otherwise escape the package's
 * typed-error contract.
 */
describe("MirrorNodeClient malformed response body", () => {
    let client: MirrorNodeClient;

    beforeEach(() => {
        client = new MirrorNodeClient("https://testnet.mirrornode.hedera.com");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const respondHtml = () =>
        vi.spyOn(globalThis, "fetch").mockImplementation(() =>
            Promise.resolve(
                new Response("<html><body>Bad Gateway</body></html>", {
                    // 200 on purpose: the classic misconfigured-gateway
                    // signature is an HTML error page with an OK status.
                    status: 200,
                    headers: { "Content-Type": "text/html" },
                }),
            ),
        );

    it("throws a typed MalformedResponse error carrying path and wire status", async () => {
        respondHtml();

        const rejection = client.queryAccount("0.0.2");
        await expect(rejection).rejects.toBeInstanceOf(MirrorError);
        await expect(rejection).rejects.toMatchObject({
            code: MirrorErrorCodes.MalformedResponse,
            status: 200,
            context: expect.stringContaining("/api/v1/accounts/0.0.2"),
        });
    });

    it("chains the underlying parse error as cause and does not retry", async () => {
        const fetchSpy = respondHtml();

        const error = await client.get("/api/v1/network/supply").then(
            () => {
                throw new Error("expected rejection");
            },
            (err: unknown) => err as MirrorError,
        );
        expect(error.cause).toBeInstanceOf(SyntaxError);
        // A malformed body is terminal — retrying cannot fix a broken
        // gateway, and must not multiply the requests against it.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("wraps a mid-body connection drop as a typed MirrorError", async () => {
        // undici surfaces a connection terminated during the body read as
        // `TypeError: terminated` from response.text() — it must leave
        // the transport typed, exactly like the same failure pre-body.
        const dropped = new ReadableStream({
            start(controller) {
                controller.error(new TypeError("terminated"));
            },
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(dropped, { status: 200 }),
        );

        const rejection = client.queryAccount("0.0.2");
        await expect(rejection).rejects.toBeInstanceOf(MirrorError);
        await expect(rejection).rejects.toMatchObject({
            code: MirrorErrorCodes.MirrorNodeError,
            status: 200,
            context: expect.stringContaining("/api/v1/accounts/0.0.2"),
            cause: expect.any(TypeError),
        });
    });

    it("keeps retrying when releasing a retryable response's body fails", async () => {
        // body.cancel() is a best-effort connection-reuse optimisation —
        // a stream that refuses to cancel must not abort the retry loop.
        const uncancelable = new ReadableStream({
            cancel() {
                throw new Error("cancel-boom");
            },
        });
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            // First attempt: 500 whose body refuses to cancel. Second
            // attempt: ordinary 500 (readable body), so the final
            // error-detail read terminates.
            .mockResolvedValueOnce(new Response(uncancelable, { status: 500 }))
            .mockResolvedValueOnce(new Response("oops", { status: 500 }));
        const retrying = new MirrorNodeClient(
            "https://testnet.mirrornode.hedera.com",
            { maxRetries: 1 },
        );

        await expect(retrying.queryAccount("0.0.2")).rejects.toMatchObject({
            code: MirrorErrorCodes.MirrorNodeHttpError,
        });
        // Both attempts happened: the cancel failure did not short-circuit.
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("reports the specific errorCode through the observer", async () => {
        respondHtml();
        const ends: MirrorRequestEndEvent[] = [];
        const observed = new MirrorNodeClient(
            "https://testnet.mirrornode.hedera.com",
            { observer: { onRequestEnd: (event) => ends.push(event) } },
        );

        await expect(observed.queryAccount("0.0.2")).rejects.toThrow(
            MirrorError,
        );
        expect(ends).toHaveLength(1);
        expect(ends[0].errorCode).toBe(MirrorErrorCodes.MalformedResponse);
        // The wire status the body arrived with is still reported.
        expect(ends[0].status).toBe(200);
    });
});
