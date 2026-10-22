import type {
    EvmHookStorageUpdate,
    HookCreationDetails,
} from "@hiero-ledger/sdk";
import {
    EvmHookMappingEntries,
    EvmHookStorageSlot,
    HookExtensionPoint,
    Long,
} from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";

/** Largest EVM word, in bytes, for a storage key, value or mapping slot. */
const MAX_WORD_BYTES = 32;

/**
 * Validates hooks to create (HIP-1195): a supported extension point, a
 * non-negative hook ID unique within the list, and an EVM hook contract.
 *
 * @param context - Validator name used in the error context
 * @param field - Option name used in error messages
 * @param hooks - The hooks to validate, if any
 * @throws {HieroError} If a hook is invalid
 */
export function validateHookCreations(
    context: string,
    field: string,
    hooks: HookCreationDetails[] | undefined,
): void {
    if (hooks == null) return;

    const hookIds = new Set<string>();

    hooks.forEach((hook, index) => {
        const name = `${field}[${index}]`;

        if (hook.extensionPoint == null) {
            throw validationError(
                context,
                `${name}.extensionPoint is required.`,
            );
        }

        if (hook.extensionPoint !== HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK) {
            throw validationError(
                context,
                `${name}.extensionPoint must be HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK.`,
            );
        }

        if (hook.hookId == null) {
            throw validationError(context, `${name}.hookId is required.`);
        }

        if (hook.hookId.isNegative()) {
            throw validationError(
                context,
                `${name}.hookId must be a non-negative integer.`,
            );
        }

        if (hookIds.has(hook.hookId.toString())) {
            throw validationError(
                context,
                `${field} uses hookId ${hook.hookId.toString()} more than once.`,
            );
        }

        hookIds.add(hook.hookId.toString());

        if (hook.evmHook?.contractId == null) {
            throw validationError(
                context,
                `${name}.evmHook.contractId is required.`,
            );
        }

        validateStorageUpdates(
            context,
            `${name}.evmHook.storageUpdates`,
            hook.evmHook.storageUpdates,
        );
    });
}

/**
 * Validates hook IDs to delete: hook numbers (int64), so non-negative
 * integers.
 *
 * @throws {HieroError} If an ID is invalid
 */
export function validateHookIds(
    context: string,
    field: string,
    hookIds: (number | Long)[] | undefined,
): void {
    if (hookIds == null) return;

    hookIds.forEach((hookId, index) => {
        const valid = Long.isLong(hookId)
            ? !hookId.isNegative()
            : Number.isSafeInteger(hookId) && hookId >= 0;

        if (!valid) {
            throw validationError(
                context,
                `${field}[${index}] must be a non-negative integer.`,
            );
        }
    });
}

/**
 * Validates EVM hook storage updates per the proto: keys, values and mapping
 * slots are at most 32 bytes with no leading zero bytes; a mapping entry needs
 * a `key` or a `preimage` (any length). An empty value deletes the slot.
 *
 * @throws {HieroError} If an update is invalid
 */
export function validateStorageUpdates(
    context: string,
    field: string,
    updates: EvmHookStorageUpdate[],
): void {
    updates.forEach((update, index) => {
        const name = `${field}[${index}]`;

        if (update instanceof EvmHookStorageSlot) {
            validateWord(context, `${name}.key`, update.key);
            validateWord(context, `${name}.value`, update.value);

            return;
        }

        if (update instanceof EvmHookMappingEntries) {
            validateWord(context, `${name}.mappingSlot`, update.mappingSlot);

            (update.entries ?? []).forEach((entry, entryIndex) => {
                const entryName = `${name}.entries[${entryIndex}]`;

                if (entry.key == null && entry.preimage == null) {
                    throw validationError(
                        context,
                        `${entryName} needs a key or a preimage.`,
                    );
                }

                validateWord(context, `${entryName}.key`, entry.key);
                validateWord(context, `${entryName}.value`, entry.value);
            });

            return;
        }

        throw validationError(
            context,
            `${name} must be an EvmHookStorageSlot or EvmHookMappingEntries.`,
        );
    });
}

/** Checks a 32-byte EVM word is in minimal form. */
function validateWord(
    context: string,
    name: string,
    bytes: Uint8Array | null,
): void {
    if (bytes == null) return;

    if (bytes.length > MAX_WORD_BYTES) {
        throw validationError(
            context,
            `${name} must be at most ${MAX_WORD_BYTES} bytes (got ${bytes.length}).`,
        );
    }

    if (bytes.length > 0 && bytes[0] === 0) {
        throw validationError(
            context,
            `${name} must be minimal, with no leading zero bytes.`,
        );
    }
}
