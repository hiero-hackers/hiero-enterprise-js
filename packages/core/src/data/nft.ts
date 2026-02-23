/**
 * Represents a non-fungible token instance.
 */
export interface Nft {
    /** Token ID of the NFT collection */
    readonly tokenId: string;
    /** Serial number within the collection */
    readonly serialNumber: number;
    /** Current owner account ID */
    readonly accountId: string;
    /** Metadata (base64 encoded or raw bytes) */
    readonly metadata: string;
    /** Creation timestamp */
    readonly createdTimestamp?: string;
    /** Whether this NFT has been deleted */
    readonly deleted: boolean;
    /** Account ID that approved a delegate spender */
    readonly delegatingSpender?: string;
    /** Account ID of the approved spender */
    readonly spender?: string;
}

/**
 * Metadata for creating an NFT collection (type).
 */
export interface NftMetadata {
    /** Collection name */
    readonly name: string;
    /** Collection symbol */
    readonly symbol: string;
    /** Maximum supply (0 = infinite) */
    readonly maxSupply?: number;
}
