import { Hbar, Long } from "@hiero-ledger/sdk";
import type { Key, PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    ScheduleService,
    TokenService,
    TopicService,
} from "@hiero-hackers/enterprise-core";
import type { ScheduleOptions } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { notSupported } from "../errors.js";

interface ScheduledParams {
    readonly tokenId?: string;
    readonly amount?: string;
    readonly metadata?: string[];
    readonly serialNumbers?: string[];
    readonly memo?: string;
    readonly adminKey?: string;
    readonly submitKey?: string;
    readonly transfers?: { hbar?: { accountId?: string; amount: string } }[];
}

interface ScheduledTransaction {
    readonly method: string;
    readonly params?: ScheduledParams;
}

interface ScheduleParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
    readonly scheduleId?: string;
    readonly scheduledTransaction?: ScheduledTransaction;
    readonly memo?: string;
    readonly adminKey?: string;
    readonly payerAccountId?: string;
    readonly expirationTime?: string;
    readonly waitForExpiry?: boolean;
    readonly queryPayment?: string;
    readonly maxQueryPayment?: string;
    readonly getCost?: boolean;
}

const key = (value: string | undefined): Key | undefined =>
    value == null ? undefined : (getKeyFromString(value) as Key);

/** Schedule the inner transaction through the matching core `schedule…` method. */
async function schedule(
    sessionId: string | undefined,
    transaction: ScheduledTransaction,
    options: ReturnType<typeof transactionOptions>,
    scheduleOptions: ScheduleOptions,
) {
    const context = contextFor(sessionId);
    const params = transaction.params ?? {};

    if (transaction.method === "transferCrypto") {
        const transfers = params.transfers ?? [];

        if (
            transfers.length !== 2 ||
            transfers.some((t) => !t.hbar?.accountId)
        ) {
            notSupported(
                "a scheduled transferCrypto other than a two-leg HBAR transfer",
            );
        }
        const [from, to] = [...transfers].sort(
            (a, b) => Number(a.hbar!.amount) - Number(b.hbar!.amount),
        );

        if (Number(from.hbar!.amount) + Number(to.hbar!.amount) !== 0) {
            notSupported("a scheduled transferCrypto with unbalanced legs");
        }

        return await new AccountService(context).scheduleTransferHbar(
            to.hbar!.accountId!,
            Hbar.fromTinybars(to.hbar!.amount),
            from.hbar!.accountId!,
            { ...options, ...scheduleOptions },
        );
    }

    if (transaction.method === "mintToken") {
        return await new TokenService(context).scheduleMintToken(
            {
                ...options,
                tokenId: params.tokenId,
                amount:
                    params.amount != null
                        ? Long.fromString(params.amount)
                        : undefined,
                metadata: Array.isArray(params.metadata)
                    ? params.metadata.map((value) => Buffer.from(value, "hex"))
                    : undefined,
            },
            scheduleOptions,
        );
    }

    if (transaction.method === "burnToken") {
        return await new TokenService(context).scheduleBurnToken(
            {
                ...options,
                tokenId: params.tokenId,
                amount:
                    params.amount != null
                        ? Long.fromString(params.amount)
                        : undefined,
                serials: params.serialNumbers?.map((serial) =>
                    Long.fromString(serial),
                ),
            },
            scheduleOptions,
        );
    }

    if (transaction.method === "createTopic") {
        return await new TopicService(context).scheduleCreateTopic(
            {
                ...options,
                topicMemo: params.memo,
                adminKey: key(params.adminKey),
                submitKey: key(params.submitKey),
            },
            scheduleOptions,
        );
    }

    return notSupported(`scheduling ${transaction.method}`);
}

export const createSchedule = async (params: ScheduleParams) => {
    if (params.scheduledTransaction == null) {
        notSupported("a schedule without a scheduled transaction");
    }

    if (params.expirationTime != null) {
        notSupported("a schedule expirationTime");
    }

    if (params.waitForExpiry) notSupported("a schedule waitForExpiry");

    const result = await schedule(
        params.sessionId,
        params.scheduledTransaction,
        transactionOptions(params.commonTransactionParams),
        {
            payerAccountId: params.payerAccountId,
            adminKey: key(params.adminKey),
            scheduleMemo: params.memo,
        },
    );

    return {
        scheduleId: result.scheduleId.toString(),
        // The scheduled (inner) transaction's ID, as the reference adapter returns.
        transactionId: result.receipt.scheduledTransactionId?.toString(),
        status: result.status,
    };
};

export const signSchedule = async (params: ScheduleParams) => {
    const result = await new ScheduleService(contextFor(params.sessionId)).sign(
        {
            ...transactionOptions(params.commonTransactionParams),
            scheduleId: params.scheduleId!,
        },
    );

    return { status: result.status };
};

export const deleteSchedule = async (params: ScheduleParams) => {
    // Core signs with `adminKey`; the TCK passes the admin key as the first
    // signer.
    const options = transactionOptions(params.commonTransactionParams);
    const [adminKey, ...others] = options.additionalSigners ?? [];
    const result = await new ScheduleService(
        contextFor(params.sessionId),
    ).cancel({
        ...options,
        additionalSigners: others,
        scheduleId: params.scheduleId!,
        adminKey: adminKey as PrivateKey,
    });

    return { status: result.status };
};

export const getScheduleInfo = async (params: ScheduleParams) => {
    if (params.getCost) notSupported("getCost on getScheduleInfo");
    const info = await new ScheduleService(
        contextFor(params.sessionId),
    ).getInfo(params.scheduleId!, {
        queryPayment: params.queryPayment
            ? Hbar.fromTinybars(params.queryPayment)
            : undefined,
        maxQueryPayment: params.maxQueryPayment
            ? Hbar.fromTinybars(params.maxQueryPayment)
            : undefined,
    });

    return {
        scheduleId: info.scheduleId,
        creatorAccountId: info.creatorAccountId ?? undefined,
        payerAccountId: info.payerAccountId ?? undefined,
        scheduleMemo: info.scheduleMemo ?? undefined,
        adminKey: info.adminKey?.toString(),
        signers: info.signers.map((signer) => signer.toString()),
        expirationTime: info.expiresAt ?? undefined,
        executedAt: info.executedAt ?? undefined,
        deletedAt: info.deletedAt ?? undefined,
        scheduledTransactionId: info.scheduledTransactionId ?? undefined,
        waitForExpiry: info.waitForExpiry,
    };
};
