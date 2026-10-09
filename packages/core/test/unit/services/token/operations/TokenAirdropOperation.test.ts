import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenAirdropTransaction } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenAirdropOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenAirdropTransaction;

    /** Net transfer of one token for one account, as a string. */
    const transfer = (tokenId: string, accountId: string) =>
        sentTx().tokenTransfers.get(tokenId)?.get(accountId)?.toString();

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("airdrops a single entry with a negated sender entry and positive receiver entry", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                    amount: 100,
                },
            ],
        });

        expect(sentTx()).toBeInstanceOf(TokenAirdropTransaction);
        expect(sentTx().tokenTransfers.get("0.0.500")?.size).toBe(2);
        expect(transfer("0.0.500", "0.0.700")).toBe("-100");
        expect(transfer("0.0.500", "0.0.800")).toBe("100");
    });

    it("batches multiple airdrops across tokens, senders, and receivers in one transaction", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.801",
                    amount: 10,
                },
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.802",
                    amount: 20,
                },
                {
                    tokenId: "0.0.600",
                    senderAccountId: "0.0.701",
                    receiverAccountId: "0.0.803",
                    amount: 30,
                },
            ],
        });

        expect(run).toHaveBeenCalledTimes(1);
        // The SDK nets transfers per token and account.
        expect(transfer("0.0.500", "0.0.700")).toBe("-30");
        expect(transfer("0.0.500", "0.0.801")).toBe("10");
        expect(transfer("0.0.500", "0.0.802")).toBe("20");
        expect(transfer("0.0.600", "0.0.701")).toBe("-30");
        expect(transfer("0.0.600", "0.0.803")).toBe("30");
    });

    it("sets the expected decimals when expectedDecimals is provided", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                    amount: 250,
                    expectedDecimals: 2,
                },
            ],
        });

        expect(transfer("0.0.500", "0.0.700")).toBe("-250");
        expect(transfer("0.0.500", "0.0.800")).toBe("250");
        expect(sentTx().tokenIdDecimals.get("0.0.500")).toBe(2);
    });

    it("mixes plain and decimals-checked airdrops in a single batch", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.801",
                    amount: 5,
                },
                {
                    tokenId: "0.0.600",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.802",
                    amount: 6,
                    expectedDecimals: 3,
                },
            ],
        });

        const tx = sentTx();
        expect(transfer("0.0.500", "0.0.801")).toBe("5");
        expect(transfer("0.0.600", "0.0.802")).toBe("6");
        expect(tx.tokenIdDecimals.get("0.0.500")).toBeNull();
        expect(tx.tokenIdDecimals.get("0.0.600")).toBe(3);
    });

    it("sends the TokenAirdrop event", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                    amount: 5,
                },
            ],
            transactionMemo: "airdrop memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenAirdropTransaction),
            expect.objectContaining({ transactionMemo: "airdrop memo" }),
            expect.objectContaining({
                type: "TokenAirdrop",
                serviceName: "TokenService",
                methodName: "airdropFungibleToken",
            }),
        );
    });

    it("throws when airdrops is empty", async () => {
        await expect(
            service.airdropFungibleToken({ airdrops: [] }),
        ).rejects.toThrow(/airdrops must not be empty/);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when an airdrop's tokenId is empty", async () => {
        await expect(
            service.airdropFungibleToken({
                airdrops: [
                    {
                        tokenId: "",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.800",
                        amount: 1,
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[0\]\.tokenId cannot be empty/);
    });

    it("throws when an airdrop's sender and receiver are the same account", async () => {
        await expect(
            service.airdropFungibleToken({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.700",
                        amount: 1,
                    },
                ],
            }),
        ).rejects.toThrow(
            /airdrops\[0\]: senderAccountId and receiverAccountId must be different/,
        );
    });

    it("includes the offending airdrop index in the error message", async () => {
        await expect(
            service.airdropFungibleToken({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.801",
                        amount: 5,
                    },
                    {
                        tokenId: "0.0.500",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.802",
                        amount: 0,
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[1\]\.amount must be a positive value/);
    });
});
