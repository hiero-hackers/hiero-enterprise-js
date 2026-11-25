import { Hbar, Long, Timestamp } from "@hiero-ledger/sdk";
import type { Key } from "@hiero-ledger/sdk";
import { ContractService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { notSupported } from "../errors.js";

interface ContractParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
    readonly contractId?: string;
    readonly adminKey?: string;
    readonly gas?: string;
    readonly initialBalance?: string;
    readonly initcode?: string;
    readonly bytecodeFileId?: string;
    readonly stakedAccountId?: string;
    readonly stakedNodeId?: string;
    readonly declineStakingReward?: boolean;
    readonly autoRenewAccountId?: string;
    readonly autoRenewPeriod?: string;
    readonly constructorParameters?: string;
    readonly memo?: string;
    readonly maxAutomaticTokenAssociations?: number;
    readonly expirationTime?: string;
    readonly transferAccountId?: string;
    readonly transferContractId?: string;
    readonly permanentRemoval?: boolean;
    readonly amount?: string;
    readonly functionName?: string;
    readonly functionParameters?: string;
    readonly senderAccountId?: string;
    readonly queryPayment?: string;
    readonly maxQueryPayment?: string;
    readonly ethereumData?: string;
    readonly callDataFileId?: string;
    readonly maxGasAllowance?: string;
}

const service = (sessionId?: string) =>
    new ContractService(contextFor(sessionId));

const key = (value: string | undefined): Key | undefined =>
    value == null ? undefined : (getKeyFromString(value) as Key);

const long = (value: string | undefined): Long | undefined =>
    value == null ? undefined : Long.fromString(value);

const hbar = (tinybars: string | undefined): Hbar | undefined =>
    tinybars == null ? undefined : Hbar.fromTinybars(tinybars);

/** Decode a hex string, with or without `0x`; invalid hex is an internal error. */
const bytes = (hex: string | undefined): Uint8Array | undefined => {
    if (hex == null) return undefined;
    const text = hex.startsWith("0x") ? hex.slice(2) : hex;

    if (text.length % 2 !== 0 || /[^0-9a-fA-F]/.test(text)) {
        throw new Error(`Invalid hex string: ${hex}`);
    }

    return Buffer.from(text, "hex");
};

const queryOptions = (params: ContractParams) => ({
    queryPayment: hbar(params.queryPayment),
    maxQueryPayment: hbar(params.maxQueryPayment),
});

export const createContract = async (params: ContractParams) => {
    const result = await service(params.sessionId).createContract({
        ...transactionOptions(params.commonTransactionParams),
        bytecodeFileId: params.bytecodeFileId,
        bytecode: bytes(params.initcode),
        gas: long(params.gas)!,
        initialBalance: hbar(params.initialBalance),
        adminKey: key(params.adminKey),
        constructorParameters: bytes(params.constructorParameters),
        contractMemo: params.memo,
        autoRenewPeriod: long(params.autoRenewPeriod),
        autoRenewAccountId: params.autoRenewAccountId,
        stakedAccountId: params.stakedAccountId,
        stakedNodeId: long(params.stakedNodeId),
        declineStakingReward: params.declineStakingReward,
        maxAutomaticTokenAssociations: params.maxAutomaticTokenAssociations,
    });

    return { contractId: result.contractId.toString(), status: result.status };
};

export const updateContract = async (params: ContractParams) => {
    const result = await service(params.sessionId).updateContract({
        ...transactionOptions(params.commonTransactionParams),
        contractId: params.contractId!,
        adminKey: key(params.adminKey),
        contractMemo: params.memo,
        autoRenewPeriod: long(params.autoRenewPeriod),
        autoRenewAccountId: params.autoRenewAccountId,
        expirationTime:
            params.expirationTime != null
                ? new Timestamp(Long.fromString(params.expirationTime), 0)
                : undefined,
        stakedAccountId: params.stakedAccountId,
        stakedNodeId: long(params.stakedNodeId),
        declineStakingReward: params.declineStakingReward,
        maxAutomaticTokenAssociations: params.maxAutomaticTokenAssociations,
    });

    return { status: result.status };
};

