import { describe, it, expect, vi, beforeEach } from "vitest";
import { HieroContext } from "../src/context/hiero-context.js";
import { FungibleTokenClient } from "../src/services/fungible-token-client.js";
import {
    TokenCreateTransaction,
    TokenType,
    TokenAssociateTransaction,
    TokenDissociateTransaction,
    TokenMintTransaction,
    TokenBurnTransaction,
    TransferTransaction,
} from "@hashgraph/sdk";

vi.mock("@hashgraph/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hashgraph/sdk")>();

    const mockTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setMaxSupply: vi.fn().mockReturnThis(),
        setTokenMemo: vi.fn().mockReturnThis(),

        setAccountId: vi.fn().mockReturnThis(),
        setTokenIds: vi.fn().mockReturnThis(),

        setTokenId: vi.fn().mockReturnThis(),
        setAmount: vi.fn().mockReturnThis(),

        addTokenTransfer: vi.fn().mockReturnThis(),

        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: { toString: () => "0.0.123@1234567890" },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    tokenId: { toString: () => "0.0.999" },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                tokenId: { toString: () => "0.0.999" },
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

describe("FungibleTokenClient", () => {
    let context: HieroContext;
    let client: FungibleTokenClient;

    beforeEach(() => {
        vi.clearAllMocks();
        HieroContext.reset();
        context = HieroContext.initialize({
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208", // Dummy ED25519 DER
        });
        client = new FungibleTokenClient(context);
    });

    describe("createToken", () => {
        it("creates a token with default options", async () => {
            const tokenId = await client.createToken({
                name: "Test Token",
                symbol: "TST",
            });

            expect(tokenId).toBe("0.0.999");

            const txMock = vi.mocked(TokenCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setTokenName).toHaveBeenCalledWith("Test Token");
            expect(txMock.setTokenSymbol).toHaveBeenCalledWith("TST");
            expect(txMock.setTokenType).toHaveBeenCalledWith(
                TokenType.FungibleCommon,
            );
            expect(txMock.setDecimals).toHaveBeenCalledWith(0);
            expect(txMock.setInitialSupply).toHaveBeenCalledWith(0);
            expect(txMock.setTreasuryAccountId).toHaveBeenCalledWith("0.0.2"); // Defaults to operator
            expect(txMock.setSupplyKey).toHaveBeenCalled();
            expect(txMock.setAdminKey).toHaveBeenCalled();
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates a token with custom options", async () => {
            await client.createToken({
                name: "Custom",
                symbol: "CST",
                decimals: 2,
                initialSupply: 1000,
                maxSupply: 5000,
                memo: "the memo",
                treasuryAccountId: "0.0.555",
            });

            const txMock = vi.mocked(TokenCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setDecimals).toHaveBeenCalledWith(2);
            expect(txMock.setInitialSupply).toHaveBeenCalledWith(1000);
            expect(txMock.setMaxSupply).toHaveBeenCalledWith(5000);
            expect(txMock.setTokenMemo).toHaveBeenCalledWith("the memo");
            expect(txMock.setTreasuryAccountId).toHaveBeenCalledWith("0.0.555");
        });
    });

    describe("associateToken", () => {
        it("associates a token with an account", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
            await client.associateToken("0.0.999", "0.0.555", dummyKey);

            const txMock = vi.mocked(TokenAssociateTransaction).mock.results[0]
                .value;
            expect(txMock.setAccountId).toHaveBeenCalledWith("0.0.555");
            expect(txMock.setTokenIds).toHaveBeenCalledWith(["0.0.999"]);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("dissociateToken", () => {
        it("dissociates a token from an account", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";
            await client.dissociateToken("0.0.999", "0.0.555", dummyKey);

            const txMock = vi.mocked(TokenDissociateTransaction).mock.results[0]
                .value;
            expect(txMock.setAccountId).toHaveBeenCalledWith("0.0.555");
            expect(txMock.setTokenIds).toHaveBeenCalledWith(["0.0.999"]);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("mintToken", () => {
        it("mints additional token supply", async () => {
            await client.mintToken("0.0.999", 500);

            const txMock =
                vi.mocked(TokenMintTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setAmount).toHaveBeenCalledWith(500);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled(); // signed by default operator key
        });
    });

    describe("burnToken", () => {
        it("burns token supply", async () => {
            await client.burnToken("0.0.999", 100);

            const txMock =
                vi.mocked(TokenBurnTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setAmount).toHaveBeenCalledWith(100);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("transferToken", () => {
        it("transfers tokens between accounts", async () => {
            const dummyKey =
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208";

            await client.transferToken(
                "0.0.999",
                "0.0.555",
                dummyKey,
                "0.0.2",
                100,
            );

            const txMock = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(txMock.addTokenTransfer).toHaveBeenCalledWith(
                "0.0.999",
                "0.0.555",
                -100,
            );
            expect(txMock.addTokenTransfer).toHaveBeenCalledWith(
                "0.0.999",
                "0.0.2",
                100,
            );
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });
});
