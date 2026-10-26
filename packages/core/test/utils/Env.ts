import { HieroContext } from "../../src/context/index.js";

export const IntegrationTracker = {
    lastTransactionId: "" as string | undefined,
};

/**
 * Sleep for `ms` milliseconds. Used by mirror-node subscribe specs to
 * absorb the importer's ingest lag between consensus-node acceptance
 * and mirror-gRPC visibility (mirrors the SDK's own `src/util.js#wait`).
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupIntegrationTestEnv(): HieroContext {
    const ctx = new HieroContext();

    // Attach tracker to automatically hook the generated ID
    ctx.addTransactionListener({
        onAfterTransaction: (event) => {
            if (event.transactionId) {
                IntegrationTracker.lastTransactionId = event.transactionId;
            }
        },
    });

    return ctx;
}
