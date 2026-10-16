import type { RangeFilter } from "../types/index.js";

/**
 * Pure helpers for building mirror node REST query strings. Kept separate
 * from the HTTP client so URL construction can be unit-tested in isolation
 * and reused by any endpoint method.
 */

/**
 * Percent-encode a value for safe interpolation into a URL **path
 * segment**. Callers pass entity IDs, hashes, serials and timestamps that
 * often originate from untrusted input (an HTTP route parameter, say).
 * Without encoding, a value like `../../network/nodes` or `0.0.7?limit=9`
 * would quietly resolve to a different endpoint or inject query params —
 * not a server-side hole (the mirror node is public and read-only), but a
 * footgun that breaks the caller's own `findByX(id)` contract. This is
 * ordinary client hygiene: `encodeURIComponent` escapes `/ ? # % &` and
 * whitespace while leaving ordinary IDs (`0.0.98`, `0x1a2b…`) untouched.
 */
export function segment(value: string | number): string {
    return encodeURIComponent(String(value));
}

/**
 * {@link segment} for a transaction ID, first rewriting the SDK's
 * `0.0.5@1700000000.000000123` form to the mirror node's
 * `0.0.5-1700000000-000000123`. Anything else (a mirror-format ID, an
 * ethereum hash, or an SDK ID with a `?scheduled` / `/nonce` suffix) passes
 * through unchanged.
 */
export function transactionIdSegment(transactionId: string): string {
    const sdkFormat = /^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/.exec(transactionId);
    return segment(
        sdkFormat
            ? `${sdkFormat[1]}-${sdkFormat[2]}-${sdkFormat[3]}`
            : transactionId,
    );
}

/** A value that can appear in a mirror node query parameter. */
export type QueryParamValue =
    string | number | boolean | RangeFilter | readonly (string | number)[];

/**
 * Append query params to a path, choosing `?` or `&` depending on whether
 * the path already has a query string. Absent (`undefined`) values are
 * omitted; a range object (e.g. a timestamp `{ gte, lt }`) expands to one
 * repeated `key=op:value` param per bound, and an array expands to one
 * repeated `key=value` param per element — both matching the mirror node
 * convention (repeated IDs return the union of the matches).
 */
export function appendQuery(
    path: string,
    params: Record<string, QueryParamValue | undefined>,
): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            // Discrete list: account.id=X&account.id=Y
            for (const element of value) {
                parts.push(`${key}=${encodeURIComponent(String(element))}`);
            }
        } else if (typeof value === "object") {
            // Range filter: { gte, lt, … } → timestamp=gte:X&timestamp=lt:Y
            for (const [op, bound] of Object.entries(value)) {
                if (bound === undefined) continue;
                parts.push(`${key}=${op}:${encodeURIComponent(String(bound))}`);
            }
        } else {
            parts.push(`${key}=${encodeURIComponent(String(value))}`);
        }
    }
    if (parts.length === 0) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}${parts.join("&")}`;
}
