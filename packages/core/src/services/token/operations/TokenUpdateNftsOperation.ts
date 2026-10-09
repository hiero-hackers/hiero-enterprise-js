import type { TokenId } from "@hiero-ledger/sdk";
import { TokenUpdateNftsTransaction, Long } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenUpdateNftsValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenUpdateNftsTransaction` SDK transaction.
 *
 * Updates the metadata bytes of one or more specific NFT serials within
 * a collection. The same `metadata` value is applied to every serial in
 * `serialNumbers` — issue multiple calls (or a scheduled batch) if
 * different serials need different metadata.
 *
 * Requires:
 * - The collection's `metadataKey` must be set (cannot be added at
 *   update time — it had to be supplied at create, or rotated in via a
 *   prior `TokenUpdate`).
 * - The current `metadataKey` must sign — supply it via
 *   `additionalSigners` (or `externalSigners` for HSM/KMS keys).
 *
 * Updating an NFT's metadata does not affect its ownership, transfer
 * history, or serial number. Only the on-chain metadata bytes change.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface TokenUpdateNftsOperationOptions extends TransactionOptions {
    /** The NFT collection holding the serials to update. */
    tokenId: TokenId | string;
    /**
     * The serials within the collection to update. Must contain at
     * least one entry. Accepts `Long` or plain `number` — numbers are
     * promoted to `Long` before being passed to the SDK.
     */
    serialNumbers: (Long | number)[];
    /**
     * The new metadata bytes to apply to every listed serial. The
     * Hedera network limits NFT metadata to 100 bytes per serial.
     */
    metadata: Uint8Array;
}

export class TokenUpdateNftsOperation extends BaseOperation<TokenUpdateNftsOperationOptions> {
    protected readonly type = "TokenUpdateNfts";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "updateNfts";
    protected readonly validator = new TokenUpdateNftsValidator();

    /** Submit a `TokenUpdateNftsTransaction`. */
    async execute(options: TokenUpdateNftsOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenUpdateNftsOperationOptions,
    ): TokenUpdateNftsTransaction {
        // The SDK's `setSerialNumbers` is typed as `Long[]`, so promote
        // any plain numbers the caller supplied to `Long` first.
        const serialNumbers = options.serialNumbers.map((serial) =>
            typeof serial === "number" ? Long.fromNumber(serial) : serial,
        );

        return new TokenUpdateNftsTransaction()
            .setTokenId(options.tokenId)
            .setSerialNumbers(serialNumbers)
            .setMetadata(options.metadata);
    }
}
