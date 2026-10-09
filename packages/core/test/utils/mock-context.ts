import { vi } from "vitest";
import { AccountId, PrivateKey } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../src/context/index.js";

/**
 * Creates a mock HieroContext for unit testing service clients. The operator
 * ID and key are real SDK values; the client and listener hooks are fakes.
 */
export function createMockContext(): IHieroContext {
    return {
        client: {
            setOperator: vi.fn(),
            close: vi.fn(),
        },
        operatorAccountId: AccountId.fromString("0.0.2"),
        operatorPublicKey: PrivateKey.generateED25519().publicKey,
        signTransaction: vi
            .fn()
            .mockImplementation((tx) => Promise.resolve(tx)),
        emitBeforeTransaction: vi.fn().mockResolvedValue(undefined),
        emitAfterTransaction: vi.fn().mockResolvedValue(undefined),
        addTransactionListener: vi.fn(),
        removeTransactionListener: vi.fn(),
    } as unknown as IHieroContext;
}
