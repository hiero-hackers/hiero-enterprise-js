import { Hbar, Long } from "@hiero-ledger/sdk";
import type { Key, PrivateKey } from "@hiero-ledger/sdk";
import { AccountService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { notSupported } from "../errors.js";

interface BaseParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
}

interface AccountParams extends BaseParams {
    readonly accountId?: string;
    readonly deleteAccountId?: string;
    readonly transferAccountId?: string;
    readonly key?: string;
    readonly initialBalance?: string;
    readonly receiverSignatureRequired?: boolean;
    readonly maxAutoTokenAssociations?: number;
    readonly stakedAccountId?: string;
    readonly stakedNodeId?: string;
    readonly declineStakingReward?: boolean;
    readonly memo?: string;
    readonly autoRenewPeriod?: string;
    readonly expirationTime?: string;
    readonly alias?: string;
}

interface Transfer {
    readonly hbar?: { accountId?: string; evmAddress?: string; amount: string };
    readonly token?: {
        accountId: string;
        tokenId: string;
        amount: string;
        decimals?: number;
    };
    readonly nft?: {
        senderAccountId: string;
        receiverAccountId: string;
        tokenId: string;
        serialNumber: string;
    };
    readonly approved?: boolean;
}

interface Allowance {
    readonly ownerAccountId: string;
    readonly spenderAccountId: string;
    readonly hbar?: { amount: string };
    readonly token?: { tokenId: string; amount: string };
    readonly nft?: {
        tokenId: string;
        serialNumbers?: string[];
        approvedForAll?: boolean;
        delegateSpenderAccountId?: string;
    };
}

const service = (sessionId?: string) =>
    new AccountService(contextFor(sessionId));

const optionalNumber = (value: string | undefined) =>
    value == null ? undefined : Number(value);

export const createAccount = async (params: AccountParams) => {
    // Core derives an alias from the key; it can't set an arbitrary one.
    if (params.alias != null) notSupported("createAccount with an alias");
    const account = await service(params.sessionId).createAccount({
        ...transactionOptions(params.commonTransactionParams),
        key:
            params.key != null
                ? (getKeyFromString(params.key) as Key)
                : undefined,
        initialBalance:
            params.initialBalance != null
                ? Hbar.fromTinybars(params.initialBalance)
                : undefined,
        receiverSignatureRequired: params.receiverSignatureRequired,
        maxAutomaticTokenAssociations: params.maxAutoTokenAssociations,
        stakedAccountId: params.stakedAccountId,
        stakedNodeId: optionalNumber(params.stakedNodeId),
        declineStakingReward: params.declineStakingReward,
        memo: params.memo,
        autoRenewPeriod: optionalNumber(params.autoRenewPeriod),
    });
    // Core throws on any status other than SUCCESS.
    return { accountId: account.accountId.toString(), status: "SUCCESS" };
};

export const updateAccount = async (params: AccountParams) => {
    const result = await service(params.sessionId).updateAccount({
        ...transactionOptions(params.commonTransactionParams),
        accountId: params.accountId!,
        key:
            params.key != null
                ? (getKeyFromString(params.key) as Key)
                : undefined,
        autoRenewPeriod: optionalNumber(params.autoRenewPeriod),
        expirationTime:
            params.expirationTime != null
                ? new Date(
                      Long.fromString(params.expirationTime).toNumber() * 1000,
                  )
                : undefined,
        receiverSignatureRequired: params.receiverSignatureRequired,
        memo: params.memo,
        maxAutomaticTokenAssociations: params.maxAutoTokenAssociations,
        stakedAccountId: params.stakedAccountId,
        stakedNodeId: optionalNumber(params.stakedNodeId),
        declineStakingReward: params.declineStakingReward,
    });

    return { status: result.status };
};

export const deleteAccount = async (params: AccountParams) => {
    // Core signs with `accountKey`; the TCK passes the account's key as the
    // first signer.
    const options = transactionOptions(params.commonTransactionParams);
    const [accountKey, ...others] = options.additionalSigners ?? [];
    const result = await service(params.sessionId).deleteAccount({
        ...options,
        additionalSigners: others,
        accountId: params.deleteAccountId!,
        accountKey: accountKey as PrivateKey,
        transferAccountId: params.transferAccountId,
    });

    return { status: result.status };
};

