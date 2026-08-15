import { MirrorError, MirrorErrorCodes } from "../errors/MirrorError.js";
import type { MirrorNodeClientOptions } from "../client/MirrorNodeClient.js";
import type { MirrorClientObserver } from "../client/MirrorClientObserver.js";
import { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Configuration for connecting to a mirror node. All fields are optional;
 * provide either a `network` name (URL auto-resolved) or an explicit
 * `mirrorNodeUrl`. Field names match the pre-split `HieroConfig` fields so
 * flat configs keep working unchanged.
 */
export interface MirrorConfig {
    /** Network name for URL auto-resolution (e.g. "mainnet", "testnet") */
    readonly network?: string;
    /** Mirror node base URL (takes priority over `network`) */
    readonly mirrorNodeUrl?: string;
    /** Request timeout in milliseconds (default: 10000) */
    readonly mirrorNodeTimeoutMs?: number;
    /** Max retries for 429/5xx/timeout responses (default: 3) */
    readonly mirrorNodeMaxRetries?: number;
    /**
     * Retry HTTP 404 as a transient "not yet indexed" signal for
     * freshly-created entities, reusing the retry/backoff budget
     * (default: false). Still resolves to `NotFound`/`null` when the
     * entity never appears.
     */
    readonly mirrorNodeRetryOn404?: boolean;
    /** Max concurrent requests (default: 25; `Infinity` disables) */
    readonly mirrorNodeMaxConcurrent?: number;
    /** Sustained request-rate ceiling in requests/second (default: unlimited) */
    readonly mirrorNodeMaxRequestsPerSecond?: number;
    /**
     * Read-only request-lifecycle telemetry — start/retry/end events for UI
     * loading indicators and status banners. Callbacks are error-isolated and
     * cannot affect requests. See {@link MirrorClientObserver}.
     *
     * Unprefixed, unlike the `mirrorNode*` fields above: those mirror the
     * pre-split `HieroConfig` names for flat-config compatibility, whereas this
     * is a new option with no legacy counterpart to match.
     */
    readonly observer?: MirrorClientObserver;
}

/**
 * Known network names and their public mirror node URLs.
 */
const MIRROR_NODE_URLS: Record<string, string> = {
    mainnet: "https://mainnet.mirrornode.hedera.com",
    testnet: "https://testnet.mirrornode.hedera.com",
    previewnet: "https://previewnet.mirrornode.hedera.com",
    "hedera-mainnet": "https://mainnet.mirrornode.hedera.com",
    "hedera-testnet": "https://testnet.mirrornode.hedera.com",
    "hedera-previewnet": "https://previewnet.mirrornode.hedera.com",
};

/**
 * Resolve the mirror node URL for a given network.
 *
 * @param network - Network name or custom URL
 * @param explicitUrl - Explicitly provided mirror node URL (takes priority)
 * @returns The mirror node base URL
 */
export function resolveMirrorNodeUrl(
    network: string,
    explicitUrl?: string,
): string {
    if (explicitUrl) {
        return explicitUrl;
    }
    const url = MIRROR_NODE_URLS[network.toLowerCase()];
    if (!url) {
        throw new MirrorError(
            `Unknown network "${network}". Provide a mirrorNodeUrl in the config.`,
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
    return url;
}

/**
 * Parse a numeric environment-variable value. Returns `undefined` when
 * unset or empty so the corresponding default applies. Passes malformed
 * values through as `NaN` so downstream validation surfaces the typo
 * rather than silently ignoring it. `"Infinity"` parses to `Infinity`.
 */
function numberFromEnv(raw: string | undefined): number | undefined {
    if (raw === undefined || raw.trim() === "") return undefined;
    return Number(raw);
}

/**
 * Parse a boolean environment-variable value. Returns `undefined` when
 * unset or empty so the corresponding default applies. Accepts
 * `"true"`/`"1"` and `"false"`/`"0"` (case-insensitive); anything else
 * throws `ConfigInvalid` so a typo (`"yes"`, `"ture"`) surfaces instead of
 * silently meaning `false` — the boolean counterpart of `numberFromEnv`
 * passing `NaN` through to downstream validation.
 */
function booleanFromEnv(
    name: string,
    raw: string | undefined,
): boolean | undefined {
    if (raw === undefined || raw.trim() === "") return undefined;
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    throw new MirrorError(
        `${name} must be "true", "false", "1", or "0", got "${raw}".`,
        { code: MirrorErrorCodes.ConfigInvalid },
    );
}

/**
 * Resolve a MirrorConfig from environment variables.
 *
 * Reads from (all optional):
 *   HIERO_NETWORK
 *   HIERO_MIRROR_NODE_URL
 *   HIERO_MIRROR_NODE_TIMEOUT_MS
 *   HIERO_MIRROR_NODE_MAX_RETRIES
 *   HIERO_MIRROR_NODE_RETRY_ON_404
 *   HIERO_MIRROR_NODE_MAX_CONCURRENT
 *   HIERO_MIRROR_NODE_MAX_REQUESTS_PER_SECOND
 */
export function mirrorConfigFromEnv(): MirrorConfig {
    return {
        network: process.env["HIERO_NETWORK"],
        mirrorNodeUrl: process.env["HIERO_MIRROR_NODE_URL"],
        mirrorNodeTimeoutMs: numberFromEnv(
            process.env["HIERO_MIRROR_NODE_TIMEOUT_MS"],
        ),
        mirrorNodeMaxRetries: numberFromEnv(
            process.env["HIERO_MIRROR_NODE_MAX_RETRIES"],
        ),
        mirrorNodeRetryOn404: booleanFromEnv(
            "HIERO_MIRROR_NODE_RETRY_ON_404",
            process.env["HIERO_MIRROR_NODE_RETRY_ON_404"],
        ),
        mirrorNodeMaxConcurrent: numberFromEnv(
            process.env["HIERO_MIRROR_NODE_MAX_CONCURRENT"],
        ),
        mirrorNodeMaxRequestsPerSecond: numberFromEnv(
            process.env["HIERO_MIRROR_NODE_MAX_REQUESTS_PER_SECOND"],
        ),
    };
}

/**
 * Build a {@link MirrorNodeClient} from a {@link MirrorConfig} (falling
 * back to environment variables when omitted).
 */
export function createMirrorNodeClient(
    config?: MirrorConfig,
): MirrorNodeClient {
    const resolved = config ?? mirrorConfigFromEnv();
    if (!resolved.network && !resolved.mirrorNodeUrl) {
        throw new MirrorError(
            'MirrorConfig must provide either "mirrorNodeUrl" or "network" ' +
                "(or set HIERO_MIRROR_NODE_URL / HIERO_NETWORK).",
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
    const baseUrl = resolveMirrorNodeUrl(
        resolved.network ?? "",
        resolved.mirrorNodeUrl,
    );
    const options: MirrorNodeClientOptions = {
        timeoutMs: resolved.mirrorNodeTimeoutMs,
        maxRetries: resolved.mirrorNodeMaxRetries,
        retryOn404: resolved.mirrorNodeRetryOn404,
        maxConcurrent: resolved.mirrorNodeMaxConcurrent,
        maxRequestsPerSecond: resolved.mirrorNodeMaxRequestsPerSecond,
        // Without this the #145 telemetry hook is unreachable through the
        // factory: `MirrorNodeClientOptions` accepts an observer, but a
        // caller passing one here had it silently dropped, so any UI needing
        // a loading indicator had to bypass `createMirrorNodeClient` and
        // construct `MirrorNodeClient` directly (#182).
        observer: resolved.observer,
    };
    return new MirrorNodeClient(baseUrl, options);
}
