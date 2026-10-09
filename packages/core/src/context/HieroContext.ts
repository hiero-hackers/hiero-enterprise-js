import { HieroErrorCodes, HieroError } from "../errors/index.js";
import type { HttpTransport, Transaction } from "@hiero-ledger/sdk";
import {
    Client,
    AccountId,
    PrivateKey,
    DefaultHttpTransport,
    HttpRequest,
} from "@hiero-ledger/sdk";
import type { HieroConfig } from "../config/index.js";
import { resolveConfigFromEnv, assertEnvConfigValid } from "../config/index.js";
import { OperatorKeyType } from "../types/index.js";
import type {
    TransactionListener,
    TransactionEvent,
} from "../listeners/index.js";
import type { IHieroContext } from "./HieroContext.interface.js";

/**
 * Parse a private key string based on the specified key type.
 */
function parsePrivateKey(key: string, keyType: string): PrivateKey {
    switch (keyType) {
        case OperatorKeyType.ED25519:
            return PrivateKey.fromStringED25519(key);
        case OperatorKeyType.DER:
            return PrivateKey.fromStringDer(key);
        case OperatorKeyType.ECDSA:
            return PrivateKey.fromStringECDSA(key);
        default:
            throw new HieroError(
                `Invalid operatorKeyType: "${keyType}". Must be one of: "ed25519", "ecdsa", "der".`,
                { code: HieroErrorCodes.ConfigInvalid },
            );
    }
}

/**
 * Parse the origin of the mirror node REST URL (e.g., "http://localhost:5551").
 */
function parseMirrorNodeOrigin(url: string): string {
    let origin: string | undefined;
    try {
        origin = new URL(url).origin;
    } catch {
        // Reported below.
    }
    // "localhost:5551" parses as a URL with the opaque origin "null".
    if (!origin || origin === "null") {
        throw new HieroError(
            `Invalid mirrorNodeUrl "${url}". Expected a URL such as "http://localhost:5551".`,
            { code: HieroErrorCodes.ConfigInvalid },
        );
    }
    return origin;
}

/**
 * Report a listener error without affecting the outcome.
 */
function reportListenerError(
    hook: keyof TransactionListener,
    event: TransactionEvent,
    error: unknown,
): void {
    process.emitWarning(
        `${hook} listener threw for ${event.serviceName}.${event.methodName}: ${describeError(error)}`,
        { type: "HieroListenerWarning", code: "HIERO_LISTENER_ERROR" },
    );
}

/** Stringify a thrown value; listeners may throw values that cannot be. */
function describeError(error: unknown): string {
    try {
        return error instanceof Error ? String(error.message) : String(error);
    } catch {
        return "unprintable value";
    }
}

/**
 * Central context for interacting with a Hiero network.
 * Manages the SDK Client lifecycle and provides access to the operator account.
 *
 * This is NOT a singleton — create one instance per application lifecycle,
 * share it across requests, and call `close()` on shutdown.
 *
 * @example
 * ```ts
 * const ctx = new HieroContext({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' });
 * const client = ctx.client;
 * ```
 */
export class HieroContext implements IHieroContext {
    /** Registered transaction listeners */
    private readonly listeners: TransactionListener[] = [];

    /**
     * The operator private key. TypeScript `private readonly` is not enough:
     * it is still a plain property at runtime, so the key still leaks through
     * `console.log` and `util.inspect`. `#private` hides it.
     */
    readonly #operatorKey: PrivateKey;

    /** The underlying Hiero SDK Client */
    public readonly client: Client;

    /** A copy of the resolved configuration, with `operatorKey` redacted */
    public readonly config: HieroConfig;

    /** The operator account ID */
    public readonly operatorAccountId: AccountId;

    /** The transport created for `mirrorNodeUrl`; the SDK never closes it */
    private mirrorNodeTransport?: HttpTransport;

    constructor(config?: HieroConfig) {
        if (!config) {
            assertEnvConfigValid();
        }
        const resolved = config ?? resolveConfigFromEnv()!;
        this.config = { ...resolved, operatorKey: "[redacted]" };

        // Parse credentials before creating the client, so invalid config
        // never leaves an open client behind.
        try {
            this.operatorAccountId = AccountId.fromString(resolved.operatorId);
        } catch (cause) {
            throw new HieroError(
                `Invalid operator account ID "${resolved.operatorId}". Expected the form "0.0.12345".`,
                {
                    code: HieroErrorCodes.ConfigInvalid,
                    cause,
                },
            );
        }

        try {
            this.#operatorKey = parsePrivateKey(
                resolved.operatorKey,
                resolved.operatorKeyType,
            );
        } catch (cause) {
            throw new HieroError(
                `Invalid operator key. Ensure HIERO_OPERATOR_KEY is valid for type "${resolved.operatorKeyType}".`,
                {
                    code: HieroErrorCodes.ConfigInvalid,
                    cause,
                },
            );
        }

        const mirrorNodeOrigin = resolved.mirrorNodeUrl
            ? parseMirrorNodeOrigin(resolved.mirrorNodeUrl)
            : undefined;

