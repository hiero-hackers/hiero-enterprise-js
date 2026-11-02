import { HieroContext } from "@hiero-hackers/enterprise-core";

/** Connection details the TCK sends with `setup`. */
export interface SessionNetwork {
    readonly nodeIp?: string;
    readonly nodeAccountId?: string;
    readonly mirrorNetworkIp?: string;
}

interface Session {
    network: SessionNetwork;
    context: HieroContext;
}

const sessions = new Map<string, Session>();
const DEFAULT = "default";

/**
 * Build a `HieroContext` for an operator. The TCK sends DER-encoded keys, so
 * the key type is always `der`. Without node details it targets testnet, as
 * the reference adapter does.
 */
function createContext(
    network: SessionNetwork,
    operatorAccountId: string,
    operatorPrivateKey: string,
): HieroContext {
    const local = network.nodeIp && network.nodeAccountId;

    return new HieroContext({
        network: local ? "local" : "testnet",
        operatorId: operatorAccountId,
        operatorKey: operatorPrivateKey,
        operatorKeyType: "der",
        networkNodes: local
            ? { [network.nodeIp!]: network.nodeAccountId! }
            : undefined,
        mirrorNetwork: network.mirrorNetworkIp
            ? [network.mirrorNetworkIp]
            : undefined,
        mirrorNodeUrl: process.env.MIRROR_NODE_REST_URL,
        requestTimeoutMs: 30_000,
    });
}

export function openSession(
    sessionId: string | undefined,
    network: SessionNetwork,
    operatorAccountId: string,
    operatorPrivateKey: string,
): boolean {
    const id = sessionId ?? DEFAULT;

    if (sessions.has(id)) return false;
    sessions.set(id, {
        network,
        context: createContext(network, operatorAccountId, operatorPrivateKey),
    });

    return true;
}

/** Core fixes the operator per context, so switching payer means a new one. */
export function replaceOperator(
    sessionId: string | undefined,
    operatorAccountId: string,
    operatorPrivateKey: string,
): void {
    const session = getSession(sessionId);
    session.context.close();
    session.context = createContext(
        session.network,
        operatorAccountId,
        operatorPrivateKey,
    );
}

export function closeSession(sessionId: string | undefined): void {
    const id = sessionId ?? DEFAULT;
    sessions.get(id)?.context.close();
    sessions.delete(id);
}

export function getSession(sessionId: string | undefined): Session {
    const session = sessions.get(sessionId ?? DEFAULT);

    if (!session) {
        throw new Error(
            `No client for session ${sessionId ?? DEFAULT}; call setup first.`,
        );
    }

    return session;
}

export function contextFor(sessionId: string | undefined): HieroContext {
    return getSession(sessionId).context;
}
