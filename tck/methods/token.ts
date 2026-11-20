import { Long, Timestamp, TokenSupplyType } from "@hiero-ledger/sdk";
import type { Key } from "@hiero-ledger/sdk";
import { TokenService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { createCustomFees } from "../utils/custom-fees.js";
import { notSupported } from "../errors.js";

interface TokenParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
    readonly tokenId?: string;
    readonly tokenIds?: string[];
    readonly accountId?: string;
    readonly name?: string;
    readonly symbol?: string;
    readonly decimals?: number;
    readonly initialSupply?: string;
    readonly treasuryAccountId?: string;
    readonly adminKey?: string;
    readonly kycKey?: string;
    readonly freezeKey?: string;
    readonly wipeKey?: string;
    readonly supplyKey?: string;
    readonly feeScheduleKey?: string;
    readonly pauseKey?: string;
    readonly metadataKey?: string;
    readonly freezeDefault?: boolean;
    readonly expirationTime?: string;
    readonly autoRenewAccountId?: string;
    readonly autoRenewPeriod?: string;
    readonly memo?: string;
    readonly tokenType?: string;
    readonly supplyType?: string;
    readonly maxSupply?: string;
    readonly customFees?: Record<string, unknown>[];
    readonly metadata?: string | string[];
    readonly amount?: string;
}

const service = (sessionId?: string) => new TokenService(contextFor(sessionId));

const key = (value: string | undefined): Key | undefined =>
    value == null ? undefined : (getKeyFromString(value) as Key);

const long = (value: string | undefined) =>
    value == null ? undefined : Long.fromString(value);

const timestamp = (value: string | undefined) =>
    value == null ? undefined : new Timestamp(Long.fromString(value), 0);

const supplyType = (value: string | undefined) => {
    if (value == null) return undefined;

    if (value === "finite") return TokenSupplyType.Finite;

    if (value === "infinite") return TokenSupplyType.Infinite;
    throw new Error(`Invalid supply type: ${value}`);
};

export const createToken = async (params: TokenParams) => {
    const common = {
        ...transactionOptions(params.commonTransactionParams),
        tokenName: params.name!,
        tokenSymbol: params.symbol!,
        treasuryAccountId: params.treasuryAccountId!,
        adminKey: key(params.adminKey),
        kycKey: key(params.kycKey),
        freezeKey: key(params.freezeKey),
        wipeKey: key(params.wipeKey),
        feeScheduleKey: key(params.feeScheduleKey),
        pauseKey: key(params.pauseKey),
        metadataKey: key(params.metadataKey),
        freezeDefault: params.freezeDefault,
        expirationTime: timestamp(params.expirationTime),
        autoRenewAccountId: params.autoRenewAccountId,
        autoRenewPeriod: long(params.autoRenewPeriod),
        tokenMemo: params.memo,
        supplyType: supplyType(params.supplyType),
        maxSupply: long(params.maxSupply),
        customFees: params.customFees?.length
            ? createCustomFees(params.customFees)
            : undefined,
        metadata:
            typeof params.metadata === "string"
                ? Buffer.from(params.metadata, "utf8")
                : undefined,
    };
    const tokens = service(params.sessionId);
    let result;

    if (params.tokenType === "nft") {
        // Core's NFT options fix decimals and initial supply at 0.
        if (
            params.decimals ||
            (params.initialSupply && params.initialSupply !== "0")
        ) {
            notSupported(
                "createToken for an NFT with decimals or an initial supply",
            );
        }
        result = await tokens.createNft({
            ...common,
            supplyKey: key(params.supplyKey)!,
        });
    } else if (params.tokenType == null || params.tokenType === "ft") {
        result = await tokens.createFungibleToken({
            ...common,
            supplyKey: key(params.supplyKey),
            decimals: params.decimals,
            initialSupply: long(params.initialSupply),
        });
    } else {
        throw new Error(`Invalid token type: ${params.tokenType}`);
    }

    return { tokenId: result.tokenId?.toString(), status: result.status };
};

export const updateToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).updateToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        tokenName: params.name,
        tokenSymbol: params.symbol,
        treasuryAccountId: params.treasuryAccountId,
        adminKey: key(params.adminKey),
        kycKey: key(params.kycKey),
        freezeKey: key(params.freezeKey),
        wipeKey: key(params.wipeKey),
        supplyKey: key(params.supplyKey),
        feeScheduleKey: key(params.feeScheduleKey),
        pauseKey: key(params.pauseKey),
        metadataKey: key(params.metadataKey),
        autoRenewAccountId: params.autoRenewAccountId,
        autoRenewPeriod: long(params.autoRenewPeriod),
        expirationTime: timestamp(params.expirationTime),
        tokenMemo: params.memo,
        metadata:
            typeof params.metadata === "string"
                ? Buffer.from(params.metadata, "utf8")
                : undefined,
    });

    return { status: result.status };
};

export const deleteToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).deleteToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
    });

    return { status: result.status };
};

export const updateTokenFeeSchedule = async (params: TokenParams) => {
    const result = await service(params.sessionId).updateTokenFeeSchedule({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        customFees: createCustomFees(params.customFees ?? []),
    });

    return { status: result.status };
};

export const associateToken = async (params: TokenParams) => {
    // Core associates one token per transaction.
    if ((params.tokenIds?.length ?? 0) > 1) {
        notSupported("associateToken with more than one token");
    }
    const result = await service(params.sessionId).associateToken({
        ...transactionOptions(params.commonTransactionParams),
        accountId: params.accountId!,
        tokenId: (params.tokenIds ?? [])[0],
    });

    return { status: result.status };
};

export const freezeToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).freezeToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        accountId: params.accountId!,
    });

    return { status: result.status };
};

export const pauseToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).pauseToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
    });

    return { status: result.status };
};

export const mintToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).mintToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        amount: long(params.amount),
        metadata: Array.isArray(params.metadata)
            ? params.metadata.map((value) => Buffer.from(value, "hex"))
            : undefined,
    });

    return {
        status: result.status,
        newTotalSupply: result.totalSupply,
        serialNumbers: result.serials.map(String),
    };
};
