/**
 * Represents a non-fungible token instance.
 */
export interface Nft {
    /** Token ID of the NFT collection */
    tokenId: string;
    /** Serial number within the collection */
    serialNumber: number;
    /** Current owner account ID, or null for burned/deleted serials */
    accountId: string | null;
    /** Metadata (base64 encoded or raw bytes) */
    metadata: string;
    /** Creation timestamp */
    createdTimestamp?: string;
    /** When the NFT last changed (transfer, approval, burn) */
    modifiedTimestamp?: string | null;
    /** Whether this NFT has been deleted */
    deleted: boolean;
    /** Account ID that approved a delegate spender */
    delegatingSpender?: string;
    /** Account ID of the approved spender */
    spender?: string;
}

/**
 * Metadata for creating an NFT collection (type).
 */
export interface NftMetadata {
    /** Collection name */
    name: string;
    /** Collection symbol */
    symbol: string;
    /** Maximum supply (0 = infinite) */
    maxSupply?: number;
}

/**
 * One entry in an NFT's transaction history
 * (`/api/v1/tokens/{id}/nfts/{serial}/transactions`) — provenance for a
 * single serial.
 */
export interface NftTransaction {
    /** When the transaction reached consensus */
    consensusTimestamp: string;
    /** Whether the transfer used an allowance */
    isApproval?: boolean;
    /** Transaction nonce */
    nonce?: number;
    /** Receiving account, or null on burn */
    receiverAccountId: string | null;
    /** Sending account, or null on mint */
    senderAccountId: string | null;
    /** The transaction's ID */
    transactionId: string;
    /** Transaction type, e.g. "CRYPTOTRANSFER", "TOKENMINT" */
    type: string;
}
