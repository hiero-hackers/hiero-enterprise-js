import {
    TokenType,
    TokenSupplyType,
    type Key,
    type NftId,
    type TokenId,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import type { QueryOptions, ScheduleOptions } from "../transaction/index.js";
import { TokenInfoQuery, TokenNftInfoQuery } from "./queries/index.js";
import type { TokenInfoResult, TokenNftInfoResult } from "./queries/index.js";
import {
    TokenCreateOperation,
    TokenMintOperation,
    TokenBurnOperation,
    TokenWipeOperation,
    TokenAssociateOperation,
    TokenDissociateOperation,
    TokenUpdateOperation,
    TokenUpdateNftsOperation,
    TokenDeleteOperation,
    TokenFreezeOperation,
    TokenUnfreezeOperation,
    TokenGrantKycOperation,
    TokenRevokeKycOperation,
    TokenPauseOperation,
    TokenUnpauseOperation,
    TokenFeeScheduleUpdateOperation,
    TokenAirdropOperation,
    TokenAirdropNftOperation,
    TokenClaimAirdropOperation,
    TokenCancelAirdropOperation,
    TokenRejectOperation,
} from "./operations/index.js";
import type {
    TokenCreateOperationOptions,
    TokenMintOperationOptions,
    TokenBurnOperationOptions,
    TokenWipeOperationOptions,
    TokenAssociateOperationOptions,
    TokenDissociateOperationOptions,
    TokenUpdateOperationOptions,
    TokenUpdateNftsOperationOptions,
    TokenDeleteOperationOptions,
    TokenFreezeOperationOptions,
    TokenUnfreezeOperationOptions,
    TokenGrantKycOperationOptions,
    TokenRevokeKycOperationOptions,
    TokenPauseOperationOptions,
    TokenUnpauseOperationOptions,
    TokenFeeScheduleUpdateOperationOptions,
    TokenAirdropOperationOptions,
    TokenAirdrop,
    TokenAirdropNftOperationOptions,
    NftAirdrop,
    TokenClaimAirdropOperationOptions,
    TokenCancelAirdropOperationOptions,
    TokenRejectOperationOptions,
} from "./operations/index.js";

/**
 * Options for creating a fungible token.
 *
 * Omits `tokenType` because the service always sets it to
 * `TokenType.FungibleCommon`. All other fields mirror `TokenCreateTransaction`.
 *
 * When `maxSupply` is provided and `supplyType` is not, the service
 * automatically sets `supplyType` to `TokenSupplyType.Finite`.
 */
export type CreateFungibleTokenOptions = Omit<
    TokenCreateOperationOptions,
    "tokenType"
>;

/**
 * Options for creating a non-fungible token (NFT collection).
 *
 * Omits fields the service controls:
 * - `tokenType` — always `TokenType.NonFungibleUnique`
 * - `decimals` — always `0`
 * - `initialSupply` — always `0` (NFTs are minted post-creation via the supply key)
 *
 * `supplyKey` is required because individual NFTs are minted after the
 * collection is created.
 *
 * When `maxSupply` is provided and `supplyType` is not, the service
 * automatically sets `supplyType` to `TokenSupplyType.Finite`.
 */
export type CreateNftOptions = Omit<
    TokenCreateOperationOptions,
    "tokenType" | "decimals" | "initialSupply" | "supplyKey"
> & {
    supplyKey: Key;
};

/** Options for minting token supply (fungible amount or NFT metadata). */
export type MintTokenOptions = TokenMintOperationOptions;

/** Options for burning token supply (fungible amount or NFT serials). */
export type BurnTokenOptions = TokenBurnOperationOptions;

/** Options for wiping token supply from a specific account (fungible amount or NFT serials). */
export type WipeTokenOptions = TokenWipeOperationOptions;

/** Options for associating a single token to an account. */
export type AssociateTokenOptions = TokenAssociateOperationOptions;

/** Options for dissociating a single token from an account. */
export type DissociateTokenOptions = TokenDissociateOperationOptions;

/** Options for updating an existing token's mutable properties. */
export type UpdateTokenOptions = TokenUpdateOperationOptions;

/**
 * Options for updating the metadata bytes of one or more specific NFT
 * serials within a collection. The same `metadata` value is applied to
 * every listed serial.
 */
export type UpdateNftsOptions = TokenUpdateNftsOperationOptions;

/** Options for deleting an existing token. */
export type DeleteTokenOptions = TokenDeleteOperationOptions;

/** Options for freezing a token relationship on a specific account. */
export type FreezeTokenOptions = TokenFreezeOperationOptions;

/** Options for unfreezing a previously frozen token relationship on a specific account. */
export type UnfreezeTokenOptions = TokenUnfreezeOperationOptions;

/** Options for granting KYC approval on a token relationship for a specific account. */
export type GrantKycTokenOptions = TokenGrantKycOperationOptions;

/** Options for revoking KYC approval on a token relationship for a specific account. */
export type RevokeKycTokenOptions = TokenRevokeKycOperationOptions;

/** Options for pausing a token network-wide. */
export type PauseTokenOptions = TokenPauseOperationOptions;

/** Options for unpausing a previously paused token network-wide. */
export type UnpauseTokenOptions = TokenUnpauseOperationOptions;

/** Options for replacing a token's custom fee schedule. */
export type UpdateTokenFeeScheduleOptions =
    TokenFeeScheduleUpdateOperationOptions;

/** Options for airdropping fungible tokens from a sender to a receiver. */
export type AirdropFungibleTokenOptions = TokenAirdropOperationOptions;

/** A single (token, sender, receiver, amount) entry in an airdrop batch. */
export type AirdropFungibleToken = TokenAirdrop;

/** Options for airdropping NFT serials from a sender to a receiver. */
export type AirdropNftOptions = TokenAirdropNftOperationOptions;

/** A single (token, serial, sender, receiver) entry in an NFT airdrop batch. */
export type AirdropNft = NftAirdrop;

/**
 * Options for claiming one or more pending airdrops. A single claim
 * transaction may mix fungible and NFT pending airdrop IDs.
 */
export type ClaimAirdropOptions = TokenClaimAirdropOperationOptions;

/**
 * Options for cancelling one or more pending airdrops issued by the
 * sender. A single cancel transaction may mix fungible and NFT pending
 * airdrop IDs.
 */
export type CancelAirdropOptions = TokenCancelAirdropOperationOptions;

/**
 * Options for {@link TokenService.rejectTokensFlow} — rejecting one or
 * more fungible tokens and / or NFT serials held by an owner account,
 * via the SDK's `TokenRejectFlow` (reject then dissociate). A single
 * call may mix fungible tokens and NFT serials freely. The owner's key
 * is passed via the dedicated `ownerKey` field (the flow only supports
 * one signer).
 */
export type RejectTokensOptions = TokenRejectOperationOptions;

/**
 * Service for managing native tokens on the Hiero network (HTS) — covers
 * both fungible tokens and non-fungible token (NFT) collections via a
 * single unified surface.
 */
export class TokenService {
    private readonly createOperation: TokenCreateOperation;
    private readonly mintOperation: TokenMintOperation;
    private readonly burnOperation: TokenBurnOperation;
    private readonly wipeOperation: TokenWipeOperation;
    private readonly associateOperation: TokenAssociateOperation;
    private readonly dissociateOperation: TokenDissociateOperation;
    private readonly updateOperation: TokenUpdateOperation;
    private readonly updateNftsOperation: TokenUpdateNftsOperation;
    private readonly deleteOperation: TokenDeleteOperation;
    private readonly freezeOperation: TokenFreezeOperation;
    private readonly unfreezeOperation: TokenUnfreezeOperation;
    private readonly grantKycOperation: TokenGrantKycOperation;
    private readonly revokeKycOperation: TokenRevokeKycOperation;
    private readonly pauseOperation: TokenPauseOperation;
    private readonly unpauseOperation: TokenUnpauseOperation;
    private readonly feeScheduleUpdateOperation: TokenFeeScheduleUpdateOperation;
    private readonly airdropOperation: TokenAirdropOperation;
    private readonly airdropNftOperation: TokenAirdropNftOperation;
    private readonly claimAirdropOperation: TokenClaimAirdropOperation;
    private readonly cancelAirdropOperation: TokenCancelAirdropOperation;
    private readonly rejectOperation: TokenRejectOperation;
    private readonly tokenInfoQuery: TokenInfoQuery;
    private readonly tokenNftInfoQuery: TokenNftInfoQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new TokenCreateOperation(context);
        this.mintOperation = new TokenMintOperation(context);
        this.burnOperation = new TokenBurnOperation(context);
        this.wipeOperation = new TokenWipeOperation(context);
        this.associateOperation = new TokenAssociateOperation(context);
        this.dissociateOperation = new TokenDissociateOperation(context);
        this.updateOperation = new TokenUpdateOperation(context);
        this.updateNftsOperation = new TokenUpdateNftsOperation(context);
        this.deleteOperation = new TokenDeleteOperation(context);
        this.freezeOperation = new TokenFreezeOperation(context);
        this.unfreezeOperation = new TokenUnfreezeOperation(context);
        this.grantKycOperation = new TokenGrantKycOperation(context);
        this.revokeKycOperation = new TokenRevokeKycOperation(context);
        this.pauseOperation = new TokenPauseOperation(context);
        this.unpauseOperation = new TokenUnpauseOperation(context);
        this.feeScheduleUpdateOperation = new TokenFeeScheduleUpdateOperation(
            context,
        );
        this.airdropOperation = new TokenAirdropOperation(context);
        this.airdropNftOperation = new TokenAirdropNftOperation(context);
        this.claimAirdropOperation = new TokenClaimAirdropOperation(context);
        this.cancelAirdropOperation = new TokenCancelAirdropOperation(context);
        this.rejectOperation = new TokenRejectOperation(context);
        this.tokenInfoQuery = new TokenInfoQuery(context);
        this.tokenNftInfoQuery = new TokenNftInfoQuery(context);
    }

    /**
     * Create a new fungible token.
     *
     * @param options - Token name, symbol, treasury, keys and supply settings
     * @returns The token ID of the created token (e.g., `"0.0.12345"`)
     *
     * @example
     * ```typescript
     * const tokenId = await tokenService.createFungibleToken({
     *   tokenName: "Acme Coin",
     *   tokenSymbol: "ACME",
     *   decimals: 2,
     *   initialSupply: 1_000_000,
     *   treasuryAccountId: "0.0.555",
     *   adminKey: adminKey.publicKey,
     *   supplyKey: supplyKey.publicKey,
     *   additionalSigners: [treasuryKey],
     * });
     * ```
     */
    async createFungibleToken(options: CreateFungibleTokenOptions) {
        return await this.createOperation.execute(
            this.buildFungibleOperationOptions(options),
        );
    }

    /**
     * Schedule fungible token creation for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign using
     * `ScheduleService` before the transaction executes.
     *
     * @param options - Token name, symbol, treasury, keys and supply settings
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleCreateFungibleToken(
        options: CreateFungibleTokenOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.createOperation.schedule(
            this.buildFungibleOperationOptions(options),
            scheduleOptions,
        );
    }

    /**
     * Create a new non-fungible token (NFT) collection.
     *
     * `decimals` and `initialSupply` are forced to `0` and `tokenType` is set
     * to `NonFungibleUnique`. Mint individual NFTs after creation using the
     * supply key via `mintToken`.
     *
     * @param options - Collection name, symbol, treasury, keys and supply settings; `supplyKey` is required
     * @returns The token ID of the created NFT collection
     *
     * @example
     * ```typescript
     * const collectionId = await tokenService.createNft({
     *   tokenName: "Acme Art",
     *   tokenSymbol: "ART",
     *   treasuryAccountId: "0.0.555",
     *   supplyKey: supplyKey.publicKey,
     *   maxSupply: 10_000,
     *   additionalSigners: [treasuryKey],
     * });
     * ```
     */
    async createNft(options: CreateNftOptions) {
        return await this.createOperation.execute(
            this.buildNftOperationOptions(options),
        );
    }

    /**
     * Schedule NFT collection creation for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign using
     * `ScheduleService` before the transaction executes.
     *
     * @param options - Collection name, symbol, treasury, keys and supply settings; `supplyKey` is required
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleCreateNft(
        options: CreateNftOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.createOperation.schedule(
            this.buildNftOperationOptions(options),
            scheduleOptions,
        );
    }

    /**
     * Mint additional supply for an existing token.
     *
     * - Fungible: set `amount`
     * - NFT: set `metadata` (one metadata entry per NFT serial)
     *
     * @param options.tokenId - Token to mint additional supply for
     * @param options.amount - Fungible amount to mint
     * @param options.metadata - NFT metadata entries to mint, one per new serial
     * @returns The transaction id/status, the serials minted (NFTs; empty
     *   for fungible mints), and the total supply after the mint
     */
    async mintToken(options: MintTokenOptions) {
        return await this.mintOperation.execute(options);
    }

    /**
     * Schedule token minting for deferred multi-sig execution.
     *
     * @param options.tokenId - Token to mint additional supply for
     * @param options.amount - Fungible amount to mint
     * @param options.metadata - NFT metadata entries to mint, one per new serial
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleMintToken(
        options: MintTokenOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.mintOperation.schedule(options, scheduleOptions);
    }

    /**
     * Burn supply from an existing token.
     *
     * - Fungible: set `amount` to reduce the total supply
     * - NFT: set `serials` to burn specific serial numbers
     *
     * The supply key must sign — supply it via `additionalSigners`. The
     * burned supply must be held by the treasury account; transfer NFTs
     * back to the treasury before burning.
     *
     * @param options.tokenId - Token to burn supply from
     * @param options.amount - Fungible amount to burn
     * @param options.serials - NFT serial numbers to burn
     * @returns The transaction id/status and the new total supply (a
     *   decimal string)
     */
    async burnToken(options: BurnTokenOptions) {
        return await this.burnOperation.execute(options);
    }

    /**
     * Schedule a token burn for deferred multi-sig execution.
     *
     * @param options.tokenId - Token to burn supply from
     * @param options.amount - Fungible amount to burn
     * @param options.serials - NFT serial numbers to burn
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleBurnToken(
        options: BurnTokenOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.burnOperation.schedule(options, scheduleOptions);
    }

    /**
     * Wipe supply from a specific holder account.
     *
     * Removes supply held by a non-treasury account. Unlike `burnToken`,
     * which burns supply from the treasury, wipe targets a specific holder
     * — typical use cases include enforcing compliance or revoking issued
     * tokens.
     *
     * The wipe key (not the supply key) must sign — supply it via
     * `additionalSigners`. The target account cannot be the treasury.
     *
     * - Fungible: set `amount` to wipe from the account
     * - NFT: set `serials` to wipe specific serial numbers held by the account
     *
     * Note: `TokenWipe` is not whitelisted for scheduling on the network,
     * so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token to wipe supply from
     * @param options.accountId - Holder account to wipe the supply from
     * @param options.amount - Fungible amount to wipe
     * @param options.serials - NFT serial numbers to wipe
     * @returns The transaction id/status and the new total supply (a
     *   decimal string)
     */
    async wipeToken(options: WipeTokenOptions) {
        return await this.wipeOperation.execute(options);
    }

    /**
     * Associate one token with an account.
     *
     * Association is required before non-treasury accounts can hold a token.
     *
     * @param options.accountId - Account to associate the token with
     * @param options.tokenId - Token to associate to the account
     */
    async associateToken(options: AssociateTokenOptions) {
        return await this.associateOperation.execute(options);
    }

    /**
     * Schedule token association for deferred multi-sig execution.
     *
     * @param options.accountId - Account to associate the token with
     * @param options.tokenId - Token to associate to the account
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleAssociateToken(
        options: AssociateTokenOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.associateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Dissociate one or more tokens from an account.
     *
     * The account must hold a zero balance of each token being dissociated.
     * The account's key must sign — supply it via `additionalSigners` when
     * the account is not the operator. After dissociation, the account can
     * no longer receive those tokens unless re-associated.
     *
     * @param options.accountId - Account to dissociate the tokens from
     * @param options.tokenIds - Tokens to dissociate from the account (at least one)
     */
    async dissociateToken(options: DissociateTokenOptions) {
        return await this.dissociateOperation.execute(options);
    }

    /**
     * Schedule token dissociation for deferred multi-sig execution.
     *
     * @param options.accountId - Account to dissociate the tokens from
     * @param options.tokenIds - Tokens to dissociate from the account (at least one)
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleDissociateToken(
        options: DissociateTokenOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.dissociateOperation.schedule(
            options,
            scheduleOptions,
        );
    }

    /**
     * Update mutable properties of an existing token.
     *
     * Only fields explicitly set on `options` are updated; omitted fields
     * are left unchanged. Note: most updates require the token's admin key
     * to sign — supply it via `additionalSigners`.
     *
     * @param options.tokenId - Token to update
     * @param options.tokenName - New token name (max 100 bytes)
     * @param options.tokenSymbol - New token symbol (max 100 bytes)
     * @param options.treasuryAccountId - New treasury account (requires the new treasury's key)
     * @param options.adminKey - Replace the admin key
     * @param options.kycKey - Replace the KYC key
     * @param options.freezeKey - Replace the freeze key
     * @param options.wipeKey - Replace the wipe key
     * @param options.supplyKey - Replace the supply key
     * @param options.feeScheduleKey - Replace the fee schedule key
     * @param options.pauseKey - Replace the pause key
     * @param options.metadataKey - Replace the metadata key
     * @param options.autoRenewAccountId - New auto-renew account
     * @param options.autoRenewPeriod - New auto-renew period (seconds)
     * @param options.expirationTime - New explicit expiration time
     * @param options.tokenMemo - New token memo (max 100 bytes)
     * @param options.metadata - New token-level metadata bytes
     * @param options.keyVerificationMode - How to verify replacement keys (`TokenKeyValidation.FullValidation` or `TokenKeyValidation.NoValidation`)
     */
    async updateToken(options: UpdateTokenOptions) {
        return await this.updateOperation.execute(options);
    }

    /**
     * Schedule a token update for deferred multi-sig execution.
     *
     * @param options - See {@link TokenService.updateToken} for field details
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleUpdateToken(
        options: UpdateTokenOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.updateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Update the metadata bytes of one or more specific NFT serials
     * within a collection. The same `metadata` value is applied to every
     * serial listed in `options.serialNumbers`.
     *
     * The collection must have a `metadataKey` set, and that key must
     * sign the transaction — supply it via `additionalSigners` (or
     * `externalSigners` for HSM/KMS keys). If the collection has no
     * `metadataKey`, rotate one in first via {@link TokenService.updateToken}.
     *
     * Updating an NFT's metadata does not affect its ownership, serial
     * number, or transfer history — only the on-chain metadata bytes
     * change. To update collection-level metadata instead (the parent
     * token's `metadata` field), use {@link TokenService.updateToken}.
     *
     * The Hedera network limits NFT metadata to 100 bytes per serial.
     *
     * @param options.tokenId - The NFT collection holding the serials to update
     * @param options.serialNumbers - The serials within the collection to update (must be non-empty)
     * @param options.metadata - The new metadata bytes to apply to every listed serial
     *
     * @example
     * ```typescript
     * await tokenService.updateNfts({
     *   tokenId: "0.0.12345",
     *   serialNumbers: [1, 2, 3],
     *   metadata: new TextEncoder().encode("ipfs://QmNewMetadataCid"),
     *   additionalSigners: [metadataKey],
     * });
     * ```
     */
    async updateNfts(options: UpdateNftsOptions) {
        return await this.updateNftsOperation.execute(options);
    }

    /**
     * Delete an existing token.
     *
     * Marks the token as deleted on the network. The token must have an
     * admin key, and that admin key must sign the transaction — supply it
     * via `additionalSigners`. Once deleted, the token cannot be used for
     * any operation (transfers, mints, associations, etc.).
     *
     * Note: `TokenDelete` is not whitelisted for scheduling on the network,
     * so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token to delete
     */
    async deleteToken(options: DeleteTokenOptions) {
        return await this.deleteOperation.execute(options);
    }

    /**
     * Freeze a token relationship on a specific account.
     *
     * Prevents `accountId` from sending or receiving the given token until
     * the relationship is unfrozen. The token must have been created with a
     * freeze key, and that freeze key must sign — supply it via
     * `additionalSigners`. The target account must already be associated
     * with the token.
     *
     * Note: `TokenFreeze` is not whitelisted for scheduling on the network,
     * so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token whose relationship will be frozen
     * @param options.accountId - Account whose relationship will be frozen
     */
    async freezeToken(options: FreezeTokenOptions) {
        return await this.freezeOperation.execute(options);
    }

    /**
     * Unfreeze a previously frozen token relationship on a specific account.
     *
     * Restores the target account's ability to send and receive the given
     * token after a prior freeze. The token's freeze key must sign —
     * supply it via `additionalSigners`. The target account must already
     * be associated with the token.
     *
     * Note: `TokenUnfreeze` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token whose relationship will be unfrozen
     * @param options.accountId - Account whose relationship will be unfrozen
     */
    async unfreezeToken(options: UnfreezeTokenOptions) {
        return await this.unfreezeOperation.execute(options);
    }

    /**
     * Grant KYC approval on a token relationship for a specific account.
     *
     * Marks the target account as KYC-approved for the given token,
     * allowing it to send and receive that token. The token must have
     * been created with a KYC key, and that KYC key must sign — supply
     * it via `additionalSigners`. The target account must already be
     * associated with the token.
     *
     * Note: `TokenGrantKyc` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token whose relationship will be granted KYC
     * @param options.accountId - Account to grant KYC approval to
     */
    async grantKycToken(options: GrantKycTokenOptions) {
        return await this.grantKycOperation.execute(options);
    }

    /**
     * Revoke KYC approval on a token relationship for a specific account.
     *
     * Marks the target account as no longer KYC-approved for the given
     * token, preventing further token transfers until KYC is re-granted.
     * The token must have been created with a KYC key, and that KYC key
     * must sign — supply it via `additionalSigners`. The target account
     * must already be associated with the token.
     *
     * Note: `TokenRevokeKyc` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token whose relationship will have KYC revoked
     * @param options.accountId - Account to revoke KYC approval from
     */
    async revokeKycToken(options: RevokeKycTokenOptions) {
        return await this.revokeKycOperation.execute(options);
    }

    /**
     * Pause a token network-wide.
     *
     * Blocks all transfers, mints, burns, wipes, freezes / unfreezes,
     * grant / revoke KYC, and other operations on the token until it is
     * unpaused. The token must have been created with a pause key, and
     * that pause key must sign — supply it via `additionalSigners`.
     *
     * Note: `TokenPause` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token to pause
     */
    async pauseToken(options: PauseTokenOptions) {
        return await this.pauseOperation.execute(options);
    }

    /**
     * Unpause a previously paused token.
     *
     * Restores transfers, mints, burns, wipes, freezes / unfreezes,
     * grant / revoke KYC, and other operations on the token. The token
     * must have been created with a pause key, and that pause key must
     * sign — supply it via `additionalSigners`.
     *
     * Note: `TokenUnpause` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token to unpause
     */
    async unpauseToken(options: UnpauseTokenOptions) {
        return await this.unpauseOperation.execute(options);
    }

    /**
     * Replace a token's custom fee schedule.
     *
     * Replaces the token's existing custom fee schedule with the supplied
     * list. Pass an empty `customFees` array to clear all custom fees.
     * The token must have been created with a fee-schedule key, and that
     * fee-schedule key must sign — supply it via `additionalSigners`.
     *
     * Note: `TokenFeeScheduleUpdate` is not whitelisted for scheduling on
     * the network, so no scheduled variant is exposed.
     *
     * @param options.tokenId - Token whose fee schedule will be replaced
     * @param options.customFees - Replacement fee schedule (empty array clears all fees)
     */
    async updateTokenFeeSchedule(options: UpdateTokenFeeScheduleOptions) {
        return await this.feeScheduleUpdateOperation.execute(options);
    }

    /**
     * Airdrop fungible tokens from senders to receivers, batching one or
     * more airdrops into a single `TokenAirdropTransaction`.
     *
     * Each entry in `options.airdrops` may name a distinct token, sender,
     * and receiver. Behaviour per receiver depends on its association state:
     *
     * - Already associated: tokens are credited immediately.
     * - Has free auto-association slots: the token is auto-associated
     *   and credited immediately.
     * - Receiver-sig-required or no auto-association slots: a "Pending
     *   Airdrop" is created that the receiver can later claim.
     *
     * The transaction payer (operator) covers all transfer, association,
     * association-renewal, airdrop, and custom fees. Every distinct sender
     * account's key must sign — supply them via `additionalSigners`.
     *
     * Note: `TokenAirdrop` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.airdrops - One or more `(tokenId, senderAccountId,
     *     receiverAccountId, amount, expectedDecimals?)` entries to apply
     *     atomically in a single transaction.
     */
    async airdropFungibleToken(options: AirdropFungibleTokenOptions) {
        return await this.airdropOperation.execute(options);
    }

    /**
     * Airdrop NFT serials from senders to receivers, batching one or more
     * `(tokenId, serial, sender, receiver)` entries into a single
     * `TokenAirdropTransaction`.
     *
     * Each entry in `options.airdrops` may name a distinct NFT collection,
     * serial, sender, and receiver. Behaviour per receiver depends on its
     * association state:
     *
     * - Already associated: the NFT is credited immediately.
     * - Has free auto-association slots: the collection is auto-associated
     *   and the NFT is credited immediately.
     * - Receiver-sig-required or no auto-association slots: a "Pending
     *   Airdrop" is created that the receiver can later claim.
     *
     * The transaction payer (operator) covers all transfer, association,
     * association-renewal, airdrop, and custom fees. Every distinct sender
     * account's key must sign — supply them via `additionalSigners`.
     *
     * Note: `TokenAirdrop` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.airdrops - One or more `(tokenId, serial,
     *     senderAccountId, receiverAccountId)` entries to apply atomically
     *     in a single transaction.
     */
    async airdropNft(options: AirdropNftOptions) {
        return await this.airdropNftOperation.execute(options);
    }

    /**
     * Claim one or more previously-created pending airdrops, atomically
     * crediting the receiver(s).
     *
     * A pending airdrop is created whenever {@link TokenService.airdropFungibleToken}
     * or {@link TokenService.airdropNft} cannot immediately credit the
     * receiver — typically because the receiver is not associated to the
     * token and has no free auto-association slots, or because the
     * account requires explicit signatures for inbound transfers.
     *
     * A single claim transaction may mix fungible and NFT pending
     * airdrops freely: `PendingAirdropId` encodes both kinds (`tokenId`
     * for fungible, `nftId` for NFT) and the underlying transaction
     * handles them uniformly.
     *
     * **Signing.** Each distinct receiver named in the pending airdrops
     * must sign — supply their keys via `additionalSigners`. The
     * operator pays the transaction fee.
     *
     * **Discovering pending airdrop IDs.** Construct them directly when
     * the caller already knows `(senderId, receiverId, tokenId | nftId)`
     * — e.g. immediately after issuing the airdrop. Otherwise, query the
     * mirror node
     * (`/api/v1/accounts/{id}/airdrops/pending`) or inspect account
     * state to enumerate outstanding pending airdrops for a receiver.
     *
     * Note: `TokenClaimAirdrop` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.pendingAirdropIds - One or more `PendingAirdropId`
     *     entries (fungible and / or NFT) to claim atomically in a
     *     single transaction.
     *
     * @example
     * ```typescript
     * import { PendingAirdropId, NftId, TokenId } from "@hiero-ledger/sdk";
     *
     * await tokenService.claimAirdrop({
     *   pendingAirdropIds: [
     *     new PendingAirdropId({
     *       senderId: "0.0.700",
     *       receiverId: "0.0.800",
     *       tokenId: "0.0.500",                                  // fungible
     *     }),
     *     new PendingAirdropId({
     *       senderId: "0.0.700",
     *       receiverId: "0.0.800",
     *       nftId: new NftId(TokenId.fromString("0.0.600"), 1),   // NFT
     *     }),
     *   ],
     *   additionalSigners: [receiverKey],
     * });
     * ```
     */
    async claimAirdrop(options: ClaimAirdropOptions) {
        return await this.claimAirdropOperation.execute(options);
    }

    /**
     * Cancel one or more previously-issued pending airdrops, returning
     * the sender's escrowed assets to its available balance.
     *
     * A pending airdrop is created whenever {@link TokenService.airdropFungibleToken}
     * or {@link TokenService.airdropNft} cannot immediately credit the
     * receiver — typically because the receiver is not associated to the
     * token and has no free auto-association slots, or because the
     * account requires explicit signatures for inbound transfers. The
     * sender retains the right to reclaim those pending entries by
     * cancelling them.
     *
     * A single cancel transaction may mix fungible and NFT pending
     * airdrops freely: `PendingAirdropId` encodes both kinds (`tokenId`
     * for fungible, `nftId` for NFT) and the underlying transaction
     * handles them uniformly.
     *
     * **Signing.** Each distinct sender named in the pending airdrops
     * must sign — supply their keys via `additionalSigners`. The
     * operator pays the transaction fee. (Contrast with
     * {@link TokenService.claimAirdrop}, which requires the receivers'
     * signatures.)
     *
     * **Discovering pending airdrop IDs.** Construct them directly when
     * the sender already knows `(senderId, receiverId, tokenId | nftId)`
     * — e.g. immediately after issuing the airdrop. Otherwise, query the
     * mirror node
     * (`/api/v1/accounts/{id}/airdrops/outstanding`) to enumerate the
     * sender's outstanding pending airdrops.
     *
     * Note: `TokenCancelAirdrop` is not whitelisted for scheduling on the
     * network, so no scheduled variant is exposed.
     *
     * @param options.pendingAirdropIds - One or more `PendingAirdropId`
     *     entries (fungible and / or NFT) to cancel atomically in a
     *     single transaction.
     *
     * @example
     * ```typescript
     * import { PendingAirdropId, NftId, TokenId } from "@hiero-ledger/sdk";
     *
     * await tokenService.cancelAirdrop({
     *   pendingAirdropIds: [
     *     new PendingAirdropId({
     *       senderId: "0.0.700",
     *       receiverId: "0.0.800",
     *       tokenId: "0.0.500",                                  // fungible
     *     }),
     *     new PendingAirdropId({
     *       senderId: "0.0.700",
     *       receiverId: "0.0.800",
     *       nftId: new NftId(TokenId.fromString("0.0.600"), 1),   // NFT
     *     }),
     *   ],
     *   additionalSigners: [senderKey],
     * });
     * ```
     */
    async cancelAirdrop(options: CancelAirdropOptions) {
        return await this.cancelAirdropOperation.execute(options);
    }

    /**
     * Reject one or more fungible tokens and / or NFT serials held by an
     * owner account, returning them to each token's treasury and then
     * dissociating the owner from those tokens in a single flow.
     *
     * Backed by the SDK's `TokenRejectFlow`, which submits a
     * `TokenRejectTransaction` followed by a `TokenDissociateTransaction`
     * for the same set of tokens. A single call may mix fungible token
     * IDs and NFT serials freely — supply `fungibleTokenIds` for
     * fungibles, `nftIds` for NFTs, or both. At least one of the two
     * must be non-empty.
     *
     * The owner account's key must sign — supply it via `ownerKey`
     * when the owner is not the operator. The flow only stores a single
     * signer, applied to both inner transactions. The operator pays the
     * fees.
     *
     * The `Flow` suffix is intentional: `TokenRejectFlow` is an opaque
     * SDK helper that constructs its inner transactions internally, so
     * the usual `TransactionOptions` surface (memo, max fee, validity
     * duration, node IDs, additional signers, etc.) is *not* exposed on
     * this method. If you need that level of control, build a
     * `TokenRejectTransaction` + `TokenDissociateTransaction` pair
     * yourself.
     *
     * @param options.ownerId - Account holding the tokens / NFTs to reject
     * @param options.fungibleTokenIds - Fungible tokens to reject (optional)
     * @param options.nftIds - NFT serials to reject (optional)
     * @param options.ownerKey - Owner's signing key (required when the owner is not the operator)
     * @returns The **reject** transaction's id and status. The flow's
     *   follow-up dissociate is a second transaction whose id the SDK
     *   does not expose — correlate it on the mirror node via the owner
     *   account if needed. `SUCCESS` means both inner transactions
     *   succeeded (the flow validates both receipts internally).
     *
     * @example
     * ```typescript
     * import { NftId, TokenId } from "@hiero-ledger/sdk";
     *
     * await tokenService.rejectTokensFlow({
     *   ownerId: myAccountId,
     *   fungibleTokenIds: [TokenId.fromString("0.0.1234")],
     *   nftIds: [new NftId(TokenId.fromString("0.0.9999"), 3)],
     *   ownerKey,
     * });
     * ```
     */
    async rejectTokensFlow(options: RejectTokensOptions) {
        return await this.rejectOperation.execute(options);
    }

    /**
     * Fetch a token's full definition (the token-class metadata): name,
     * symbol, decimals, total supply, treasury, keys, custom fees, pause
     * state, deletion state, etc.
     *
     * Works for **both** fungible tokens and NFT collections — the
     * returned `tokenType` distinguishes the two. For per-serial NFT
     * information (owner, metadata, approved spender), use
     * {@link TokenService.getNftInfo} instead.
     *
     * @param tokenId - The token entity ID (e.g., `"0.0.12345"`)
     * @param options - Optional query options (payer, payment caps, node targeting)
     * @returns A plain-object snapshot of the token definition. IDs and
     *          large numeric fields are stringified for ergonomics;
     *          keys are returned as raw SDK `Key` instances
     *
     * @example
     * ```typescript
     * const info = await tokenService.getTokenInfo("0.0.12345");
     * console.log(info.name, info.symbol, info.totalSupply);
     * if (info.tokenType === TokenType.NonFungibleUnique) {
     *   // ... per-collection logic
     * }
     * ```
     */
    async getTokenInfo(
        tokenId: string | TokenId,
        options?: QueryOptions,
    ): Promise<TokenInfoResult> {
        return await this.tokenInfoQuery.execute(tokenId, options);
    }

    /**
     * Fetch information about a single NFT serial — its current owner,
     * mint timestamp, metadata bytes, and any approved spender.
     *
     * Only applicable to tokens of type `NonFungibleUnique`. For the
     * collection-level metadata (name, symbol, supply key, etc.) use
     * {@link TokenService.getTokenInfo} instead.
     *
     * @param nftId - The NFT serial, either as an `NftId` instance or a
     *   `"<tokenId>/<serial>"` / `"<tokenId>@<serial>"` string
     * @param options - Optional query options (payer, payment caps, node targeting)
     * @returns A plain-object snapshot of the serial. IDs are
     *          stringified, `creationTime` is an ISO-8601 string, and
     *          `metadata` is the raw bytes the NFT was minted with
     *
     * @example
     * ```typescript
     * const nft = await tokenService.getNftInfo(
     *   new NftId(TokenId.fromString("0.0.12345"), 7),
     * );
     * console.log(nft.accountId, nft.serial, nft.metadata);
     * ```
     */
    async getNftInfo(
        nftId: string | NftId,
        options?: QueryOptions,
    ): Promise<TokenNftInfoResult> {
        return await this.tokenNftInfoQuery.execute(nftId, options);
    }

    private buildFungibleOperationOptions(
        options: CreateFungibleTokenOptions,
    ): TokenCreateOperationOptions {
        return {
            ...options,
            tokenType: TokenType.FungibleCommon,
            supplyType: this.resolveSupplyType(
                options.maxSupply,
                options.supplyType,
            ),
        };
    }

    private buildNftOperationOptions(
        options: CreateNftOptions,
    ): TokenCreateOperationOptions {
        return {
            ...options,
            tokenType: TokenType.NonFungibleUnique,
            decimals: 0,
            initialSupply: 0,
            supplyType: this.resolveSupplyType(
                options.maxSupply,
                options.supplyType,
            ),
        };
    }

    /**
     * Default `supplyType` to `Finite` when `maxSupply` is provided but
     * the caller didn't explicitly choose a supply type. Preserves any
     * explicit caller choice.
     */
    private resolveSupplyType(
        maxSupply: TokenCreateOperationOptions["maxSupply"],
        supplyType: TokenCreateOperationOptions["supplyType"],
    ): TokenSupplyType | undefined {
        if (supplyType != null) return supplyType;
        if (maxSupply != null) return TokenSupplyType.Finite;
        return undefined;
    }
}
