import { HieroError, HieroErrorCodes } from "../errors/index.js";

/**
 * Configuration for connecting to a Hiero network.
 *
 * The mirror node fields here are the ones the SDK uses itself (balances,
 * topic subscriptions). The `@hiero-hackers/enterprise-mirror` client has
 * its own `MirrorConfig`.
 */
export interface HieroConfig {
    /** Network to connect to (e.g., "testnet", "mainnet", "previewnet", or custom) */
    readonly network: string;
    /** Operator account ID (e.g., "0.0.12345") */
    readonly operatorId: string;
    /** Operator private key */
    readonly operatorKey: string;
    /** Type of the operator private key — required to correctly parse the key material */
    readonly operatorKeyType: string;
    /**
     * Consensus node addresses for custom networks.
     * Map of "host:port" → "accountId" (e.g., { "127.0.0.1:50211": "0.0.3" }).
     * Required for custom/local networks where node discovery is unavailable.
     */
    readonly networkNodes?: Record<string, string>;
    /**
     * Mirror node gRPC addresses for custom networks (e.g., ["localhost:5600"]).
     * Mainnet, testnet and previewnet already know theirs.
     */
    readonly mirrorNetwork?: string[];
    /**
     * Mirror node REST URL (e.g., "http://localhost:5551"). Balances are read
     * from it. Without it the SDK derives the URL from the mirror network,
     * using port 5551 for a local mirror node. A local mirror's rest-java
     * (8084) and web3 (8545) requests keep their own ports.
     */
    readonly mirrorNodeUrl?: string;
    /** Request timeout in milliseconds (default: 120000) */
    readonly requestTimeoutMs?: number;
    /** gRPC deadline in milliseconds (default: 10000) */
    readonly grpcDeadlineMs?: number;
    /** Max transaction submission attempts (default: 10) */
    readonly maxAttempts?: number;
    /** Minimum backoff in milliseconds (default: 250) */
    readonly minBackoffMs?: number;
    /** Maximum backoff in milliseconds (default: 8000) */
    readonly maxBackoffMs?: number;
}

const OPERATOR_KEY_TYPES = ["ed25519", "ecdsa", "der"];

/**
 * Resolve a HieroConfig from environment variables.
 *
 * Reads from:
 *   HIERO_NETWORK
 *   HIERO_OPERATOR_ID
 *   HIERO_OPERATOR_KEY
 *   HIERO_OPERATOR_KEY_TYPE
 *   HIERO_NETWORK_NODES
 *   HIERO_MIRROR_NETWORK
 *   HIERO_MIRROR_NODE_URL
 *   HIERO_REQUEST_TIMEOUT_MS
 *   HIERO_GRPC_DEADLINE_MS
 *   HIERO_MAX_ATTEMPTS
 *   HIERO_MIN_BACKOFF_MS
 *   HIERO_MAX_BACKOFF_MS
 *
 * @returns The resolved HieroConfig
 * @throws {HieroError} `CONFIG_INVALID` if there is no `process` (browsers,
 *   React Native), a required variable is missing,
 *   `HIERO_OPERATOR_KEY_TYPE` is not a known key type, a
 *   `HIERO_NETWORK_NODES` entry is malformed, or a numeric variable is not
 *   a positive number
 */
