import { describe, it, expect } from "vitest";
import { EvmHookStorageSlot, Long } from "@hiero-ledger/sdk";
import { HookStoreValidator } from "../../../../../src/services/contract/validation/index.js";
import type { HookStoreOperationOptions } from "../../../../../src/services/contract/operations/index.js";

const slot = new EvmHookStorageSlot({
    key: new Uint8Array([0x01]),
    value: new Uint8Array([0x2a]),
});

const invalid = (message: string) =>
    expect.objectContaining({
        code: "INPUT_INVALID",
        context: "HookStoreValidator",
        message: expect.stringContaining(message),
    });

describe("HookStoreValidator", () => {
    const validator = new HookStoreValidator();
    const validate = (options: Partial<HookStoreOperationOptions>) => () =>
        validator.validate({
            hookId: 1,
            storageUpdates: [slot],
            ...options,
        } as HookStoreOperationOptions);

    describe("owner", () => {
        it("passes with an account or a contract owner", () => {
            expect(validate({ accountId: "0.0.1234" })).not.toThrow();
            expect(validate({ contractId: "0.0.5678" })).not.toThrow();
        });

        it("throws when both owners are given", () => {
            expect(
                validate({ accountId: "0.0.1234", contractId: "0.0.5678" }),
            ).toThrow(invalid("either accountId or contractId"));
        });

        it("throws when no owner is given", () => {
            expect(validate({})).toThrow(invalid("A hook owner is required"));
        });

        it("throws on an empty owner ID", () => {
            expect(validate({ accountId: " " })).toThrow(
                invalid("accountId cannot be empty"),
            );
            expect(validate({ contractId: "" })).toThrow(
                invalid("contractId cannot be empty"),
            );
        });
    });

    describe("hookId", () => {
        it("passes with zero and a Long", () => {
            expect(
                validate({ accountId: "0.0.1234", hookId: 0 }),
            ).not.toThrow();
            expect(
                validate({ accountId: "0.0.1234", hookId: Long.MAX_VALUE }),
            ).not.toThrow();
        });

        it("throws when missing", () => {
            expect(
                validate({
                    accountId: "0.0.1234",
                    hookId: undefined as unknown as number,
                }),
            ).toThrow(invalid("hookId is required"));
        });

        it("throws on a negative or fractional hook ID", () => {
            expect(validate({ accountId: "0.0.1234", hookId: -1 })).toThrow(
                invalid("hookId must be a non-negative integer"),
            );
            expect(validate({ accountId: "0.0.1234", hookId: 1.5 })).toThrow(
                invalid("hookId must be a non-negative integer"),
            );
        });
    });

    describe("storageUpdates", () => {
        it("throws when empty or missing", () => {
            expect(
                validate({ accountId: "0.0.1234", storageUpdates: [] }),
            ).toThrow(invalid("storageUpdates must contain at least one"));
            expect(
                validate({
                    accountId: "0.0.1234",
                    storageUpdates: undefined,
                }),
            ).toThrow(invalid("storageUpdates must contain at least one"));
        });

        it("throws on a slot that breaks the word rules", () => {
            const padded = new EvmHookStorageSlot({
                key: new Uint8Array([0x00, 0x01]),
            });

            expect(
                validate({ accountId: "0.0.1234", storageUpdates: [padded] }),
            ).toThrow(invalid("storageUpdates[0].key must be minimal"));
        });
    });
});