        // Resolve network
        const network = resolved.network.toLowerCase();
        if (network === "mainnet" || network === "hedera-mainnet") {
            this.client = Client.forMainnet();
        } else if (network === "testnet" || network === "hedera-testnet") {
            this.client = Client.forTestnet();
        } else if (
            network === "previewnet" ||
            network === "hedera-previewnet"
        ) {
            this.client = Client.forPreviewnet();
        } else if (
            resolved.networkNodes &&
            Object.keys(resolved.networkNodes).length > 0
        ) {
            this.client = Client.forNetwork(resolved.networkNodes);
        } else {
            throw new HieroError(
                `Unknown network "${resolved.network}". Provide networkNodes (consensus node addresses) for custom networks ` +
                    `(e.g. via HIERO_NETWORK_NODES="127.0.0.1:50211=0.0.3").`,
                { code: HieroErrorCodes.ConfigInvalid },
            );
        }

        this.client.setOperator(this.operatorAccountId, this.#operatorKey);

        if (resolved.mirrorNetwork) {
            this.client.setMirrorNetwork(resolved.mirrorNetwork);
        }
        if (mirrorNodeOrigin) {
            this.useMirrorNodeOrigin(mirrorNodeOrigin);
        }

        // Apply SDK client tuning options
        this.applyTimeouts(resolved.requestTimeoutMs, resolved.grpcDeadlineMs);
        if (resolved.maxAttempts !== undefined) {
            this.client.setMaxAttempts(resolved.maxAttempts);
        }
        if (resolved.minBackoffMs !== undefined) {
            this.client.setMinBackoff(resolved.minBackoffMs);
        }
        if (resolved.maxBackoffMs !== undefined) {
            this.client.setMaxBackoff(resolved.maxBackoffMs);
        }
    }

    /**
     * The SDK warns when the gRPC deadline is not below the request timeout,
     * checking against the other value's current setting, so apply them in
     * the order that keeps a valid pair from warning.
     */
    private applyTimeouts(
        requestTimeoutMs: number | undefined,
        grpcDeadlineMs: number | undefined,
    ): void {
        const deadlineFirst =
            grpcDeadlineMs !== undefined &&
            grpcDeadlineMs < this.client.requestTimeout;

        if (deadlineFirst) {
            this.client.setGrpcDeadline(grpcDeadlineMs);
        }
        if (requestTimeoutMs !== undefined) {
            this.client.setRequestTimeout(requestTimeoutMs);
        }
        if (!deadlineFirst && grpcDeadlineMs !== undefined) {
            this.client.setGrpcDeadline(grpcDeadlineMs);
        }
    }

    /**
     * Send mirror REST calls to `origin`. The SDK derives the REST URL from
     * the mirror network and has no setting for it, so rewrite each request.
     */
    private useMirrorNodeOrigin(origin: string): void {
        const httpConfig = this.client.getMirrorNodeHttpConfig();
        const transport = DefaultHttpTransport.create(
            httpConfig.transportConfiguration,
        );
        this.mirrorNodeTransport = transport;

        this.client.setMirrorNodeHttpConfig({
            ...httpConfig,
            transport: {
                roundTrip: (request, signal) => {
                    const { pathname, search } = new URL(request.url);
                    return transport.roundTrip(
                        new HttpRequest({
                            ...request,
                            url: origin + pathname + search,
                        }),
                        signal,
                    );
                },
                close: (closeTimeout) => transport.close(closeTimeout),
            },
        });
    }

    /**
     * Get the operator's public key (safe to expose).
     */
    public get operatorPublicKey() {
        return this.#operatorKey.publicKey;
    }

    /**
     * Sign a transaction with the operator key.
     * Use this instead of accessing the private key directly.
     */
    public async signTransaction<T extends Transaction>(tx: T): Promise<T> {
        return tx.sign(this.#operatorKey);
    }

    /**
     * Close the SDK client and release resources.
     */
    public close(): void {
        this.client.close();
        void this.mirrorNodeTransport?.close();
    }

    // Transaction Listener Management
    // Allows services to emit transaction lifecycle events to registered listeners
    // (e.g., for logging, metrics, etc.)

    /**
     * Register a transaction listener.
     *
     * @param listener - Listener to register
     */
    public addTransactionListener(listener: TransactionListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a previously registered transaction listener.
     *
     * @param listener - Listener to remove
     */
    public removeTransactionListener(listener: TransactionListener): void {
        const idx = this.listeners.indexOf(listener);
        if (idx !== -1) {
            this.listeners.splice(idx, 1);
        }
    }

    /**
     * Emit a before-transaction event to all registered listeners.
     * Called internally by service clients before executing a transaction.
     * Never throws: a listener error is reported as a warning and the
     * remaining listeners still run.
     *
     * @param event - The transaction event
     */
    public async emitBeforeTransaction(event: TransactionEvent): Promise<void> {
        for (const listener of this.listeners) {
            if (!listener.onBeforeTransaction) continue;
            try {
                await listener.onBeforeTransaction(event);
            } catch (error) {
                reportListenerError("onBeforeTransaction", event, error);
            }
        }
    }

    /**
     * Emit an after-transaction event to all registered listeners.
     * Called internally by service clients after a transaction completes.
     * Never throws: a listener error is reported as a warning and the
     * remaining listeners still run.
     *
     * @param event - The transaction event (includes result/error/duration)
     */
    public async emitAfterTransaction(event: TransactionEvent): Promise<void> {
        for (const listener of this.listeners) {
            if (!listener.onAfterTransaction) continue;
            try {
                await listener.onAfterTransaction(event);
            } catch (error) {
                reportListenerError("onAfterTransaction", event, error);
            }
        }
    }
}
