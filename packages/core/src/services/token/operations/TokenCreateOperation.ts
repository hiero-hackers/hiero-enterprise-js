import type BigNumber from "bignumber.js";
import type {
    Key,
    Long,
    Timestamp,
    AccountId,
    CustomFee,
    TokenType,
    TokenSupplyType,
} from "@hiero-ledger/sdk";
import { TokenCreateTransaction } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TokenCreateValidator } from "../validation/index.js";
import { HieroError } from "../../../errors/HieroError.js";

/**
 * Low-level options for the `TokenCreate` SDK transaction.
 *
 * Mirrors the surface of `TokenCreateTransaction` 1:1. Callers usually go
 * through `TokenService.createFungibleToken` / `createNft`, which expose
 * friendlier shapes and set `tokenType` / `decimals` / `initialSupply`
 * automatically.
 *
 * Extends `TransactionOptions` for fees, validity window, additional signers,
 * and scheduling.
 */
export interface TokenCreateOperationOptions extends TransactionOptions {
    tokenName: string;
    tokenSymbol: string;
    decimals?: number | Long;
    initialSupply?: Long | number | BigNumber | bigint;
    treasuryAccountId: string | AccountId;
    adminKey?: Key;
    kycKey?: Key;
    freezeKey?: Key;
    pauseKey?: Key;
    wipeKey?: Key;
    supplyKey?: Key;
    feeScheduleKey?: Key;
    freezeDefault?: boolean;
    autoRenewAccountId?: string | AccountId;
    expirationTime?: Timestamp | Date;
    autoRenewPeriod?: Long | number;
    tokenMemo?: string;
    customFees?: CustomFee[];
    tokenType?: TokenType;
    supplyType?: TokenSupplyType;
    maxSupply?: Long | number | BigNumber | bigint;
    metadataKey?: Key;
    metadata?: Uint8Array;
}

export class TokenCreateOperation extends BaseOperation<TokenCreateOperationOptions> {
    protected readonly type = "TokenCreate";
    protected readonly serviceName = "TokenService";
    protected readonly methodName = "createToken";
    protected readonly validator = new TokenCreateValidator();

    /** Submit a `TokenCreateTransaction` and return the new token ID. */
    async execute(options: TokenCreateOperationOptions) {
        const results = await this.run(options);

        if (!results.receipt.tokenId) {
            throw new HieroError(
                "Token creation failed — no tokenId returned in receipt.",
                {
                    code: "SDK_ERROR",
                    context: "TokenCreateOperation.execute",
                    sdkStatus: results.status,
                    transactionId: results.transactionId,
                },
            );
        }

        return {
            ...results,
            tokenId: results.receipt.tokenId,
        };
    }

    /** Schedule a `TokenCreateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenCreateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.scheduleRun(options, scheduleOptions);
    }

    /**
     * Construct the `TokenCreateTransaction` from the caller-provided options.
     *
     * Only setters for fields that were actually provided are invoked so the
     * SDK defaults remain in effect for omitted options.
     */
    protected build(
        options: TokenCreateOperationOptions,
    ): TokenCreateTransaction {
        const tx = new TokenCreateTransaction()
            .setTokenName(options.tokenName)
            .setTokenSymbol(options.tokenSymbol)
            .setTreasuryAccountId(options.treasuryAccountId);

        if (options.tokenType != null) {
            tx.setTokenType(options.tokenType);
        }

        if (options.decimals != null) {
            tx.setDecimals(options.decimals);
        }

        if (options.initialSupply != null) {
            tx.setInitialSupply(options.initialSupply);
        }

        if (options.adminKey != null) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.kycKey != null) {
            tx.setKycKey(options.kycKey);
        }

        if (options.freezeKey != null) {
            tx.setFreezeKey(options.freezeKey);
        }

        if (options.pauseKey != null) {
            tx.setPauseKey(options.pauseKey);
        }

        if (options.wipeKey != null) {
            tx.setWipeKey(options.wipeKey);
        }

        if (options.supplyKey != null) {
            tx.setSupplyKey(options.supplyKey);
        }

        if (options.feeScheduleKey != null) {
            tx.setFeeScheduleKey(options.feeScheduleKey);
        }

        if (options.freezeDefault != null) {
            tx.setFreezeDefault(options.freezeDefault);
        }

        if (options.autoRenewAccountId != null) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.tokenMemo != null) {
            tx.setTokenMemo(options.tokenMemo);
        }

        if (options.customFees != null && options.customFees.length > 0) {
            tx.setCustomFees(options.customFees);
        }

        if (options.supplyType != null) {
            tx.setSupplyType(options.supplyType);
        }

        if (options.maxSupply != null) {
            tx.setMaxSupply(options.maxSupply);
        }

        if (options.metadataKey != null) {
            tx.setMetadataKey(options.metadataKey);
        }

        if (options.metadata != null) {
            tx.setMetadata(options.metadata);
        }

        return tx;
    }
}
