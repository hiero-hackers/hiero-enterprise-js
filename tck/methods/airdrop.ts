import { Long, NftId, PendingAirdropId, TokenId } from "@hiero-ledger/sdk";
import type { PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";
import { transactionOptions } from "../common.js";
import type { CommonTransactionParams } from "../common.js";
import { getKeyFromString } from "../utils/key.js";
import { notSupported } from "../errors.js";

interface Transfer {
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

interface PendingAirdrop {
    readonly senderAccountId: string;
    readonly receiverAccountId: string;
    readonly tokenId: string;
    readonly serialNumbers?: string[];
}

interface AirdropParams {
    readonly sessionId?: string;
    readonly commonTransactionParams?: CommonTransactionParams;
    readonly tokenTransfers?: Transfer[];
    readonly pendingAirdrops?: PendingAirdrop[];
    readonly senderAccountId?: string;
    readonly receiverAccountId?: string;
    readonly tokenId?: string;
    readonly tokenIds?: string[];
    readonly serialNumbers?: string[];
    readonly ownerId?: string;
}

const service = (sessionId?: string) => new TokenService(contextFor(sessionId));

const pending = (airdrop: PendingAirdrop): PendingAirdropId[] => {
    if (airdrop.serialNumbers?.length) {
        return airdrop.serialNumbers.map(
            (serial) =>
                new PendingAirdropId({
                    senderId: airdrop.senderAccountId,
                    receiverId: airdrop.receiverAccountId,
                    nftId: new NftId(
                        TokenId.fromString(airdrop.tokenId),
                        Long.fromString(serial),
                    ),
                }),
        );
    }

    return [
        new PendingAirdropId({
            senderId: airdrop.senderAccountId,
            receiverId: airdrop.receiverAccountId,
            tokenId: airdrop.tokenId,
        }),
    ];
};

export const airdropToken = async (params: AirdropParams) => {
    const transfers = params.tokenTransfers ?? [];
    const options = transactionOptions(params.commonTransactionParams);
    const tokens = service(params.sessionId);
    const unsupported = () =>
        notSupported(
            "airdropToken beyond one sender and one receiver, without approval",
        );

    if (transfers.some((transfer) => transfer.approved)) unsupported();

    if (transfers.length === 1 && transfers[0].nft) {
        const nft = transfers[0].nft;
        const result = await tokens.airdropNft({
            ...options,
            airdrops: [
                {
                    tokenId: nft.tokenId,
                    serial: Long.fromString(nft.serialNumber),
                    senderAccountId: nft.senderAccountId,
                    receiverAccountId: nft.receiverAccountId,
                },
            ],
        });

        return { status: result.status };
    }

    if (
        transfers.length === 2 &&
        transfers.every((transfer) => transfer.token) &&
        transfers[0].token!.tokenId === transfers[1].token!.tokenId
    ) {
        const [from, to] = [...transfers].sort(
            (a, b) => Number(a.token!.amount) - Number(b.token!.amount),
        );

        if (Number(from.token!.amount) + Number(to.token!.amount) !== 0) {
            unsupported();
        }
        const result = await tokens.airdropFungibleToken({
            ...options,
            airdrops: [
                {
                    tokenId: to.token!.tokenId,
                    senderAccountId: from.token!.accountId,
                    receiverAccountId: to.token!.accountId,
                    amount: Long.fromString(to.token!.amount),
                    expectedDecimals: to.token!.decimals,
                },
            ],
        });

        return { status: result.status };
    }

    return unsupported();
};

export const claimToken = async (params: AirdropParams) => {
    const result = await service(params.sessionId).claimAirdrop({
        ...transactionOptions(params.commonTransactionParams),
        pendingAirdropIds: pending({
            senderAccountId: params.senderAccountId!,
            receiverAccountId: params.receiverAccountId!,
            tokenId: params.tokenId!,
            serialNumbers: params.serialNumbers,
        }),
    });

    return { status: result.status };
};

export const cancelAirdrop = async (params: AirdropParams) => {
    const result = await service(params.sessionId).cancelAirdrop({
        ...transactionOptions(params.commonTransactionParams),
        pendingAirdropIds: (params.pendingAirdrops ?? []).flatMap(pending),
    });

    return { status: result.status };
};

export const rejectToken = async (params: AirdropParams) => {
    const signers = params.commonTransactionParams?.signers ?? [];

    // The reject flow takes a single owner key.
    if (signers.length > 1) notSupported("rejectToken with several signers");
    const tokenIds = params.tokenIds ?? [];
    const result = await service(params.sessionId).rejectTokensFlow({
        ownerId: params.ownerId!,
        fungibleTokenIds: params.serialNumbers ? undefined : tokenIds,
        // One TokenId object per token: TokenRejectFlow dedupes the tokens
        // it dissociates by reference.
        nftIds: params.serialNumbers
            ? tokenIds.flatMap((tokenId) => {
                  const id = TokenId.fromString(tokenId);

                  return params.serialNumbers!.map(
                      (serial) => new NftId(id, Long.fromString(serial)),
                  );
              })
            : undefined,
        ownerKey: signers.length
            ? (getKeyFromString(signers[0]) as PrivateKey)
            : undefined,
    });

    return { status: result.status };
};
