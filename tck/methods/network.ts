import type { TransactionReceipt } from "@hiero-ledger/sdk";
import { NetworkService } from "@hiero-hackers/enterprise-core";
import { contextFor } from "../session.js";

interface NetworkParams {
    readonly sessionId?: string;
    readonly transactionId?: string;
    readonly includeChildren?: boolean;
    readonly includeDuplicates?: boolean;
    readonly fileId?: string;
    readonly limit?: number;
}

const service = (sessionId?: string) =>
    new NetworkService(contextFor(sessionId));

const receiptResponse = (receipt: TransactionReceipt): object => ({
    status: receipt.status.toString(),
    accountId: receipt.accountId?.toString(),
    fileId: receipt.fileId?.toString(),
    contractId: receipt.contractId?.toString(),
    topicId: receipt.topicId?.toString(),
    tokenId: receipt.tokenId?.toString(),
    scheduleId: receipt.scheduleId?.toString(),
    exchangeRate: receipt.exchangeRate
        ? {
              hbars: receipt.exchangeRate.hbars,
              cents: receipt.exchangeRate.cents,
          }
        : undefined,
    topicSequenceNumber: receipt.topicSequenceNumber?.toString(),
    totalSupply: receipt.totalSupply?.toString(),
    serials: receipt.serials.map((serial) => serial.toString()),
    duplicates: receipt.duplicates.map(receiptResponse),
    children: receipt.children.map(receiptResponse),
});

export const getTransactionReceipt = async (params: NetworkParams) => {
    const receipt = await service(params.sessionId).getTransactionReceipt({
        transactionId: params.transactionId!,
        includeChildren: params.includeChildren,
        includeDuplicates: params.includeDuplicates,
    });

    return receiptResponse(receipt);
};

// The TCK reads an IPv4 address as 8 hex characters.
const ipv4Hex = (address: string): string | undefined => {
    const parts = address.split(".").map(Number);

    if (
        parts.length !== 4 ||
        parts.some((part) => !(part >= 0 && part <= 255))
    ) {
        return undefined;
    }

    return parts.map((part) => part.toString(16).padStart(2, "0")).join("");
};

export const getAddressBook = async (params: NetworkParams) => {
    const book = await service(params.sessionId).getAddressBook({
        fileId: params.fileId,
        limit: params.limit,
    });

    return {
        nodeAddresses: book.nodeAddresses.map((node) => ({
            nodeId: node.nodeId?.toNumber() ?? 0,
            accountId: node.accountId?.toString() ?? "",
            serviceEndpoints: node.addresses.flatMap((endpoint): object[] => {
                const address = endpoint.address;

                if (endpoint.port == null || address == null) return [];
                if (typeof address === "string") {
                    return [{ port: endpoint.port, domainName: address }];
                }
                const ip = ipv4Hex(address.toString());

                return ip ? [{ port: endpoint.port, ipAddressV4: ip }] : [];
            }),
            rsaPublicKey: node.publicKey || null,
            // The address book holds the hash as hex text.
            nodeCertHash: node.certHash
                ? Buffer.from(node.certHash).toString("utf8")
                : null,
            description: node.description || null,
        })),
    };
};
