/**
 * Represents a topic on the Hiero consensus service.
 */
export interface Topic {
    /** Topic ID */
    readonly topicId: string;
    /** Topic memo */
    readonly memo?: string;
    /** Admin key (can update/delete the topic) */
    readonly adminKey?: string;
    /** Submit key (required to submit messages if set) */
    readonly submitKey?: string;
    /** Auto-renew account ID */
    readonly autoRenewAccount?: string;
    /** Auto-renew period in seconds */
    readonly autoRenewPeriod?: number;
    /** Creation timestamp */
    readonly createdTimestamp?: string;
    /** Whether the topic is deleted */
    readonly deleted: boolean;
}

/**
 * A message submitted to a topic.
 */
export interface TopicMessage {
    /** Topic ID */
    readonly topicId: string;
    /** Sequence number of the message within the topic */
    readonly sequenceNumber: number;
    /** Message contents (base64 encoded) */
    readonly message: string;
    /** Running hash of topic messages */
    readonly runningHash: string;
    /** Consensus timestamp */
    readonly consensusTimestamp: string;
    /** Payer account ID */
    readonly payerAccountId?: string;
}
