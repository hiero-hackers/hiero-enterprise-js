import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Long, TokenAirdropTransaction } from "@hiero-ledger/sdk";
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

describe("TokenAirdropNftOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenAirdropTransaction;

    /** NFT transfers of one collection as plain values. */
    const nftTransfers = (tokenId: string) =>
        sentTx()
            .nftTransfers.get(tokenId)
            ?.map((t) => [
                t.serial.toNumber(),
                t.sender.toString(),
                t.recipient.toString(),
            ]);

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("airdrops a single NFT serial from sender to receiver", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: 1,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                },
            ],
        });

        expect(sentTx()).toBeInstanceOf(TokenAirdropTransaction);
        expect(nftTransfers("0.0.500")).toEqual([[1, "0.0.700", "0.0.800"]]);
    });

    it("batches multiple NFT airdrops across collections, senders, and receivers", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: 1,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.801",
                },
                {
                    tokenId: "0.0.500",
                    serial: 2,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.802",
                },
                {
                    tokenId: "0.0.600",
                    serial: 5,
                    senderAccountId: "0.0.701",
                    receiverAccountId: "0.0.803",
                },
            ],
        });

        expect(run).toHaveBeenCalledTimes(1);
        expect(nftTransfers("0.0.500")).toEqual([
            [1, "0.0.700", "0.0.801"],
            [2, "0.0.700", "0.0.802"],
        ]);
        expect(nftTransfers("0.0.600")).toEqual([[5, "0.0.701", "0.0.803"]]);
    });

    it("accepts Long-valued serials", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: Long.fromNumber(7),
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                },
            ],
        });

        expect(nftTransfers("0.0.500")).toEqual([[7, "0.0.700", "0.0.800"]]);
    });

    it("sends the TokenAirdrop event", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: 1,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                },
            ],
            transactionMemo: "nft airdrop memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenAirdropTransaction),
            expect.objectContaining({ transactionMemo: "nft airdrop memo" }),
            expect.objectContaining({
                type: "TokenAirdrop",
                serviceName: "TokenService",
                methodName: "airdropNft",
            }),
        );
    });

    it("throws when airdrops is empty", async () => {
        await expect(service.airdropNft({ airdrops: [] })).rejects.toThrow(
            /airdrops must not be empty/,
        );
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when an airdrop's tokenId is empty", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "",
                        serial: 1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.800",
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[0\]\.tokenId cannot be empty/);
    });

    it("throws when an airdrop's serial is zero", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        serial: 0,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.800",
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[0\]\.serial must be a positive integer/);
    });

    it("throws when an airdrop's sender and receiver are the same account", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        serial: 1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.700",
                    },
                ],
            }),
        ).rejects.toThrow(
            /airdrops\[0\]: senderAccountId and receiverAccountId must be different/,
        );
    });

    it("includes the offending airdrop index in the error message", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        serial: 1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.801",
                    },
                    {
                        tokenId: "0.0.500",
                        serial: -1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.802",
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[1\]\.serial must be a positive integer/);
    });
});
