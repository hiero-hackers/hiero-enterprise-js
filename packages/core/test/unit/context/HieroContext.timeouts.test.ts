import { describe, it, expect, vi, afterEach } from "vitest";
import { HieroContext } from "../../../src/context/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";

// Uses the real SDK Client: the SDK warns whenever the gRPC deadline is not
// below the request timeout, and only the real client shows that warning.

const config = {
    network: "testnet",
    operatorId: "0.0.2",
    operatorKey:
        "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
    operatorKeyType: OperatorKeyType.DER,
};

describe("HieroContext timeouts", () => {
    const contexts: HieroContext[] = [];
    const create = (overrides: object) => {
        const ctx = new HieroContext({ ...config, ...overrides });
        contexts.push(ctx);
        return ctx;
    };

    afterEach(() => {
        contexts.splice(0).forEach((ctx) => ctx.close());
        vi.restoreAllMocks();
    });

    it("applies grpcDeadlineMs", () => {
        const ctx = create({ grpcDeadlineMs: 2000 });

        expect(ctx.client.grpcDeadline).toBe(2000);
    });

    it("leaves the SDK default deadline when grpcDeadlineMs is unset", () => {
        const defaultDeadline = create({}).client.grpcDeadline;

        expect(create({ requestTimeoutMs: 60000 }).client.grpcDeadline).toBe(
            defaultDeadline,
        );
    });

    it.each([
        ["lowering both", { requestTimeoutMs: 5000, grpcDeadlineMs: 2000 }],
        ["raising both", { requestTimeoutMs: 300000, grpcDeadlineMs: 150000 }],
    ])("applies a valid pair without SDK warnings (%s)", (_, timeouts) => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const ctx = create(timeouts);

        expect(ctx.client.requestTimeout).toBe(timeouts.requestTimeoutMs);
        expect(ctx.client.grpcDeadline).toBe(timeouts.grpcDeadlineMs);
        expect(warn).not.toHaveBeenCalled();
    });

    it("still lets the SDK warn about an inverted pair", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        create({ requestTimeoutMs: 2000, grpcDeadlineMs: 5000 });

        expect(warn).toHaveBeenCalled();
    });
});
