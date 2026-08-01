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
