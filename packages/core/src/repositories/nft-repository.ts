import type { Nft, Page } from "../data/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";

/**
 * Repository for querying NFT data from the mirror node.
 */
export class NftRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find all NFTs owned by an account.
     */
    async findByOwner(accountId: string): Promise<Page<Nft>> {
        return this.mirrorNodeClient.queryNftsByAccount(accountId);
    }

    /**
     * Find all NFTs of a specific token type.
     */
    async findByType(tokenId: string): Promise<Page<Nft>> {
        return this.mirrorNodeClient.queryNftsByTokenId(tokenId);
    }

    /**
     * Find a specific NFT by token ID and serial number.
     */
    async findBySerial(tokenId: string, serialNumber: number): Promise<Nft> {
        return this.mirrorNodeClient.queryNftsByTokenIdAndSerial(
            tokenId,
            serialNumber,
        );
    }

    /**
     * Find NFTs owned by an account for a specific token type.
     */
    async findByOwnerAndType(
        accountId: string,
        tokenId: string,
    ): Promise<Page<Nft>> {
        return this.mirrorNodeClient.queryNftsByAccountAndTokenId(
            accountId,
            tokenId,
        );
    }
}