export const transferCrypto = async (
    params: BaseParams & { transfers?: Transfer[] },
) => {
    const transfers = params.transfers ?? [];
    const options = transactionOptions(params.commonTransactionParams);
    const accounts = service(params.sessionId);
    const unsupported = () =>
        notSupported(
            "transferCrypto beyond one two-leg HBAR or token transfer or one NFT transfer, without approval",
        );

    if (transfers.some((t) => t.approved)) unsupported();

    if (transfers.length === 2 && transfers.every((t) => t.hbar?.accountId)) {
        const [from, to] = [...transfers].sort(
            (a, b) => Number(a.hbar!.amount) - Number(b.hbar!.amount),
        );

        if (Number(from.hbar!.amount) + Number(to.hbar!.amount) !== 0) {
            unsupported();
        }
        const result = await accounts.transferHbar(
            to.hbar!.accountId!,
            Hbar.fromTinybars(to.hbar!.amount),
            from.hbar!.accountId!,
            options,
        );

        return { status: result.status };
    }

    if (
        transfers.length === 2 &&
        transfers.every((t) => t.token) &&
        transfers[0].token!.tokenId === transfers[1].token!.tokenId
    ) {
        const [from, to] = [...transfers].sort(
            (a, b) => Number(a.token!.amount) - Number(b.token!.amount),
        );

        if (Number(from.token!.amount) + Number(to.token!.amount) !== 0) {
            unsupported();
        }
        const result = await accounts.transferToken(
            to.token!.tokenId,
            to.token!.accountId,
            Number(to.token!.amount),
            from.token!.accountId,
            { ...options, expectedDecimals: to.token!.decimals },
        );

        return { status: result.status };
    }

    if (transfers.length === 1 && transfers[0].nft) {
        const nft = transfers[0].nft;
        const result = await accounts.transferNft(
            nft.tokenId,
            Number(nft.serialNumber),
            nft.receiverAccountId,
            nft.senderAccountId,
            options,
        );

        return { status: result.status };
    }

    return unsupported();
};

export const approveAllowance = async (
    params: BaseParams & { allowances?: Allowance[] },
) => {
    const allowances = params.allowances ?? [];
    const options = transactionOptions(params.commonTransactionParams);
    const accounts = service(params.sessionId);
    const base = (a: Allowance) => ({
        ownerAccountId: a.ownerAccountId,
        spenderAccountId: a.spenderAccountId,
    });

    // Core approves each kind in its own transaction.
    if (allowances.length > 0 && allowances.every((a) => a.hbar)) {
        const result = await accounts.approveHbarAllowance({
            ...options,
            hbarAllowances: allowances.map((a) => ({
                ...base(a),
                amount: Hbar.fromTinybars(a.hbar!.amount),
            })),
        });

        return { status: result.status };
    }

    if (allowances.length > 0 && allowances.every((a) => a.token)) {
        const result = await accounts.approveTokenAllowance({
            ...options,
            tokenAllowances: allowances.map((a) => ({
                ...base(a),
                tokenId: a.token!.tokenId,
                amount: BigInt(a.token!.amount),
            })),
        });

        return { status: result.status };
    }
    // `approvedForAll: false` without serials revokes an all-serials
    // approval, which core exposes as deleteAllNftAllowances.
    if (
        allowances.length > 0 &&
        allowances.every(
            (a) =>
                a.nft?.approvedForAll === false && !a.nft.serialNumbers?.length,
        )
    ) {
        const result = await accounts.deleteAllNftAllowances(
            allowances.map((a) => ({
                ...base(a),
                tokenId: a.nft!.tokenId,
            })),
            options,
        );

        return { status: result.status };
    }

    if (allowances.length > 0 && allowances.every((a) => a.nft)) {
        const result = await accounts.approveNftAllowance({
            ...options,
            nftAllowances: allowances.map((a) => ({
                ...base(a),
                tokenId: a.nft!.tokenId,
                serialNumbers: a.nft!.serialNumbers?.map(Number),
                allSerials: a.nft!.approvedForAll,
                delegatingSpender: a.nft!.delegateSpenderAccountId,
            })),
        });

        return { status: result.status };
    }

    return notSupported(
        "approveAllowance mixing HBAR, token and NFT allowances",
    );
};

export const deleteAllowance = async (
    params: BaseParams & {
        allowances?: {
            tokenId: string;
            ownerAccountId: string;
            serialNumbers?: string[];
        }[];
    },
) => {
    const result = await service(params.sessionId).deleteNftAllowance(
        (params.allowances ?? []).map((a) => ({
            tokenId: a.tokenId,
            ownerAccountId: a.ownerAccountId,
            serialNumbers: (a.serialNumbers ?? []).map(Number),
        })),
        transactionOptions(params.commonTransactionParams),
    );

    return { status: result.status };
};

export const getMirrorNodeAccountBalance = async (
    params: BaseParams & { accountId?: string },
) => {
    const balance = await service(params.sessionId).getAccountBalance(
        params.accountId!,
    );

    return { hbars: balance.tinybars };
};
