import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { NftClient } from "../src/services/nft-client.js";
import {
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TokenAssociateTransaction,
    TokenDissociateTransaction,
    TokenMintTransaction,
    TokenBurnTransaction,
    TransferTransaction,
    NftId,
    TokenId,
} from "@hashgraph/sdk";

vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    const mockTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setMaxSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setTokenMemo: vi.fn().mockReturnThis(),

        setAccountId: vi.fn().mockReturnThis(),
        setTokenIds: vi.fn().mockReturnThis(),

        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        addMetadata: vi.fn().mockReturnThis(),
        setSerials: vi.fn().mockReturnThis(),

        addNftTransfer: vi.fn().mockReturnThis(),

        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: { toString: () => "0.0.123@1234567890" },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    tokenId: { toString: () => "0.0.999" },
                    serials: [{ toNumber: () => 1 }, { toNumber: () => 2 }],
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                tokenId: { toString: () => "0.0.999" },
                serials: [{ toNumber: () => 1 }, { toNumber: () => 2 }],
            }),
        }),
    };

    return {
        ...actual,
        TokenCreateTransaction: vi.fn(() => ({ ...mockTx })),
        TokenAssociateTransaction: vi.fn(() => ({ ...mockTx })),
        TokenDissociateTransaction: vi.fn(() => ({ ...mockTx })),
        TokenMintTransaction: vi.fn(() => ({ ...mockTx })),
        TokenBurnTransaction: vi.fn(() => ({ ...mockTx })),
        TransferTransaction: vi.fn(() => ({ ...mockTx })),
    };
});

describe("NftClient", () => {
    let context: HieroContext;
    let client: NftClient;

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
        });
        client = new NftClient(context);
    });

    describe("createNftType", () => {
        it("creates an NFT type with default options", async () => {
            const tokenId = await client.createNftType({
                name: "Test NFT",
                symbol: "TNFT",
            });

            expect(tokenId).toBe("0.0.999");

            const txMock = vi.mocked(TokenCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setTokenName).toHaveBeenCalledWith("Test NFT");
            expect(txMock.setTokenSymbol).toHaveBeenCalledWith("TNFT");
            expect(txMock.setTokenType).toHaveBeenCalledWith(
                TokenType.NonFungibleUnique,
            );
            expect(txMock.setTreasuryAccountId).toHaveBeenCalledWith("0.0.2");
            expect(txMock.setSupplyKey).toHaveBeenCalled();
            expect(txMock.setAdminKey).toHaveBeenCalled();
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
        });

        it("creates an NFT type with finite supply", async () => {
            await client.createNftType({
                name: "Finite NFT",
                symbol: "FNFT",
                maxSupply: 100,
            });

            const txMock = vi.mocked(TokenCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setSupplyType).toHaveBeenCalledWith(
                TokenSupplyType.Finite,
            );
            expect(txMock.setMaxSupply).toHaveBeenCalledWith(100);
        });
    });

    describe("associateNft", () => {
        it("associates an NFT with an account", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
            await client.associateNft("0.0.999", "0.0.555", dummyKey);

            const txMock = vi.mocked(TokenAssociateTransaction).mock.results[0]
                .value;
            expect(txMock.setAccountId).toHaveBeenCalledWith("0.0.555");
            expect(txMock.setTokenIds).toHaveBeenCalledWith(["0.0.999"]);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("dissociateNft", () => {
        it("dissociates an NFT from an account", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
            await client.dissociateNft("0.0.999", "0.0.555", dummyKey);

            const txMock = vi.mocked(TokenDissociateTransaction).mock.results[0]
                .value;
            expect(txMock.setAccountId).toHaveBeenCalledWith("0.0.555");
            expect(txMock.setTokenIds).toHaveBeenCalledWith(["0.0.999"]);
        });
    });

    describe("mintNft", () => {
        it("mints a single NFT", async () => {
            const metadata = new Uint8Array([1, 2, 3]);
            const serial = await client.mintNft("0.0.999", metadata);

            expect(serial).toBe(1);

            const txMock =
                vi.mocked(TokenMintTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.addMetadata).toHaveBeenCalledWith(metadata);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
        });
    });

    describe("mintNfts", () => {
        it("mints multiple NFTs", async () => {
            const metadataArray = [new Uint8Array([1]), new Uint8Array([2])];
            const serials = await client.mintNfts("0.0.999", metadataArray);

            expect(serials).toEqual([1, 2]);

            const txMock =
                vi.mocked(TokenMintTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.addMetadata).toHaveBeenCalledTimes(2);
        });
    });

    describe("burnNfts", () => {
        it("burns NFTs", async () => {
            await client.burnNfts("0.0.999", [1, 2]);

            const txMock =
                vi.mocked(TokenBurnTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setSerials).toHaveBeenCalledWith([1, 2]);
        });
    });

    describe("transferNfts", () => {
        it("transfers NFTs", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";

            // Need to clear the spy instance because TransferTransaction shares it across tests
            vi.mocked(TransferTransaction).mockClear();
            const txMockSpy = new TransferTransaction() as any;
            txMockSpy.addNftTransfer.mockClear();

            await client.transferNfts(
                "0.0.999",
                [1, 2],
                "0.0.555",
                dummyKey,
                "0.0.2",
            );

            const executedTxMock =
                vi.mocked(TransferTransaction).mock.results[0].value;
            expect(executedTxMock.addNftTransfer).toHaveBeenCalledTimes(2);
        });
    });
});
