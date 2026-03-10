/**
 * Represents a non-fungible token instance.
 */
export interface Nft {
    /** Token ID of the NFT collection */
    tokenId: string;
    /** Serial number within the collection */
    serialNumber: number;
    /** Current owner account ID */
    accountId: string;
    /** Metadata (base64 encoded or raw bytes) */
    metadata: string;
    /** Creation timestamp */
    createdTimestamp?: string;
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
