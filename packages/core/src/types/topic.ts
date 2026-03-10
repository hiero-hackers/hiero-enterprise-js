/**
 * Represents a topic on the Hiero consensus service.
 */
export interface Topic {
    /** Topic ID */
    topicId: string;
    /** Topic memo */
    memo?: string;
    /** Admin key (can update/delete the topic) */
    adminKey?: string;
    /** Submit key (required to submit messages if set) */
    submitKey?: string;
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
 * A message submitted to a topic.
 */
export interface TopicMessage {
    /** Topic ID */
    topicId: string;
    /** Sequence number of the message within the topic */
    sequenceNumber: number;
    /** Message contents (base64 encoded) */
    message: string;
    /** Running hash of topic messages */
    runningHash: string;
    /** Consensus timestamp */
    consensusTimestamp: string;
    /** Payer account ID */
    payerAccountId?: string;
}
