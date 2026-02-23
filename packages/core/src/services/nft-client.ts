import {
    TokenCreateTransaction,
    TokenType,
    TokenAssociateTransaction,
    TokenDissociateTransaction,
    TokenMintTransaction,
    TokenBurnTransaction,
    TransferTransaction,
    NftId,
    TokenId,
    PrivateKey,
    TokenSupplyType,
} from "@hashgraph/sdk";
import type { HieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/**
 * Options for creating an NFT collection.
 */
export interface CreateNftTypeOptions {
    /** Collection name */
    name: string;
    /** Collection symbol */
    symbol: string;
    /** Maximum number of NFTs (default: unlimited) */
    maxSupply?: number;
    /** Treasury account ID (defaults to operator) */
    treasuryAccountId?: string;
    /** Treasury account private key */
    treasuryKey?: string;
    /** Supply key (defaults to operator key) */
    supplyKey?: string;
    /** Admin key (defaults to operator key) */
    adminKey?: string;
    /** Collection memo */
    memo?: string;
}

/**
 * Service for managing non-fungible tokens on the Hiero network (HTS).
 */
export class NftClient {
    private readonly context: HieroContext;

    constructor(context: HieroContext) {
        this.context = context;
    }

    private createEvent(type: string, methodName: string): TransactionEvent {
        return {
            type,
            serviceName: "NftClient",
            methodName,
            timestamp: new Date(),
        };
    }

    /**
     * Create a new NFT collection (token type).
     *
     * @param options - NFT type creation options
     * @returns The token ID of the created NFT type
     */
    async createNftType(options: CreateNftTypeOptions): Promise<string> {
        const event = this.createEvent("NftCreate", "createNftType");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const supplyKey = options.supplyKey
                ? PrivateKey.fromString(options.supplyKey)
                : this.context.operatorKey;
            const adminKey = options.adminKey
                ? PrivateKey.fromString(options.adminKey)
                : this.context.operatorKey;

            const tx = new TokenCreateTransaction()
                .setTokenName(options.name)
                .setTokenSymbol(options.symbol)
                .setTokenType(TokenType.NonFungibleUnique)
                .setDecimals(0)
                .setInitialSupply(0)
                .setTreasuryAccountId(
                    options.treasuryAccountId ??
                        this.context.operatorAccountId.toString(),
                )
                .setSupplyKey(supplyKey.publicKey)
                .setAdminKey(adminKey.publicKey);

            if (options.maxSupply !== undefined && options.maxSupply > 0) {
                tx.setMaxSupply(options.maxSupply);
                tx.setSupplyType(TokenSupplyType.Finite);
            }
            if (options.memo) {
                tx.setTokenMemo(options.memo);
            }

            let frozenTx = tx.freezeWith(this.context.client);
            if (options.treasuryKey) {
                frozenTx = await frozenTx.sign(
                    PrivateKey.fromString(options.treasuryKey),
                );
            }

            const response = await frozenTx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const tokenId = receipt.tokenId!.toString();

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return tokenId;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.createNftType");
        }
    }

    /**
     * Associate an NFT type with an account.
     */
    async associateNft(
        tokenId: string,
        accountId: string,
        accountKey: string,
    ): Promise<void> {
        const event = this.createEvent("NftAssociate", "associateNft");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = PrivateKey.fromString(accountKey);
            const tx = new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.associateNft");
        }
    }

    /**
     * Dissociate an NFT type from an account.
     */
    async dissociateNft(
        tokenId: string,
        accountId: string,
        accountKey: string,
    ): Promise<void> {
        const event = this.createEvent("NftDissociate", "dissociateNft");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = PrivateKey.fromString(accountKey);
            const tx = new TokenDissociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.dissociateNft");
        }
    }

    /**
     * Mint a single NFT.
     *
     * @param tokenId - The NFT collection
     * @param metadata - NFT metadata as bytes
     * @param supplyKey - Supply key (defaults to operator)
     * @returns Serial number of the minted NFT
     */
    async mintNft(
        tokenId: string,
        metadata: Uint8Array,
        supplyKey?: string,
    ): Promise<number> {
        const event = this.createEvent("NftMint", "mintNft");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = supplyKey
                ? PrivateKey.fromString(supplyKey)
                : this.context.operatorKey;
            const tx = new TokenMintTransaction()
                .setTokenId(tokenId)
                .addMetadata(metadata)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const serial = receipt.serials[0].toNumber();

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return serial;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.mintNft");
        }
    }

    /**
     * Mint multiple NFTs in a single transaction.
     *
     * @param tokenId - The NFT collection
     * @param metadataList - Array of metadata bytes
     * @param supplyKey - Supply key (defaults to operator)
     * @returns Array of serial numbers
     */
    async mintNfts(
        tokenId: string,
        metadataList: Uint8Array[],
        supplyKey?: string,
    ): Promise<number[]> {
        const event = this.createEvent("NftMintBatch", "mintNfts");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = supplyKey
                ? PrivateKey.fromString(supplyKey)
                : this.context.operatorKey;
            const tx = new TokenMintTransaction().setTokenId(tokenId);

            for (const metadata of metadataList) {
                tx.addMetadata(metadata);
            }

            tx.freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const serials = receipt.serials.map((s) => s.toNumber());

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return serials;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.mintNfts");
        }
    }

    /**
     * Burn a single NFT.
     *
     * @param tokenId - The NFT collection
     * @param serialNumber - Serial number to burn
     * @param supplyKey - Supply key (defaults to operator)
     */
    async burnNft(
        tokenId: string,
        serialNumber: number,
        supplyKey?: string,
    ): Promise<void> {
        return this.burnNfts(tokenId, [serialNumber], supplyKey);
    }

    /**
     * Burn multiple NFTs.
     *
     * @param tokenId - The NFT collection
     * @param serialNumbers - Serial numbers to burn
     * @param supplyKey - Supply key (defaults to operator)
     */
    async burnNfts(
        tokenId: string,
        serialNumbers: number[],
        supplyKey?: string,
    ): Promise<void> {
        const event = this.createEvent("NftBurn", "burnNfts");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = supplyKey
                ? PrivateKey.fromString(supplyKey)
                : this.context.operatorKey;
            const tx = new TokenBurnTransaction()
                .setTokenId(tokenId)
                .setSerials(serialNumbers)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.burnNfts");
        }
    }

    /**
     * Transfer a single NFT between accounts.
     *
     * @param tokenId - The NFT collection
     * @param serialNumber - Serial number to transfer
     * @param fromAccountId - Sender account
     * @param fromKey - Sender private key
     * @param toAccountId - Receiver account
     */
    async transferNft(
        tokenId: string,
        serialNumber: number,
        fromAccountId: string,
        fromKey: string,
        toAccountId: string,
    ): Promise<void> {
        return this.transferNfts(
            tokenId,
            [serialNumber],
            fromAccountId,
            fromKey,
            toAccountId,
        );
    }

    /**
     * Transfer multiple NFTs between accounts.
     *
     * @param tokenId - The NFT collection
     * @param serialNumbers - Serial numbers to transfer
     * @param fromAccountId - Sender account
     * @param fromKey - Sender private key
     * @param toAccountId - Receiver account
     */
    async transferNfts(
        tokenId: string,
        serialNumbers: number[],
        fromAccountId: string,
        fromKey: string,
        toAccountId: string,
    ): Promise<void> {
        const event = this.createEvent("NftTransfer", "transferNfts");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = PrivateKey.fromString(fromKey);
            const tx = new TransferTransaction();

            for (const serial of serialNumbers) {
                const nftId = new NftId(TokenId.fromString(tokenId), serial);
                tx.addNftTransfer(nftId, fromAccountId, toAccountId);
            }

            tx.freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "NftClient.transferNfts");
        }
    }
}
