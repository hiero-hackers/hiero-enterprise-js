import { describe, it, expect } from "vitest";
import { AccountId, Hbar, Status, TokenId } from "@hiero-ledger/sdk";
import { TransferValidator } from "../../../../../src/services/account/validation/index.js";
import type { TransferOptions } from "../../../../../src/services/account/operations/index.js";

describe("TransferValidator", () => {
    const validator = new TransferValidator();
    const validate = (options: TransferOptions) => () =>
        validator.validate(options);

    const hbar = (accountId: string, amount: number | Hbar) => ({
        accountId,
        amount,
    });
    const token = (tokenId: string, accountId: string, amount: number) => ({
        tokenId,
        accountId,
        amount,
    });
    const nft = {
        tokenId: "0.0.789",
        serial: 1,
        senderAccountId: "0.0.100",
        receiverAccountId: "0.0.200",
    };

    it("passes with HBAR legs that sum to zero", () => {
        expect(
            validate({
                hbarTransfers: [
                    hbar("0.0.100", -1.5),
                    hbar("0.0.101", Hbar.fromTinybars(-50_000_000)),
                    hbar("0.0.200", 2),
                ],
            }),
        ).not.toThrow();
    });

    it("passes with token legs of several tokens that each sum to zero", () => {
        expect(
            validate({
                tokenTransfers: [
                    token("0.0.456", "0.0.100", -10),
                    token("0.0.456", "0.0.200", 4),
                    token("0.0.456", "0.0.201", 6),
                    {
                        tokenId: TokenId.fromString("0.0.457"),
                        accountId: AccountId.fromString("0.0.200"),
                        amount: -1,
                        expectedDecimals: 0,
                    },
                    token("0.0.457", "0.0.100", 1),
                ],
            }),
        ).not.toThrow();
    });

    it("passes with only an NFT transfer", () => {
        expect(validate({ nftTransfers: [nft] })).not.toThrow();
    });

    it("passes with zero-amount legs, which the network accepts", () => {
        expect(
            validate({
                hbarTransfers: [hbar("0.0.100", 0), hbar("0.0.200", 0)],
            }),
        ).not.toThrow();
    });

    it("throws when no leg is given", () => {
        expect(validate({})).toThrow(/At least one transfer/);
        expect(
            validate({
                hbarTransfers: [],
                tokenTransfers: [],
                nftTransfers: [],
            }),
        ).toThrow(/At least one transfer/);
    });

    it("throws INVALID_ACCOUNT_AMOUNTS when HBAR legs don't sum to zero", () => {
        expect(validate({ hbarTransfers: [hbar("0.0.100", -1)] })).toThrow(
            expect.objectContaining({
                message: "hbarTransfers must sum to zero.",
                sdkStatus: Status.InvalidAccountAmounts.toString(),
            }),
        );
    });

    it("compares HBAR sums in tinybars", () => {
        expect(
            validate({
                hbarTransfers: [
                    hbar("0.0.100", -1),
                    hbar("0.0.200", Hbar.fromTinybars(99_999_999)),
                ],
            }),
        ).toThrow(/hbarTransfers must sum to zero/);
    });

    it("throws TRANSFERS_NOT_ZERO_SUM_FOR_TOKEN when a token's legs don't sum to zero", () => {
        expect(
            validate({
                tokenTransfers: [
                    token("0.0.456", "0.0.100", -10),
                    token("0.0.457", "0.0.200", 10),
                ],
            }),
        ).toThrow(
            expect.objectContaining({
                message: "tokenTransfers of token 0.0.456 must sum to zero.",
                sdkStatus: Status.TransfersNotZeroSumForToken.toString(),
            }),
        );
    });

    it("throws when an HBAR leg has no accountId", () => {
        expect(
            validate({
                hbarTransfers: [hbar("", -1), hbar("0.0.200", 1)],
            }),
        ).toThrow(/hbarTransfers\[\]\.accountId is required/);
    });

    it("throws when an HBAR amount is missing or not finite", () => {
        expect(
            validate({
                hbarTransfers: [
                    { accountId: "0.0.100", amount: null as unknown as number },
                ],
            }),
        ).toThrow(/hbarTransfers\[\]\.amount is required/);
        expect(
            validate({ hbarTransfers: [hbar("0.0.100", Number.NaN)] }),
        ).toThrow(/must be a finite number/);
    });

    it("throws when an HBAR amount is a fraction of a tinybar", () => {
        expect(
            validate({
                hbarTransfers: [
                    hbar("0.0.100", -0.000000001),
                    hbar("0.0.200", 0.000000001),
                ],
            }),
        ).toThrow(/must be a whole number of tinybars/);
    });

    it("throws when a token leg has no tokenId or accountId", () => {
        expect(validate({ tokenTransfers: [token("", "0.0.100", 0)] })).toThrow(
            /tokenTransfers\[\]\.tokenId is required/,
        );
        expect(
            validate({ tokenTransfers: [token("0.0.456", " ", 0)] }),
        ).toThrow(/tokenTransfers\[\]\.accountId is required/);
    });

    it("throws when a token amount is not a safe integer", () => {
        expect(
            validate({
                tokenTransfers: [
                    token("0.0.456", "0.0.100", -1.5),
                    token("0.0.456", "0.0.200", 1.5),
                ],
            }),
        ).toThrow(/tokenTransfers\[\]\.amount must be a safe integer/);
    });

    it("throws when expectedDecimals is negative or not an integer", () => {
        for (const expectedDecimals of [-1, 1.5]) {
            expect(
                validate({
                    tokenTransfers: [
                        {
                            ...token("0.0.456", "0.0.100", 0),
                            expectedDecimals,
                        },
                    ],
                }),
            ).toThrow(/expectedDecimals must be a non-negative integer/);
        }
    });

    it("throws when an NFT leg has no IDs", () => {
        expect(validate({ nftTransfers: [{ ...nft, tokenId: "" }] })).toThrow(
            /nftTransfers\[\]\.tokenId is required/,
        );
        expect(
            validate({ nftTransfers: [{ ...nft, senderAccountId: "" }] }),
        ).toThrow(/nftTransfers\[\]\.senderAccountId is required/);
        expect(
            validate({ nftTransfers: [{ ...nft, receiverAccountId: "" }] }),
        ).toThrow(/nftTransfers\[\]\.receiverAccountId is required/);
    });

    it("throws when an NFT serial is not a positive integer", () => {
        for (const serial of [0, -1, 1.5]) {
            expect(validate({ nftTransfers: [{ ...nft, serial }] })).toThrow(
                /serial must be a positive safe integer/,
            );
        }
    });

    it("throws ACCOUNT_REPEATED_IN_ACCOUNT_AMOUNTS when an NFT goes to its sender", () => {
        expect(
            validate({
                nftTransfers: [{ ...nft, receiverAccountId: "0.0.100" }],
            }),
        ).toThrow(
            expect.objectContaining({
                sdkStatus: Status.AccountRepeatedInAccountAmounts.toString(),
            }),
        );
    });
});
