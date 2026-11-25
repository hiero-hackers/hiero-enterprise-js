import type {
    CustomFee,
    Key,
    TokenId,
    TokenSupplyType,
    TokenType,
} from "@hiero-ledger/sdk";
import { Status, TokenInfoQuery as SdkTokenInfoQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError, validationError } from "../../../errors/index.js";
import { QueryExecutor } from "../../transaction/index.js";
import type { QueryOptions } from "../../transaction/index.js";

/**
 * A plain-object representation of a token definition (HTS token).
 *
 * Maps the SDK's `TokenInfo` to JS-friendly types so callers are not
 * coupled to SDK primitives like `Long`, `Timestamp`, and `Duration`.
 *
 * Returned by `TokenService.getTokenInfo`.
 *
 * Applies to both fungible tokens and NFT collections — `tokenType`
 * distinguishes the two. NFT collections report `decimals: 0` and
 * `totalSupply` as the count of minted serials. Per-serial information
 * (owner, metadata, spender) is obtained separately via
 * `TokenService.getNftInfo`.
 */
export interface TokenInfoResult {
    /** The  entity ID (e.g., `"0.0.12345"`). */
    tokenId: string;
    /** Token name (max 100 bytes). */
    name: string;
    /** Token symbol (max 100 bytes). */
    symbol: string;
    /** Decimal places. Always `0` for NFT collections. */
    decimals: number;
    /**
     * Total supply currently in circulation. For NFT collections this
     * is the count of minted serials. Stringified to preserve precision.
     */
    totalSupply: string;
    /** Treasury account holding undistributed supply, or `null` if unset. */
    treasuryAccountId: string | null;
    /** Admin key — required to update / delete the token. `null` if immutable. */
    adminKey: Key | null;
    /** KYC key — required to grant / revoke KYC on holders. `null` if KYC not applicable. */
    kycKey: Key | null;
    /** Freeze key — required to freeze / unfreeze holders. `null` if freezing not applicable. */
    freezeKey: Key | null;
    /** Pause key — required to pause / unpause the token network-wide. `null` if pausing not applicable. */
    pauseKey: Key | null;
    /** Wipe key — required to wipe token balances from accounts. `null` if wiping not applicable. */
    wipeKey: Key | null;
    /** Supply key — required to mint / burn supply. `null` for fixed-supply tokens. */
    supplyKey: Key | null;
    /** Fee schedule key — required to update custom fees. `null` if fees are immutable. */
    feeScheduleKey: Key | null;
    /** Metadata key — required to update token (and individual NFT) metadata. */
    metadataKey: Key | null;
    /**
     * Default freeze status for new associations.
     * - `null`: freeze key not set (FreezeNotApplicable)
     * - `true`: frozen
     * - `false`: unfrozen
     */
    defaultFreezeStatus: boolean | null;
    /**
     * Default KYC status for new associations.
     * - `null`: KYC key not set (KycNotApplicable)
     * - `true`: granted
     * - `false`: revoked
     */
    defaultKycStatus: boolean | null;
    /**
     * Network-wide pause status.
     * - `null`: pause key not set (PauseNotApplicable)
     * - `true`: paused
     * - `false`: unpaused
     */
    pauseStatus: boolean | null;
    /** Whether the token has been deleted. */
    isDeleted: boolean;
    /** Auto-renew account, or `null` if none. */
    autoRenewAccountId: string | null;
    /** Auto-renew period in seconds, or `null` if no auto-renew account. */
    autoRenewPeriod: number | null;
    /** ISO-8601 timestamp of when the token expires, or `null`. */
    expirationTime: string | null;
    /** Token memo (max 100 bytes). */
    tokenMemo: string;
    /** Custom fees attached to the token, returned as raw SDK `CustomFee` instances. */
    customFees: CustomFee[];
    /** `FungibleCommon` or `NonFungibleUnique`. */
    tokenType: TokenType | null;
    /** `Infinite` or `Finite`. */
    supplyType: TokenSupplyType | null;
    /**
     * Maximum supply when `supplyType` is `Finite`. Stringified to
     * preserve precision. `null` for infinite-supply tokens.
     */
    maxSupply: string | null;
    /** Ledger this token lives on (mainnet / testnet / previewnet), as a hex string. */
    ledgerId: string | null;
    /** Arbitrary token metadata bytes, or `null`. */
    metadata: Uint8Array | null;
}

/**
 * Read-only query for token definitions (both fungible and NFT collections).
 *
 * Wraps the SDK's `TokenInfoQuery` and projects the result to a plain
 * `TokenInfoResult` object decoupled from SDK primitives.
 */
export class TokenInfoQuery {
    private readonly executor: QueryExecutor;

    constructor(context: IHieroContext) {
        this.executor = new QueryExecutor(context);
    }

    /**
     * Fetch the full token definition for the given token ID.
     *
     * @param tokenId - The token entity ID (e.g., `"0.0.12345"`)
     * @returns Plain-object token info — never `null`; throws if the
     *          token does not exist or the network rejects the query
     */
    async execute(
        tokenId: string | TokenId,
        options: QueryOptions = {},
    ): Promise<TokenInfoResult> {
        if (tokenId == null) {
            throw validationError(
                "TokenInfoQuery",
                "tokenId is required.",
                Status.InvalidTokenId,
            );
        }

        try {
            const query = new SdkTokenInfoQuery().setTokenId(tokenId);
            const info = await this.executor.run(query, options, {
                type: "TokenInfoQuery",
                serviceName: "TokenService",
                methodName: "getTokenInfo",
                timestamp: new Date(),
            });
            return {
                tokenId: info.tokenId.toString(),
                name: info.name,
                symbol: info.symbol,
                decimals: info.decimals,
                totalSupply: info.totalSupply.toString(),
                treasuryAccountId: info.treasuryAccountId?.toString() ?? null,
                adminKey: info.adminKey,
                kycKey: info.kycKey,
                freezeKey: info.freezeKey,
                pauseKey: info.pauseKey,
                wipeKey: info.wipeKey,
                supplyKey: info.supplyKey,
                feeScheduleKey: info.feeScheduleKey,
                metadataKey: info.metadataKey,
                defaultFreezeStatus: info.defaultFreezeStatus,
                defaultKycStatus: info.defaultKycStatus,
                pauseStatus: info.pauseStatus,
                isDeleted: info.isDeleted,
                autoRenewAccountId: info.autoRenewAccountId?.toString() ?? null,
                autoRenewPeriod:
                    info.autoRenewPeriod?.seconds.toNumber() ?? null,
                expirationTime: info.expirationTime
                    ? info.expirationTime.toDate().toISOString()
                    : null,
                tokenMemo: info.tokenMemo,
                customFees: info.customFees,
                tokenType: info.tokenType,
                supplyType: info.supplyType,
                maxSupply: info.maxSupply?.toString() ?? null,
                ledgerId: info.ledgerId?.toString() ?? null,
                metadata: info.metadata,
            };
        } catch (error) {
            throw normalizeError(error, "TokenService.getTokenInfo");
        }
    }
}
