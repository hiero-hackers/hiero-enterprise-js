/**
 * Build a 200 JSON `Response` for mocking `fetch` in unit tests.
 */
export function jsonResponse(body: unknown): Response {
    return rawJsonResponse(JSON.stringify(body));
}

/**
 * Build a 200 JSON `Response` from RAW wire text — for tests that must not
 * round-trip the body through `JSON.stringify`/`JSON.parse` in the test
 * itself. The precision suite (#136) depends on this: the bug under test is
 * `JSON.parse` rounding integers past 2^53, so a fixture built from a
 * parsed object can never detect it.
 */
export function rawJsonResponse(rawText: string): Response {
    return new Response(rawText, {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
