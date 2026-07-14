import type { EffectiveTimestampRange, MirrorKey } from "./common.js";

/**
 * Represents a topic on the Hiero consensus service (mirror node data).
 */
export interface MirrorTopic {
    /** Topic ID */
    topicId: string;
    /** Topic memo */
    memo?: string;
    /** Admin key (can update/delete the topic) */
    adminKey?: MirrorKey;
    /** Submit key (required to submit messages if set) */
    submitKey?: MirrorKey;
    /** Auto-renew account ID */
    autoRenewAccount?: string;
    /** Auto-renew period in seconds */
    autoRenewPeriod?: number;
    /** Creation timestamp */
    createdTimestamp?: string;
    /** Whether the topic is deleted */
    deleted: boolean;
}

/**
 * A message submitted to a topic (mirror node data).
 */
export interface MirrorTopicMessage {
    /** Topic ID */
    topicId: string;
    /** Sequence number of the message within the topic (string for precision) */
    sequenceNumber: string;
    /** Message contents (base64 encoded) */
    message: string;
    /** Running hash of topic messages */
    runningHash: string;
    /** Consensus timestamp */
    consensusTimestamp: string;
    /** Payer account ID */
    payerAccountId?: string;
    /** Chunk metadata when the message was split across transactions */
    chunkInfo?: ChunkInfo | null;
    /** Version of the running hash algorithm */
    runningHashVersion?: number;
}

/**
 * Chunk metadata for a multi-chunk topic message.
 */
export interface ChunkInfo {
    /** The transaction that started the chunked submission */
    initialTransactionId: {
        accountId: string | null;
        nonce: number | null;
        scheduled: boolean | null;
        transactionValidStart: string;
    } | null;
    /** This chunk's position (1-based) */
    number: number;
    /** Total number of chunks */
    total: number;
}

/**
 * Topic metadata from the mirror node (`/api/v1/topics/{id}`) — the
 * keyless read-side counterpart of core's `getTopicInfo` consensus query.
 */
export interface MirrorTopicInfo {
    /** Admin key, when the topic is mutable */
    adminKey?: MirrorKey;
    /** Auto-renew account, or null */
    autoRenewAccount: string | null;
    /** Auto-renew period in seconds, or null */
    autoRenewPeriod: number | null;
    /** When the topic was created, or null */
    createdTimestamp: string | null;
    /** Whether the topic is deleted, or null when unknown */
    deleted: boolean | null;
    /** Keys exempt from custom fees (HIP-991) */
    feeExemptKeyList?: MirrorKey[];
    /** Fee schedule key (HIP-991) */
    feeScheduleKey?: MirrorKey;
    /** When the custom-fee schedule was last set (HIP-991), if fees are configured */
    customFeesCreatedTimestamp?: string;
    /** Fixed custom fees for message submission (HIP-991) */
    fixedFees?: Array<{
        amount: number;
        collectorAccountId: string;
        denominatingTokenId: string | null;
    }>;
    /** Topic memo */
    memo: string;
    /** Submit key, when the topic is private */
    submitKey?: MirrorKey;
    /** Entity validity range; `to` is null while the topic is current */
    timestamp?: EffectiveTimestampRange;
    /** The topic's ID */
    topicId: string;
}
