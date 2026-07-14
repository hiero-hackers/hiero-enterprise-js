import type { EffectiveTimestampRange, MirrorKey } from "./common.js";

/**
 * A hook attached to an account (`/api/v1/accounts/{id}/hooks`) — an
 * extension point whose logic runs as contract bytecode.
 */
export interface Hook {
    /** The hook's admin key, if readable */
    adminKey?: MirrorKey;
    /** The contract entity holding the hook's executing bytecode */
    contractId: string | null;
    /** When the hook was created */
    createdTimestamp: string | null;
    /** Whether the hook has been deleted */
    deleted: boolean;
    /** The extension point this hook implements, e.g. `ACCOUNT_ALLOWANCE_HOOK` */
    extensionPoint: string;
    /** The hook's identifier within the owner's scope */
    hookId: number;
    /** The account that owns the hook */
    ownerId: string | null;
    /** Validity range; `to` is null while the hook is current */
    timestampRange: EffectiveTimestampRange;
    /** The hook implementation type, e.g. `EVM` */
    type: string;
}

/**
 * One storage slot of a hook
 * (`/api/v1/accounts/{id}/hooks/{hookId}/storage`).
 */
export interface HookStorageSlot {
    /** The hex encoded storage key */
    key: string;
    /** The hex encoded value, or null if none written */
    value: string | null;
    /** Consensus timestamp of the slot's last write */
    timestamp: string;
}
