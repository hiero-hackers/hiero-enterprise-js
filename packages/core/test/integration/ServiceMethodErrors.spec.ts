import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import type { HieroContext } from "../../src/context/index.js";
import { HieroError } from "../../src/errors/index.js";
import type { TransactionEvent } from "../../src/listeners/index.js";
import {
    METHOD_ENTRIES,
    createServices,
    isNone,
    rejectionOf,
    rootCause,
    type CallEnv,
    type MethodEntry,
    type MethodEvents,
    type Services,
} from "../utils/service-methods.js";

// Every service method with a network-rejected case in
// test/utils/service-methods.ts: its call names entities that don't exist
// or leaves out a signature, and the network rejects it.

type RejectedEntry = MethodEntry & { events: MethodEvents; reject: true };

const rejected = METHOD_ENTRIES.filter(
    (entry): entry is RejectedEntry =>
        entry.reject === true && !isNone(entry.events),
);

describe("service method network rejections [Integration]", () => {
    let context: HieroContext;
    let services: Services;
    let env: CallEnv;
    let before: TransactionEvent[];
    let after: TransactionEvent[];

    beforeAll(() => {
        context = setupIntegrationTestEnv();
        services = createServices(context);
        env = {
            client: context.client,
            operatorId: context.operatorAccountId!.toString(),
        };
        context.addTransactionListener({
            onBeforeTransaction: (event) => {
                before.push(event);
            },
            onAfterTransaction: (event) => {
                after.push(event);
            },
        });
    });

    beforeEach(() => {
        before = [];
        after = [];
    });

    afterAll(() => {
        context.close();
    });

    it.each(
        rejected.map((entry) => [`${entry.service}.${entry.method}`, entry]),
    )(
        "%s is rejected with a HieroError the after-event carries",
        async (_, entry) => {
            const error = await rejectionOf(() => entry.call(services, env));

            expect(error).toBeInstanceOf(HieroError);
            const hieroError = error as HieroError;
            expect(hieroError.code).toBe("SDK_ERROR");
            expect(hieroError.sdkStatus).toMatch(/^[A-Z_]+$/);
            expect(hieroError.sdkStatus).not.toBe("SUCCESS");
            expect(hieroError.context).toBe(
                `${entry.service}.${entry.events.methodName}`,
            );

            if (entry.events.kind !== "query") {
                expect(hieroError.transactionId).toMatch(/^0\.0\.\d+@/);
            }

            expect(before).toHaveLength(1);
            expect(after).toHaveLength(1);
            expect(after[0]).toMatchObject({
                type: entry.events.type,
                serviceName: entry.service,
                methodName: entry.events.methodName,
                error: rootCause(error),
            });
            expect(after[0].status).toBeUndefined();
        },
    );
});
