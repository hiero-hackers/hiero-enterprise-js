import { describe, it, expect } from "vitest";
import { AccountId, Timestamp, TransactionId } from "@hiero-ledger/sdk";
import { resolveTransactionId } from "../../../../src/services/transaction/index.js";
import { HieroError } from "../../../../src/errors/index.js";

const FIXED_ID = "0.0.5@1700000000.000000123";

describe("resolveTransactionId", () => {
    it("returns undefined without a transactionId or payer", () => {
        expect(resolveTransactionId({})).toBeUndefined();
    });

    it("parses a full transaction ID string", () => {
        const id = resolveTransactionId({ transactionId: FIXED_ID });

        expect(id?.toString()).toBe(FIXED_ID);
    });

    it("accepts the string an SDK TransactionId prints", () => {
        const sdkId = TransactionId.withValidStart(
            AccountId.fromString("0.0.5"),
            new Timestamp(1700000000, 5),
        ).toString();

        const id = resolveTransactionId({ transactionId: sdkId });

        expect(id?.toString()).toBe(sdkId);
    });

    it("returns a TransactionId instance as-is", () => {
        const sdkId = TransactionId.fromString(FIXED_ID);

        expect(resolveTransactionId({ transactionId: sdkId })).toBe(sdkId);
    });

    it.each([
        ["a string", "0.0.5"],
        ["an AccountId", AccountId.fromString("0.0.5")],
    ])(
        "generates a recent valid start for a payer given as %s",
        (_label, payer) => {
            const before = Date.now();

            const id = resolveTransactionId({ payer });

            expect(id?.accountId?.toString()).toBe("0.0.5");
            // TransactionId.generate backdates the valid start by a few seconds.
            const validStartMs = id!.validStart!.toDate().getTime();
            expect(validStartMs).toBeGreaterThan(before - 60_000);
            expect(validStartMs).toBeLessThanOrEqual(Date.now());
        },
    );

    it("accepts regenerateTransactionId: false", () => {
        const id = resolveTransactionId({
            transactionId: FIXED_ID,
            regenerateTransactionId: false,
        });

        expect(id?.toString()).toBe(FIXED_ID);
    });

    it.each([
        ["an unparsable string", "abc"],
        ["an empty string", ""],
        ["an ID without a valid start", "0.0.5@"],
        ["an ID without nanos", "0.0.5@1700000000"],
        ["an ID with a non-numeric valid start", "0.0.5@abc.def"],
        ["an ID with a negative valid start", "0.0.5@-1.0"],
        ["an ID with unpadded nanos", "0.0.5@1700000000.5"],
        ["an ID with trailing text", `${FIXED_ID}x`],
        ["an ID with an unknown suffix", `${FIXED_ID}?foo`],
        ["a scheduled ID", `${FIXED_ID}?scheduled`],
        ["an ID with a nonce", `${FIXED_ID}/1`],
        ["a bare account ID (use payer)", "0.0.5"],
        ["an EVM address", "0x0000000000000000000000000000000000000005"],
    ])(
        "rejects transactionId %s with INPUT_INVALID",
        (_label, transactionId) => {
            let error: unknown;

            try {
                resolveTransactionId({ transactionId });
            } catch (e) {
                error = e;
            }

            expect(error).toBeInstanceOf(HieroError);
            expect(error).toMatchObject({
                code: "INPUT_INVALID",
                context: "TransactionExecutor",
            });
        },
    );

    it("points a bare account ID in transactionId to payer", () => {
        expect(() => resolveTransactionId({ transactionId: "0.0.5" })).toThrow(
            /use payer/,
        );
    });

    it.each([
        ["an unparsable string", "abc"],
        ["a full transaction ID", FIXED_ID],
        ["an EVM address", "0x0000000000000000000000000000000000000005"],
    ])("rejects payer %s with INPUT_INVALID", (_label, payer) => {
        expect(() => resolveTransactionId({ payer })).toThrow(
            expect.objectContaining({
                code: "INPUT_INVALID",
                context: "TransactionExecutor",
            }),
        );
    });

    it("rejects transactionId together with payer", () => {
        expect(() =>
            resolveTransactionId({ transactionId: FIXED_ID, payer: "0.0.6" }),
        ).toThrow("Set either transactionId or payer, not both");
    });

    it("rejects a scheduled TransactionId instance", () => {
        const id = TransactionId.fromString(FIXED_ID).setScheduled(true);

        expect(() => resolveTransactionId({ transactionId: id })).toThrow(
            "transactionId cannot carry a scheduled flag or a nonce.",
        );
    });

    it("rejects a TransactionId without a valid start", () => {
        const id = new TransactionId(AccountId.fromString("0.0.5"), null);

        expect(() => resolveTransactionId({ transactionId: id })).toThrow(
            "transactionId must have an account ID and a valid start.",
        );
    });

    it.each([
        ["transactionId", { transactionId: FIXED_ID }],
        ["payer", { payer: "0.0.5" }],
    ])(
        "rejects regenerateTransactionId: true together with %s",
        (_label, options) => {
            expect(() =>
                resolveTransactionId({
                    ...options,
                    regenerateTransactionId: true,
                }),
            ).toThrow(/regenerateTransactionId/);
        },
    );
});
