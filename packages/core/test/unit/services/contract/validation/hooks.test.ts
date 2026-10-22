import { describe, it, expect } from "vitest";
import {
    ContractId,
    EvmHook,
    EvmHookMappingEntries,
    EvmHookMappingEntry,
    EvmHookStorageSlot,
    EvmHookStorageUpdate,
    HookCreationDetails,
    HookExtensionPoint,
    Long,
    PrivateKey,
} from "@hiero-ledger/sdk";
import {
    validateHookCreations,
    validateHookIds,
    validateStorageUpdates,
} from "../../../../../src/services/contract/validation/hooks.js";

const contractId = ContractId.fromString("0.0.1234");

const hook = (hookId: number, storageUpdates: EvmHookStorageUpdate[] = []) =>
    new HookCreationDetails({
        extensionPoint: HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK,
        hookId,
        evmHook: new EvmHook({ contractId, storageUpdates }),
    });

const invalid = (message: string) =>
    expect.objectContaining({
        code: "INPUT_INVALID",
        context: "TestValidator",
        message: expect.stringContaining(message),
    });

describe("validateHookCreations", () => {
    const validate = (hooks: HookCreationDetails[] | undefined) => () =>
        validateHookCreations("TestValidator", "hooks", hooks);

    it("passes when hooks are omitted or empty", () => {
        expect(validate(undefined)).not.toThrow();
        expect(validate([])).not.toThrow();
    });

    it("passes with valid hooks and an optional admin key", () => {
        const withAdminKey = hook(2).setAdminKey(
            PrivateKey.generateED25519().publicKey,
        );

        expect(validate([hook(0), hook(1), withAdminKey])).not.toThrow();
    });

    it("throws without an extension point", () => {
        const details = new HookCreationDetails({
            hookId: 1,
            evmHook: new EvmHook({ contractId }),
        });

        expect(validate([details])).toThrow(
            invalid("hooks[0].extensionPoint is required"),
        );
    });

    it("throws on an unknown extension point", () => {
        const details = hook(1).setExtensionPoint(
            7 as unknown as HookExtensionPoint,
        );

        expect(validate([details])).toThrow(
            invalid("must be HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK"),
        );
    });

    it("throws without a hook ID", () => {
        const details = new HookCreationDetails({
            extensionPoint: HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK,
            evmHook: new EvmHook({ contractId }),
        });

        expect(validate([details])).toThrow(
            invalid("hooks[0].hookId is required"),
        );
    });

    it("throws on a negative hook ID", () => {
        expect(validate([hook(-1)])).toThrow(
            invalid("hooks[0].hookId must be a non-negative integer"),
        );
    });

    it("throws on a hook ID used twice", () => {
        expect(validate([hook(3), hook(3)])).toThrow(
            invalid("uses hookId 3 more than once"),
        );
    });

    it("throws without an EVM hook contract", () => {
        const noEvmHook = new HookCreationDetails({
            extensionPoint: HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK,
            hookId: 1,
        });
        const noContract = hook(1).setEvmHook(new EvmHook());

        expect(validate([noEvmHook])).toThrow(
            invalid("hooks[0].evmHook.contractId is required"),
        );
        expect(validate([noContract])).toThrow(
            invalid("hooks[0].evmHook.contractId is required"),
        );
    });

    it("checks the initial storage updates", () => {
        const slot = new EvmHookStorageSlot({
            key: new Uint8Array([0, 1]),
        });

        expect(validate([hook(1, [slot])])).toThrow(
            invalid("hooks[0].evmHook.storageUpdates[0].key must be minimal"),
        );
    });
});