export function resolveConfigFromEnv(): HieroConfig {
    // Browsers and React Native have no `process`.
    if (globalThis.process === undefined) {
        throw new HieroError(
            "No environment variables to read the Hiero config from. " +
                "Pass a HieroConfig object instead, e.g. new HieroContext(config).",
            { code: HieroErrorCodes.ConfigInvalid },
        );
    }

    const env = globalThis.process.env;
    const network = env["HIERO_NETWORK"];
    const operatorId = env["HIERO_OPERATOR_ID"];
    const operatorKey = env["HIERO_OPERATOR_KEY"];
    const operatorKeyType = env["HIERO_OPERATOR_KEY_TYPE"]?.toLowerCase();
    const networkNodesRaw = env["HIERO_NETWORK_NODES"];

    if (!network || !operatorId || !operatorKey || !operatorKeyType) {
        const missing = [];
        if (!network)
            missing.push(
                "HIERO_NETWORK (e.g., 'testnet', 'mainnet', 'previewnet')",
            );
        if (!operatorId) missing.push("HIERO_OPERATOR_ID (e.g., '0.0.12345')");
        if (!operatorKey) missing.push("HIERO_OPERATOR_KEY (your private key)");
        if (!operatorKeyType)
            missing.push(
                "HIERO_OPERATOR_KEY_TYPE (one of: 'ed25519', 'ecdsa', 'der')",
            );
        throw new HieroError(
            `Missing required Hiero environment variables:\n  - ${missing.join("\n  - ")}\n\n` +
                `Set them in your process environment before application startup.`,
            { code: HieroErrorCodes.ConfigInvalid },
        );
    }

    if (!OPERATOR_KEY_TYPES.includes(operatorKeyType)) {
        throw new HieroError(
            `HIERO_OPERATOR_KEY_TYPE must be one of 'ed25519', 'ecdsa', 'der', got "${operatorKeyType}".`,
            { code: HieroErrorCodes.ConfigInvalid },
        );
    }

    // Parse HIERO_NETWORK_NODES: "host:port=accountId,host:port=accountId"
    let networkNodes: Record<string, string> | undefined;
    if (networkNodesRaw) {
        const parsed = new Map<string, string>();
        for (const entry of networkNodesRaw.split(",")) {
            const trimmed = entry.trim();
            if (!trimmed) continue;
            const [address, accountId] = trimmed.split("=");
            if (!address || !accountId) {
                throw new HieroError(
                    `HIERO_NETWORK_NODES entry "${trimmed}" is malformed. Expected "host:port=accountId".`,
                    { code: HieroErrorCodes.ConfigInvalid },
                );
            }
            parsed.set(address, accountId);
        }
        networkNodes = Object.fromEntries(parsed);
    }

    // Parse HIERO_MIRROR_NETWORK: "host:port,host:port"
    const mirrorNetwork = env["HIERO_MIRROR_NETWORK"]
        ?.split(",")
        .map((address) => address.trim())
        .filter((address) => address.length > 0);

    return {
        network,
        operatorId,
        operatorKey,
        operatorKeyType,
        networkNodes,
        mirrorNetwork: mirrorNetwork?.length ? mirrorNetwork : undefined,
        mirrorNodeUrl: env["HIERO_MIRROR_NODE_URL"] || undefined,
        requestTimeoutMs: positiveNumberFromEnv(
            "HIERO_REQUEST_TIMEOUT_MS",
            env["HIERO_REQUEST_TIMEOUT_MS"],
        ),
        grpcDeadlineMs: positiveNumberFromEnv(
            "HIERO_GRPC_DEADLINE_MS",
            env["HIERO_GRPC_DEADLINE_MS"],
        ),
        maxAttempts: positiveNumberFromEnv(
            "HIERO_MAX_ATTEMPTS",
            env["HIERO_MAX_ATTEMPTS"],
        ),
        minBackoffMs: positiveNumberFromEnv(
            "HIERO_MIN_BACKOFF_MS",
            env["HIERO_MIN_BACKOFF_MS"],
        ),
        maxBackoffMs: positiveNumberFromEnv(
            "HIERO_MAX_BACKOFF_MS",
            env["HIERO_MAX_BACKOFF_MS"],
        ),
    };
}

/**
 * Read a numeric environment variable. Returns `undefined` when unset or
 * empty, so the SDK default applies.
 */
function positiveNumberFromEnv(
    name: string,
    raw: string | undefined,
): number | undefined {
    if (raw === undefined || raw.trim() === "") return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new HieroError(
            `${name} must be a positive number, got "${raw}".`,
            {
                code: HieroErrorCodes.ConfigInvalid,
            },
        );
    }
    return value;
}

/**
 * Validates the environment and throws a HieroError explaining exactly what
 * is missing or invalid.
 */
export function assertEnvConfigValid(): void {
    resolveConfigFromEnv();
}
