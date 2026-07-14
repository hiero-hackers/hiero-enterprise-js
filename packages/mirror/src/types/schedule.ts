import type { EffectiveTimestampRange, MirrorKey } from "./common.js";

/**
 * A signature collected on a scheduled transaction.
 */
export interface ScheduleSignature {
    /** When the signature was added */
    consensusTimestamp: string;
    /** Public key prefix (base64) */
    publicKeyPrefix: string;
    /** Signature bytes (base64) */
    signature: string;
    /** Signature type, e.g. "ED25519" */
    type: string;
}

/**
 * A scheduled transaction's state from the mirror node — the read-side
 * counterpart of core's `ScheduleService`.
 */
export interface MirrorSchedule {
    /** Admin key, when the schedule is cancellable */
    adminKey?: MirrorKey;
    /** When the schedule was created */
    consensusTimestamp: string;
    /** Account that created the schedule */
    creatorAccountId: string;
    /** Whether the schedule was deleted (cancelled) */
    deleted: boolean;
    /** When the inner transaction executed, or null while pending */
    executedTimestamp: string | null;
    /** When the schedule expires, or null */
    expirationTime: string | null;
    /** Schedule memo */
    memo: string;
    /** Account that pays for the inner transaction */
    payerAccountId: string;
    /** The schedule's ID */
    scheduleId: string;
    /** Signatures collected so far */
    signatures: ScheduleSignature[];
    /** The serialized inner transaction (base64) */
    transactionBody: string;
    /** Whether execution waits for the expiration time */
    waitForExpiry: boolean;
}
export type { EffectiveTimestampRange };
