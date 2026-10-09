import type { AccountId, Long, TokenId } from "@hiero-ledger/sdk";
import { TokenAirdropTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenAirdropNftValidator } from "../validation/index.js";

/**
 * A single NFT airdrop entry: the specific `(tokenId, serial)` NFT moves
 * from `senderAccountId` to `receiverAccountId`.
 *
 * Multiple airdrops can be batched into a single `TokenAirdropTransaction`
 * — they may span different NFT collections, senders, and receivers.
 */
export interface NftAirdrop {
    tokenId: TokenId | string;
    serial: Long | number;
    senderAccountId: AccountId | string;
    receiverAccountId: AccountId | string;
}

/**
 * Low-level options for an NFT `TokenAirdropTransaction`.
 *
 * Bundles one or more NFT airdrops into a single transaction. Behaviour
 * per receiver depends on its association state:
 *
 * - Already associated: the NFT is credited immediately.
 * - Has free auto-association slots: the collection is auto-associated
 *   and the NFT is credited.
 * - Receiver-sig-required or no auto-association slots: a "Pending
 *   Airdrop" is created that the receiver can later claim.
 *
 * The transaction payer (operator) covers all transfer, association,
 * association-renewal, airdrop, and custom fees. Every distinct sender
 * account's key must sign — supply them via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenAirdrop` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenAirdropNftOperationOptions extends TransactionOptions {
    airdrops: NftAirdrop[];
}

export class TokenAirdropNftOperation extends BaseOperation<TokenAirdropNftOperationOptions> {
    protected readonly type = "TokenAirdrop";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "airdropNft";
    protected readonly validator = new TokenAirdropNftValidator();

    /** Submit an NFT `TokenAirdropTransaction`. */
    async execute(options: TokenAirdropNftOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenAirdropNftOperationOptions,
    ): TokenAirdropTransaction {
        const tx = new TokenAirdropTransaction();

        for (const airdrop of options.airdrops) {
            tx.addNftTransfer(
                airdrop.tokenId,
                airdrop.serial,
                airdrop.senderAccountId,
                airdrop.receiverAccountId,
            );
        }

        return tx;
    }
}
