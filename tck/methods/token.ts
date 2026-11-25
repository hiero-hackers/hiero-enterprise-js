import {
    CustomFixedFee,
    CustomFractionalFee,
    CustomRoyaltyFee,
    Hbar,
    Long,
    Timestamp,
    TokenSupplyType,
} from "@hiero-ledger/sdk";
import type { CustomFee, Key } from "@hiero-ledger/sdk";
import { AccountService, TokenService } from "@hiero-hackers/enterprise-core";
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
    readonly serialNumbers?: string[];
    readonly nftId?: string;
    readonly queryPayment?: string;
    readonly maxQueryPayment?: string;
    readonly getCost?: boolean;
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
    if (!params.tokenIds?.length) notSupported("associateToken with no tokens");

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

const serials = (values: string[] | undefined) =>
    values?.map((value) => Long.fromString(value));

const queryOptions = (params: TokenParams) => ({
    queryPayment: params.queryPayment
        ? Hbar.fromTinybars(params.queryPayment)
        : undefined,
    maxQueryPayment: params.maxQueryPayment
        ? Hbar.fromTinybars(params.maxQueryPayment)
        : undefined,
});

export const dissociateToken = async (params: TokenParams) => {
    if (!params.tokenIds?.length) {
        notSupported("dissociateToken with no tokens");
    }
    const result = await service(params.sessionId).dissociateToken({
        ...transactionOptions(params.commonTransactionParams),
        accountId: params.accountId!,
        tokenIds: params.tokenIds ?? [],
    });

    return { status: result.status };
};

export const unfreezeToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).unfreezeToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        accountId: params.accountId!,
    });

    return { status: result.status };
};

export const unpauseToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).unpauseToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
    });

    return { status: result.status };
};

export const grantTokenKyc = async (params: TokenParams) => {
    const result = await service(params.sessionId).grantKycToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        accountId: params.accountId!,
    });

    return { status: result.status };
};

export const revokeTokenKyc = async (params: TokenParams) => {
    const result = await service(params.sessionId).revokeKycToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        accountId: params.accountId!,
    });

    return { status: result.status };
};

export const burnToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).burnToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        amount: long(params.amount),
        serials: serials(params.serialNumbers),
    });

    return { status: result.status, newTotalSupply: result.totalSupply };
};

export const wipeToken = async (params: TokenParams) => {
    const result = await service(params.sessionId).wipeToken({
        ...transactionOptions(params.commonTransactionParams),
        tokenId: params.tokenId!,
        accountId: params.accountId!,
        amount: long(params.amount),
        serials: serials(params.serialNumbers),
    });

    return { status: result.status };
};

export const getMirrorNodeTokenBalance = async (params: TokenParams) => {
    const accounts = new AccountService(contextFor(params.sessionId));
    const balance = await accounts.getTokenBalance(
        params.accountId!,
        params.tokenId!,
    );

    return {
        tokenId: balance.tokenId,
        balance: balance.balance,
        decimals: balance.decimals,
    };
};

const accountParts = (accountId: { toString(): string } | null | undefined) => {
    if (accountId == null) return null;
    const [shard, realm, num] = accountId.toString().split(".");

    return { shard, realm, num };
};

const customFee = (fee: CustomFee) => {
    const common = {
        feeCollectorAccountId: accountParts(fee.feeCollectorAccountId),
        allCollectorsAreExempt: fee.allCollectorsAreExempt,
    };

    if (fee instanceof CustomFixedFee) {
        return {
            ...common,
            fixedFee: {
                amount: fee.amount?.toString(),
                denominatingTokenId:
                    fee.denominatingTokenId?.toString() ?? null,
            },
        };
    }

    if (fee instanceof CustomFractionalFee) {
        return {
            ...common,
            fractionalFee: {
                numerator: fee.numerator.toString(),
                denominator: fee.denominator.toString(),
                minimumAmount: fee.min?.toString() || "0",
                maximumAmount: fee.max?.toString() || "0",
                assessmentMethod:
                    fee.assessmentMethod?.toString().toLowerCase() ||
                    "inclusive",
            },
        };
    }

    if (fee instanceof CustomRoyaltyFee) {
        return {
            ...common,
            royaltyFee: {
                numerator: fee.numerator.toString(),
                denominator: fee.denominator.toString(),
                fallbackFee: fee.fallbackFee
                    ? {
                          amount: fee.fallbackFee.amount?.toString(),
                          denominatingTokenId:
                              fee.fallbackFee.denominatingTokenId?.toString() ??
                              null,
                      }
                    : null,
            },
        };
    }

    return fee;
};

const hex = (bytes: Uint8Array | null) =>
    bytes && bytes.length > 0 ? Buffer.from(bytes).toString("hex") : "";

const seconds = (iso: string | null) =>
    iso ? String(Math.floor(Date.parse(iso) / 1000)) : undefined;

export const getTokenInfo = async (params: TokenParams) => {
    if (params.getCost) notSupported("getCost on getTokenInfo");
    const info = await service(params.sessionId).getTokenInfo(
        params.tokenId!,
        queryOptions(params),
    );

    return {
        tokenId: info.tokenId,
        name: info.name,
        symbol: info.symbol,
        decimals: info.decimals,
        totalSupply: info.totalSupply,
        treasuryAccountId: info.treasuryAccountId ?? undefined,
        adminKey: info.adminKey?.toString() ?? "",
        kycKey: info.kycKey?.toString() ?? "",
        freezeKey: info.freezeKey?.toString() ?? "",
        pauseKey: info.pauseKey?.toString() ?? "",
        wipeKey: info.wipeKey?.toString() ?? "",
        supplyKey: info.supplyKey?.toString() ?? "",
        feeScheduleKey: info.feeScheduleKey?.toString() ?? "",
        metadataKey: info.metadataKey?.toString() ?? "",
        defaultFreezeStatus: info.defaultFreezeStatus,
        defaultKycStatus: info.defaultKycStatus,
        pauseStatus: info.pauseStatus == null ? null : String(info.pauseStatus),
        isDeleted: info.isDeleted,
        autoRenewAccountId: info.autoRenewAccountId ?? undefined,
        autoRenewPeriod: info.autoRenewPeriod?.toString(),
        expirationTime: seconds(info.expirationTime),
        tokenMemo: info.tokenMemo,
        customFees: info.customFees.map(customFee),
        tokenType: info.tokenType?.toString(),
        supplyType: info.supplyType?.toString(),
        maxSupply: info.maxSupply ?? undefined,
        metadata: hex(info.metadata),
        ledgerId: info.ledgerId ?? undefined,
    };
};

export const getTokenNftInfo = async (params: TokenParams) => {
    if (params.getCost) notSupported("getCost on getTokenNftInfo");
    const info = await service(params.sessionId).getNftInfo(
        params.nftId!,
        queryOptions(params),
    );

    return {
        nftId: info.nftId,
        accountId: info.accountId,
        creationTime: seconds(info.creationTime),
        metadata: hex(info.metadata),
        ledgerId: info.ledgerId ?? undefined,
        spenderId: info.spenderId,
    };
};
