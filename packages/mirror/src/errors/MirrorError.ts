/**
 * Machine-readable error codes for mirror node failures.
 */
export const MirrorErrorCodes = {
    ConfigInvalid: "CONFIG_INVALID",
    /**
     * The body arrived but is not JSON at all — distinct from
     * `MirrorNodeSchemaMismatch` (valid JSON, wrong shape) because the
     * usual culprit is different: a proxy or gateway answering with an
     * HTML error page. The error's `status` carries the HTTP status the
     * body came with, so a 200-with-HTML misconfiguration is diagnosable
     * from the error object alone.
     */
    MalformedResponse: "MALFORMED_RESPONSE",
    MirrorNodeError: "MIRROR_NODE_ERROR",
    MirrorNodeHttpError: "MIRROR_NODE_HTTP_ERROR",
    MirrorNodeSchemaMismatch: "MIRROR_NODE_SCHEMA_MISMATCH",
    NotFound: "NOT_FOUND",
    TimedOut: "TIMED_OUT",
} as const;

export type MirrorErrorCode =
    (typeof MirrorErrorCodes)[keyof typeof MirrorErrorCodes];

/**
 * Error thrown by the mirror node client and repositories.
 *
 * Deliberately distinct from core's `HieroError`: an `instanceof` check
 * tells you which subsystem (mirror REST vs. SDK) failed.
 */
export class MirrorError extends Error {
    /** Machine-readable error code */
    public readonly code: MirrorErrorCode;
    /** Operation context, e.g. the request path */
    public readonly context?: string;
    /**
     * HTTP status, when the failure was an HTTP response. Absent for config,
     * timeout, and schema errors, which never had one.
     *
     * For the common "does it exist?" case you rarely need this: a 404 is
     * thrown with {@link MirrorErrorCodes.NotFound}, and {@link orNull} turns
     * that rejection into `null`. `status` is for the rest — distinguishing a
     * 400 (bad request) from a 409 (conflict), logging, metrics — where the
     * alternative is parsing the number back out of `message`.
     */
    public readonly status?: number;
    /** The underlying error, when one was caught */
    public override readonly cause?: Error;

    constructor(
        message: string,
        options: {
            code?: MirrorErrorCode;
            context?: string;
            status?: number;
            cause?: Error;
        } = {},
    ) {
        super(message);
        this.name = "MirrorError";
        this.code = options.code ?? MirrorErrorCodes.MirrorNodeError;
        this.context = options.context;
        this.status = options.status;
        this.cause = options.cause;
    }
}

/**
 * Render a value for an error message, honestly and boundedly.
 *
 * - Strings keep their quotes (`JSON.stringify`), so `"42"` and `42` stay
 *   distinguishable in diagnostics, and are truncated at `maxLength` —
 *   a huge invalid input must never become a huge error message.
 * - Numbers go through `String()`: `JSON.stringify` would report
 *   `NaN`/`Infinity` as `"null"`, which sends readers hunting the wrong bug.
 * - `null` is reported as "null" — `typeof null` would claim "object".
 * - Everything else is described by its `typeof` — error messages never
 *   need (or want) the contents of an object or function.
 */
export function describeValue(value: unknown, maxLength = 40): string {
    if (typeof value === "string") {
        return value.length > maxLength
            ? `${JSON.stringify(value.slice(0, maxLength))}…`
            : JSON.stringify(value);
    }
    if (typeof value === "number") {
        return String(value);
    }
    // `typeof null` is the famously wrong "object" — a field that is
    // explicitly null must say so, or the diagnostic points at the
    // wrong shape entirely.
    if (value === null) {
        return "null";
    }
    return typeof value;
}

/**
 * Resolve a lookup to `null` when the entity does not exist, instead of
 * rejecting.
 *
 * Absence is a normal answer from a mirror node, not a failure: a caller
 * asking about an entity that may not exist usually wants `null`, not a
 * throw. Every "no such entity" rejection carries
 * {@link MirrorErrorCodes.NotFound} — whether it came back as an HTTP 404 or
 * as an empty listing — so this converts exactly those, and re-throws
 * everything else (timeouts, rate limits, schema mismatches) untouched.
 *
 * Composes with any repository method rather than each repository growing an
 * `…OrNull` twin:
 *
 * @example
 * const account = await orNull(accounts.findAccount("0.0.98"));
 * if (account === null) {
 *     // never existed (or not yet imported by this mirror node)
 * }
 */
export async function orNull<T>(lookup: Promise<T>): Promise<T | null> {
    try {
        return await lookup;
    } catch (err) {
        if (
            err instanceof MirrorError &&
            err.code === MirrorErrorCodes.NotFound
        ) {
            return null;
        }
        throw err;
    }
}
