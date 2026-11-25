import { Hbar, Long, Timestamp } from "@hiero-ledger/sdk";
import type { Key } from "@hiero-ledger/sdk";
import { FileService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { notSupported } from "../errors.js";

interface FileParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
    readonly fileId?: string;
    readonly keys?: string[];
    readonly contents?: string;
    readonly expirationTime?: string;
    readonly memo?: string;
    readonly maxChunks?: number;
    readonly chunkSize?: number;
    readonly queryPayment?: string;
    readonly maxQueryPayment?: string;
    readonly getCost?: boolean;
}

const service = (sessionId?: string) => new FileService(contextFor(sessionId));

const keys = (values: string[] | undefined): Key[] | undefined =>
    values == null
        ? undefined
        : values.map((value) => getKeyFromString(value) as Key);

const expiration = (value: string | undefined): Timestamp | undefined =>
    value != null ? new Timestamp(Long.fromString(value), 0) : undefined;

const queryOptions = (params: FileParams) => ({
    queryPayment: params.queryPayment
        ? Hbar.fromTinybars(params.queryPayment)
        : undefined,
    maxQueryPayment: params.maxQueryPayment
        ? Hbar.fromTinybars(params.maxQueryPayment)
        : undefined,
});

export const createFile = async (params: FileParams) => {
    const result = await service(params.sessionId).createFile({
        ...transactionOptions(params.commonTransactionParams),
        keys: keys(params.keys),
        contents: params.contents,
        expirationTime: expiration(params.expirationTime),
        fileMemo: params.memo,
    });

    return { fileId: result.fileId?.toString(), status: result.status };
};

export const updateFile = async (params: FileParams) => {
    const result = await service(params.sessionId).updateFile({
        ...transactionOptions(params.commonTransactionParams),
        fileId: params.fileId!,
        keys: keys(params.keys),
        contents: params.contents,
        expirationTime: expiration(params.expirationTime),
        fileMemo: params.memo,
    });

    return { status: result.status };
};

export const appendFile = async (params: FileParams) => {
    const result = await service(params.sessionId).appendToFile({
        ...transactionOptions(params.commonTransactionParams),
        fileId: params.fileId!,
        contents: params.contents!,
        maxChunks: params.maxChunks,
        chunkSize: params.chunkSize,
    });

    return { status: result.status };
};

export const deleteFile = async (params: FileParams) => {
    const result = await service(params.sessionId).deleteFile({
        ...transactionOptions(params.commonTransactionParams),
        fileId: params.fileId!,
    });

    return { status: result.status };
};

export const getFileContents = async (params: FileParams) => {
    const contents = await service(params.sessionId).getFileContents(
        params.fileId!,
        queryOptions(params),
    );

    return { contents: new TextDecoder().decode(contents) };
};

export const getFileInfo = async (params: FileParams) => {
    if (params.getCost) notSupported("getCost on getFileInfo");
    const info = await service(params.sessionId).getFileInfo(
        params.fileId!,
        queryOptions(params),
    );

    return {
        fileId: info.fileId,
        size: String(info.size),
        expirationTime: info.expirationTime
            ? String(Math.floor(Date.parse(info.expirationTime) / 1000))
            : undefined,
        isDeleted: info.isDeleted,
        keys: info.keys?.toArray().map((key) => key.toString()) ?? [],
        memo: info.fileMemo,
        ledgerId: info.ledgerId ?? undefined,
    };
};
