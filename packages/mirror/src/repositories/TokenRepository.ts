import type {
    MirrorTokenInfo,
    TokenSummary,
    TokenHolder,
    Page,
    TokenQuery,
    TokensQuery,
    TokenBalancesQuery,
} from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";

/**
 * Repository for querying token data from the mirror node.
 *
 * List methods accept an optional {@link PageQuery} (`limit` / `order`) and
 * return a continuable {@link Page}; walk multiple pages with the
 * `collectAll` / `paginate` helpers, or `Page.next()` directly.
 */
export class TokenRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find token information by token ID, optionally as of a point in
     * time via `{ timestamp }` (e.g. historical total supply).
     */
    findById(tokenId: string, options?: TokenQuery): Promise<MirrorTokenInfo> {
        return this.mirrorNodeClient.queryTokenById(tokenId, options);
    }

    /**
     * List tokens network-wide — filter by partial name match, public
     * key, ID range, or type.
     *
     * Rows are {@link TokenSummary} — the seven-field summary the list
     * endpoint serves. Supplies, treasury, custom fees, and timestamps
     * are NOT present; fetch them per token with {@link findById}.
     *
     * @example
     * // Find fungible tokens whose name contains "USD":
     * repo.list({ name: "USD", type: "FUNGIBLE_COMMON" });
     */
    list(options?: TokensQuery): Promise<Page<TokenSummary>> {
        return this.mirrorNodeClient.queryTokens(options);
    }

    /**
     * Find all tokens associated with an account.
     *
     * Rows are {@link TokenSummary} — the seven-field summary; see
     * {@link list}. Use {@link findById} for the full token detail.
     */
    findByAccountId(
        accountId: string,
        options?: TokensQuery,
    ): Promise<Page<TokenSummary>> {
        return this.mirrorNodeClient.queryTokensByAccountId(accountId, options);
    }

    /**
     * Find the holders of a token, optionally filtered by balance threshold
     * (in the token's smallest unit)
     *
     * @example
     * // USDC holders with at least 1 USDC (6 decimals):
     * repo.findHolders("0.0.456858", {
     *   accountBalance: { gte: 1_000_000 },
     * });
     */
    findHolders(
        tokenId: string,
        options?: TokenBalancesQuery,
    ): Promise<Page<TokenHolder>> {
        return this.mirrorNodeClient.queryTokenBalances(tokenId, options);
    }
}
