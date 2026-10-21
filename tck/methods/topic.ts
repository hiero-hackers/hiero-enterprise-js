import {
    AccountId,
    CustomFeeLimit,
    CustomFixedFee,
    Hbar,
    Long,
    Timestamp,
} from "@hiero-ledger/sdk";
import type { Key } from "@hiero-ledger/sdk";
import { TopicService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { notSupported } from "../errors.js";

interface FixedFee {
    readonly amount: string;
    readonly denominatingTokenId?: string;
}

interface CustomFee {
    readonly feeCollectorAccountId: string;
    readonly feeCollectorsExempt: boolean;
    readonly fixedFee: FixedFee;
}

interface TopicParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
    readonly topicId?: string;
    readonly memo?: string;
    readonly adminKey?: string;
    readonly submitKey?: string;
    readonly autoRenewPeriod?: string;
    readonly autoRenewAccountId?: string;
    readonly expirationTime?: string;
    readonly feeScheduleKey?: string;
    readonly feeExemptKeys?: string[];
    readonly customFees?: CustomFee[];
    readonly message?: string;
    readonly maxChunks?: number;
    readonly chunkSize?: number;
    readonly customFeeLimits?: {
        readonly payerId: string;
        readonly fixedFees: FixedFee[];
    }[];
    readonly queryPayment?: string;
    readonly maxQueryPayment?: string;
    readonly getCost?: boolean;
}

const service = (sessionId?: string) => new TopicService(contextFor(sessionId));

const key = (value: string | undefined): Key | undefined =>
    value == null ? undefined : (getKeyFromString(value) as Key);

const fixedFee = (fee: FixedFee): CustomFixedFee =>
    fee.denominatingTokenId
        ? new CustomFixedFee()
              .setAmount(Long.fromString(fee.amount))
              .setDenominatingTokenId(fee.denominatingTokenId)
        : new CustomFixedFee().setHbarAmount(
              Hbar.fromTinybars(Long.fromString(fee.amount)),
          );

const customFees = (fees: CustomFee[]): CustomFixedFee[] =>
    fees.map((fee) =>
        fixedFee(fee.fixedFee)
            .setFeeCollectorAccountId(fee.feeCollectorAccountId)
            .setAllCollectorsAreExempt(fee.feeCollectorsExempt),
    );

export const createTopic = async (params: TopicParams) => {
    const result = await service(params.sessionId).createTopic({
        ...transactionOptions(params.commonTransactionParams),
        topicMemo: params.memo,
        adminKey: key(params.adminKey),
        submitKey: key(params.submitKey),
        autoRenewPeriod:
            params.autoRenewPeriod != null
                ? Long.fromString(params.autoRenewPeriod)
                : undefined,
        autoRenewAccountId: params.autoRenewAccountId,
        feeScheduleKey: key(params.feeScheduleKey),
        feeExemptKeys: params.feeExemptKeys?.length
            ? params.feeExemptKeys.map((k) => key(k)!)
            : undefined,
        customFees: params.customFees?.length
            ? customFees(params.customFees)
            : undefined,
    });
    return { topicId: result.topicId?.toString(), status: result.status };
};

export const updateTopic = async (params: TopicParams) => {
    const result = await service(params.sessionId).updateTopic({
        ...transactionOptions(params.commonTransactionParams),
        topicId: params.topicId!,
        topicMemo: params.memo,
        adminKey: key(params.adminKey),
        submitKey: key(params.submitKey),
        autoRenewPeriod:
            params.autoRenewPeriod != null
                ? Long.fromString(params.autoRenewPeriod)
                : undefined,
        autoRenewAccountId: params.autoRenewAccountId,
        expirationTime:
            params.expirationTime != null
                ? new Timestamp(Long.fromString(params.expirationTime), 0)
                : undefined,
        feeScheduleKey: key(params.feeScheduleKey),
        // An empty list clears the keys / fees, as in the reference adapter.
        feeExemptKeys:
            params.feeExemptKeys == null
                ? undefined
                : params.feeExemptKeys.length === 0
                  ? null
                  : params.feeExemptKeys.map((k) => key(k)!),
        customFees:
            params.customFees == null
                ? undefined
                : params.customFees.length === 0
                  ? null
                  : customFees(params.customFees),
    });
    return { status: result.status };
};

export const deleteTopic = async (params: TopicParams) => {
    const result = await service(params.sessionId).deleteTopic({
        ...transactionOptions(params.commonTransactionParams),
        topicId: params.topicId!,
    });
    return { status: result.status };
};

export const submitTopicMessage = async (params: TopicParams) => {
    const result = await service(params.sessionId).submitMessage({
        ...transactionOptions(params.commonTransactionParams),
        topicId: params.topicId!,
        message: params.message!,
        maxChunks: params.maxChunks,
        chunkSize: params.chunkSize,
        customFeeLimits: params.customFeeLimits?.map((limit) =>
            new CustomFeeLimit()
                .setAccountId(AccountId.fromString(limit.payerId))
                .setFees(limit.fixedFees.map(fixedFee)),
        ),
    });
    return { status: result.status };
};

export const getTopicInfo = async (params: TopicParams) => {
    if (params.getCost) notSupported("getCost on getTopicInfo");
    const info = await service(params.sessionId).getTopicInfo(params.topicId!, {
        queryPayment: params.queryPayment
            ? Hbar.fromTinybars(params.queryPayment)
            : undefined,
        maxQueryPayment: params.maxQueryPayment
            ? Hbar.fromTinybars(params.maxQueryPayment)
            : undefined,
    });
    return {
        topicId: info.topicId,
        topicMemo: info.topicMemo,
        runningHash:
            info.runningHash.length > 0
                ? Buffer.from(info.runningHash).toString("hex")
                : undefined,
        sequenceNumber: info.sequenceNumber,
        expirationTime: info.expirationTime
            ? String(Math.floor(Date.parse(info.expirationTime) / 1000))
            : undefined,
        adminKey: info.adminKey?.toString(),
        submitKey: info.submitKey?.toString(),
        feeScheduleKey: info.feeScheduleKey?.toString(),
        feeExemptKeys: info.feeExemptKeys?.length
            ? info.feeExemptKeys.map((k) => k.toString())
            : undefined,
        autoRenewPeriod: info.autoRenewPeriod?.toString(),
        autoRenewAccountId: info.autoRenewAccountId ?? undefined,
        customFees: (info.customFees ?? []).map((fee) => ({
            feeCollectorAccountId: fee.feeCollectorAccountId?.toString(),
            allCollectorsAreExempt: fee.allCollectorsAreExempt,
            fixedFee: {
                amount: fee.amount?.toString(),
                denominatingTokenId:
                    fee.denominatingTokenId?.toString() || null,
            },
        })),
        ledgerId: info.ledgerId ?? undefined,
    };
};
