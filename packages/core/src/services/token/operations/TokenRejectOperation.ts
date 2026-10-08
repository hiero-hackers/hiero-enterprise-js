import type { NftId, PrivateKey } from "@hiero-ledger/sdk";
import { AccountId, TokenId, TokenRejectFlow } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";
import { TokenRejectValidator } from "../validation/index.js";

/**
 * Options for the SDK's `TokenRejectFlow` helper.
 *
 * Rejects one or more fungible tokens and / or NFT serials owned by
 * `ownerId`, returning them to each token's treasury, then dissociates
 * the owner from those same tokens. At least one of `fungibleTokenIds`
 * or `nftIds` must be supplied; both may be supplied together.
 *
 * The owner account's key must sign — pass it via `ownerKey` when the
 * owner is not the operator. The operator pays the fees.
 *
 * Note: `TokenRejectFlow` is an opaque SDK helper that constructs its
 * inner transactions internally and only stores a single signer.
 * Standard `TransactionOptions` (memo, fee, validity, node IDs,
 * additional signers, etc.) are not exposed by the flow and are
 * intentionally omitted from this options interface — the method is
 * named `rejectTokensFlow` to make that limitation explicit.
 */
export interface TokenRejectOperationOptions {
    ownerId: AccountId | string;
    fungibleTokenIds?: (TokenId | string)[];
    nftIds?: NftId[];
    /**
     * Owner's signing key. Required when the owner is not the
     * operator; both inner transactions (reject + dissociate) are
     * signed with this single key.
     */
    ownerKey?: PrivateKey;
}

export class TokenRejectOperation {
    private readonly validator: TokenRejectValidator;

    constructor(private readonly context: IHieroContext) {
        this.validator = new TokenRejectValidator();
    }

    /**
     * Execute the reject-and-dissociate flow.
     *
     * The returned `transactionId` is the *reject* transaction's — the
     * SDK flow does not expose the follow-up dissociate's id. Failures
     * from either inner transaction (reject or dissociate) throw a
     * normalized `HieroError`.
     */
    async execute(options: TokenRejectOperationOptions) {
        this.validator.validate(options);

        const flow = this.buildFlow(options);

        const event = {
            type: "TokenRejectFlow",
            serviceName: "TokenService",
            methodName: "rejectTokensFlow",
            timestamp: new Date(),
        };

        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        let transactionId: string;
        try {
            const response = await flow.execute(this.context.client);
            transactionId = response.transactionId.toString();
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "TokenService.rejectTokensFlow");
        }

        await this.context.emitAfterTransaction({
            ...event,
            transactionId,
            status: "SUCCESS",
            durationMs: Date.now() - start,
        });
        return { transactionId, status: "SUCCESS" };
    }

    private buildFlow(options: TokenRejectOperationOptions): TokenRejectFlow {
        const ownerId =
            typeof options.ownerId === "string"
                ? AccountId.fromString(options.ownerId)
                : options.ownerId;

        const flow = new TokenRejectFlow().setOwnerId(ownerId);

        if (
            options.fungibleTokenIds != null &&
            options.fungibleTokenIds.length > 0
        ) {
            const tokenIds = options.fungibleTokenIds.map((id) =>
                typeof id === "string" ? TokenId.fromString(id) : id,
            );
            flow.setTokenIds(tokenIds);
        }

        if (options.nftIds != null && options.nftIds.length > 0) {
            flow.setNftIds(options.nftIds);
        }

        // Freeze before signing so the owner's key (if provided) attaches
        // to a stable transaction hash. The flow's internal execute()
        // would otherwise try to sign an unfrozen transaction.
        flow.freezeWith(this.context.client);

        if (options.ownerKey != null) {
            flow.sign(options.ownerKey);
        }

        return flow;
    }
}
