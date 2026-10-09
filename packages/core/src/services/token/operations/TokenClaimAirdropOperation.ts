import type { PendingAirdropId } from "@hiero-ledger/sdk";
import { TokenClaimAirdropTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenClaimAirdropValidator } from "../validation/index.js";

/**
 * Low-level options for a `TokenClaimAirdropTransaction`.
 *
 * Finalises one or more previously-created pending airdrops, atomically
 * crediting the receiver(s). A pending airdrop is created whenever a
 * `TokenAirdropTransaction` cannot immediately credit the receiver
 * (receiver not associated and no auto-association slots available, or
 * receiver-sig-required).
 *
 * A single claim transaction can mix fungible and NFT pending airdrops
 * freely — `PendingAirdropId` encodes both kinds (`tokenId` for fungible,
 * `nftId` for NFT) and the SDK transaction handles them uniformly.
 *
 * **Signing:** each distinct receiver named in the pending airdrops must
 * sign — supply their keys via `additionalSigners`. The operator pays
 * the transaction fee.
 *
 * **Sources of `PendingAirdropId`:** instances can be constructed
 * directly, or discovered after the originating airdrop transaction via
 * the mirror node (`/api/v1/accounts/{id}/airdrops/pending`) or by
 * inspecting an account's balance state. Constructing them directly is
 * cheaper when the caller already knows `(senderId, receiverId, tokenId
 * | nftId)`.
 *
 * Extends `TransactionOptions` for fees, validity window, and signers.
 * Note: `TokenClaimAirdrop` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenClaimAirdropOperationOptions extends TransactionOptions {
    pendingAirdropIds: PendingAirdropId[];
}

export class TokenClaimAirdropOperation extends BaseOperation<TokenClaimAirdropOperationOptions> {
    protected readonly type = "TokenClaimAirdrop";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "claimAirdrop";
    protected readonly validator = new TokenClaimAirdropValidator();

    /** Submit a `TokenClaimAirdropTransaction`. */
    async execute(options: TokenClaimAirdropOperationOptions) {
        return await this.run(options);
    }

    protected build(
        options: TokenClaimAirdropOperationOptions,
    ): TokenClaimAirdropTransaction {
        return new TokenClaimAirdropTransaction().setPendingAirdropIds(
            options.pendingAirdropIds,
        );
    }
}