describe("validateHookIds", () => {
    const validate = (hookIds: (number | Long)[] | undefined) => () =>
        validateHookIds("TestValidator", "hooksToDelete", hookIds);

    it("passes with non-negative integers and Longs", () => {
        expect(validate(undefined)).not.toThrow();
        expect(validate([0, 5, Long.MAX_VALUE])).not.toThrow();
    });

    it("throws on a negative ID", () => {
        expect(validate([1, -1])).toThrow(
            invalid("hooksToDelete[1] must be a non-negative integer"),
        );
        expect(validate([Long.fromInt(-1)])).toThrow(
            invalid("hooksToDelete[0] must be a non-negative integer"),
        );
    });

    it("throws on a fractional ID", () => {
        expect(validate([1.5])).toThrow(
            invalid("hooksToDelete[0] must be a non-negative integer"),
        );
    });
});

describe("validateStorageUpdates", () => {
    const validate = (updates: EvmHookStorageUpdate[]) => () =>
        validateStorageUpdates("TestValidator", "storageUpdates", updates);
    const bytes = (length: number) => new Uint8Array(length).fill(1);

    it("passes with 32-byte words, empty values and long preimages", () => {
        const slot = new EvmHookStorageSlot({
            key: bytes(32),
            value: bytes(32),
        });
        const deletion = new EvmHookStorageSlot({ key: bytes(1) });
        const mapping = new EvmHookMappingEntries({
            mappingSlot: bytes(1),
            entries: [
                new EvmHookMappingEntry({ key: bytes(32), value: bytes(1) }),
                new EvmHookMappingEntry({ preimage: new Uint8Array(100) }),
            ],
        });

        expect(validate([slot, deletion, mapping])).not.toThrow();
    });

    it("throws on a slot key or value over 32 bytes", () => {
        expect(validate([new EvmHookStorageSlot({ key: bytes(33) })])).toThrow(
            invalid("storageUpdates[0].key must be at most 32 bytes (got 33)"),
        );
        expect(
            validate([
                new EvmHookStorageSlot({ key: bytes(1), value: bytes(33) }),
            ]),
        ).toThrow(invalid("storageUpdates[0].value must be at most 32 bytes"));
    });

    it("throws on a slot key or value with a leading zero byte", () => {
        expect(
            validate([new EvmHookStorageSlot({ key: new Uint8Array([0, 1]) })]),
        ).toThrow(invalid("storageUpdates[0].key must be minimal"));
        expect(
            validate([
                new EvmHookStorageSlot({
                    key: bytes(1),
                    value: new Uint8Array([0]),
                }),
            ]),
        ).toThrow(invalid("storageUpdates[0].value must be minimal"));
    });

    it("throws on a mapping slot that is not a minimal word", () => {
        const mapping = new EvmHookMappingEntries({
            mappingSlot: new Uint8Array([0, 2]),
            entries: [],
        });

        expect(validate([mapping])).toThrow(
            invalid("storageUpdates[0].mappingSlot must be minimal"),
        );
    });

    it("throws on a mapping entry without a key or preimage", () => {
        const mapping = new EvmHookMappingEntries({
            mappingSlot: bytes(1),
            entries: [new EvmHookMappingEntry({ value: bytes(1) })],
        });

        expect(validate([mapping])).toThrow(
            invalid("storageUpdates[0].entries[0] needs a key or a preimage"),
        );
    });

    it("throws on a mapping entry key or value that is not a minimal word", () => {
        const badKey = new EvmHookMappingEntries({
            mappingSlot: bytes(1),
            entries: [new EvmHookMappingEntry({ key: bytes(33) })],
        });
        const badValue = new EvmHookMappingEntries({
            mappingSlot: bytes(1),
            entries: [
                new EvmHookMappingEntry({
                    key: bytes(1),
                    value: new Uint8Array([0, 1]),
                }),
            ],
        });

        expect(validate([badKey])).toThrow(
            invalid("storageUpdates[0].entries[0].key must be at most 32"),
        );
        expect(validate([badValue])).toThrow(
            invalid("storageUpdates[0].entries[0].value must be minimal"),
        );
    });

    it("throws on an unknown update type", () => {
        expect(validate([new EvmHookStorageUpdate()])).toThrow(
            invalid(
                "storageUpdates[0] must be an EvmHookStorageSlot or EvmHookMappingEntries",
            ),
        );
    });
});