export const deleteContract = async (params: ContractParams) => {
    if (params.permanentRemoval != null) {
        notSupported("permanentRemoval on deleteContract");
    }
    const result = await service(params.sessionId).deleteContract({
        ...transactionOptions(params.commonTransactionParams),
        contractId: params.contractId!,
        transferAccountId: params.transferAccountId,
        transferContractId: params.transferContractId,
    });

    return { status: result.status };
};

export const executeContract = async (params: ContractParams) => {
    const result = await service(params.sessionId).executeContract({
        ...transactionOptions(params.commonTransactionParams),
        contractId: params.contractId!,
        gas: long(params.gas)!,
        payableAmount: hbar(params.amount),
        rawFunctionParameters: bytes(params.functionParameters),
    });

    return { status: result.status };
};

export const contractCallQuery = async (params: ContractParams) => {
    const result = await service(params.sessionId).callContract({
        ...queryOptions(params),
        contractId: params.contractId!,
        gas: long(params.gas)!,
        functionName: params.functionName,
        rawFunctionParameters: bytes(params.functionParameters),
        senderAccountId: params.senderAccountId,
    });

    return {
        contractId: result.contractId?.toString(),
        evmAddress: result.evmAddress
            ? Buffer.from(result.evmAddress).toString("hex")
            : undefined,
        errorMessage: result.errorMessage || undefined,
        gasUsed: result.gasUsed?.toString(),
        gas: result.gas?.toString(),
        hbarAmount: result.amount?.toString(),
        senderAccountId: result.senderAccountId?.toString(),
        signerNonce: result.signerNonce?.toString(),
        rawResult: Buffer.from(result.asBytes()).toString("hex"),
    };
};

export const contractByteCodeQuery = async (params: ContractParams) => {
    const bytecode = await service(params.sessionId).getContractBytecode(
        params.contractId!,
        queryOptions(params),
    );

    return {
        bytecode:
            bytecode.length > 0
                ? `0x${Buffer.from(bytecode).toString("hex")}`
                : undefined,
        contractId: params.contractId,
    };
};

export const contractInfoQuery = async (params: ContractParams) => {
    const info = await service(params.sessionId).getContractInfo(
        params.contractId!,
        queryOptions(params),
    );

    return {
        contractId: info.contractId?.toString(),
        accountId: info.accountId?.toString(),
        contractAccountId: info.contractAccountId,
        adminKey: info.adminKey?.toString(),
        expirationTime: info.expirationTime?.toString(),
        autoRenewPeriod: info.autoRenewPeriod?.seconds?.toString(),
        autoRenewAccountId: info.autoRenewAccountId?.toString(),
        storage: info.storage?.toString(),
        contractMemo: info.contractMemo,
        balance: info.balance?.toTinybars().toString(),
        isDeleted: info.isDeleted,
        maxAutomaticTokenAssociations:
            info.maxAutomaticTokenAssociations?.toString(),
        ledgerId: info.ledgerId?.toString(),
        stakingInfo: {
            declineStakingReward: info.stakingInfo?.declineStakingReward,
            stakePeriodStart: info.stakingInfo?.stakePeriodStart?.toString(),
            pendingReward: info.stakingInfo?.pendingReward
                ?.toTinybars()
                .toString(),
            stakedToMe: info.stakingInfo?.stakedToMe?.toTinybars().toString(),
            stakedAccountId: info.stakingInfo?.stakedAccountId?.toString(),
            stakedNodeId: info.stakingInfo?.stakedNodeId?.toString(),
        },
    };
};

export const createEthereumTransaction = async (params: ContractParams) => {
    const result = await service(params.sessionId).executeEthereumTransaction({
        ...transactionOptions(params.commonTransactionParams),
        ethereumData: bytes(params.ethereumData)!,
        callDataFileId: params.callDataFileId,
        maxGasAllowance: hbar(params.maxGasAllowance),
    });

    return {
        status: result.status,
        contractId: result.contractId?.toString(),
    };
};
