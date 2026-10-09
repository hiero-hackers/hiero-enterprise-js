import { describe, it, expect } from "vitest";
import { AccountId, Long } from "@hiero-ledger/sdk";
import BigNumber from "bignumber.js";
import { TokenAirdropValidator } from "../../../../../src/services/token/validation/index.js";
import type {
    TokenAirdrop,
    TokenAirdropOperationOptions,
} from "../../../../../src/services/token/operations/index.js";

describe("TokenAirdropValidator", () => {
    const validator = new TokenAirdropValidator();

    const baseAirdrop: TokenAirdrop = {
        tokenId: "0.0.500",
        senderAccountId: "0.0.700",
        receiverAccountId: "0.0.800",
        amount: 10,
    };

    const wrap = (airdrop: TokenAirdrop): TokenAirdropOperationOptions => ({
        airdrops: [airdrop],
    });

    describe("airdrops list", () => {
        it("passes with a single valid airdrop", () => {
            expect(() => validator.validate(wrap(baseAirdrop))).not.toThrow();
        });

        it("passes with multiple valid airdrops", () => {
            expect(() =>
                validator.validate({
                    airdrops: [
                        baseAirdrop,
                        {
                            ...baseAirdrop,
                            receiverAccountId: "0.0.802",
                        },
                        {
                            ...baseAirdrop,
                            tokenId: "0.0.600",
                            receiverAccountId: "0.0.803",
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when airdrops is null", () => {
            expect(() =>
                validator.validate({
                    airdrops: null as unknown as TokenAirdrop[],
                }),
            ).toThrow(/airdrops is required/);
            expect(() =>
                validator.validate({
                    airdrops: null as unknown as TokenAirdrop[],
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when airdrops is not an array", () => {
            expect(() =>
                validator.validate({
                    airdrops: "nope" as unknown as TokenAirdrop[],
                }),
            ).toThrow(/airdrops must be an array/);
        });

        it("throws when airdrops is empty", () => {
            expect(() => validator.validate({ airdrops: [] })).toThrow(
                /airdrops must not be empty/,
            );
        });

        it("includes the offending airdrop index in field-level errors", () => {
            expect(() =>
                validator.validate({
                    airdrops: [
                        baseAirdrop,
                        { ...baseAirdrop, receiverAccountId: "0.0.802" },
                        {
                            ...baseAirdrop,
                            receiverAccountId: "0.0.803",
                            amount: -1,
                        },
                    ],
                }),
            ).toThrow(/airdrops\[2\]\.amount must be a positive value/);
        });
    });

    describe("tokenId", () => {
        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        tokenId: null as unknown as string,
                    }),
                ),
            ).toThrow(/airdrops\[0\]\.tokenId is required/);
        });

        it("throws when tokenId is whitespace only", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, tokenId: "   " })),
            ).toThrow(/airdrops\[0\]\.tokenId cannot be empty/);
        });
    });

    describe("senderAccountId / receiverAccountId", () => {
        it("throws when senderAccountId is undefined", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        senderAccountId: undefined as unknown as string,
                    }),
                ),
            ).toThrow(/airdrops\[0\]\.senderAccountId is required/);
        });

        it("throws when senderAccountId is empty", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, senderAccountId: "   " }),
                ),
            ).toThrow(/airdrops\[0\]\.senderAccountId cannot be empty/);
        });

        it("throws when receiverAccountId is null", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        receiverAccountId: null as unknown as string,
                    }),
                ),
            ).toThrow(/airdrops\[0\]\.receiverAccountId is required/);
        });

        it("throws when receiverAccountId is empty", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, receiverAccountId: "" }),
                ),
            ).toThrow(/airdrops\[0\]\.receiverAccountId cannot be empty/);
        });

        it("throws when sender and receiver are the same account string", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.700",
                    }),
                ),
            ).toThrow(
                /airdrops\[0\]: senderAccountId and receiverAccountId must be different/,
            );
        });

        it("throws when sender and receiver are the same AccountId object", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        senderAccountId: AccountId.fromString("0.0.700"),
                        receiverAccountId: AccountId.fromString("0.0.700"),
                    }),
                ),
            ).toThrow(
                /airdrops\[0\]: senderAccountId and receiverAccountId must be different/,
            );
        });

        it("accepts distinct AccountId objects for sender and receiver", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        senderAccountId: AccountId.fromString("0.0.700"),
                        receiverAccountId: AccountId.fromString("0.0.800"),
                    }),
                ),
            ).not.toThrow();
        });
    });

    describe("amount", () => {
        it("throws when amount is null", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        amount: null as unknown as number,
                    }),
                ),
            ).toThrow(/airdrops\[0\]\.amount is required/);
        });

        it("throws when amount is zero (number)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, amount: 0 })),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("throws when amount is negative (number)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, amount: -5 })),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("throws when amount is zero (bigint)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, amount: 0n })),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("throws when amount is negative (bigint)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, amount: -1n })),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("throws when amount is negative (Long)", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, amount: Long.fromNumber(-1) }),
                ),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("throws when amount is zero (Long)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, amount: Long.ZERO })),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("throws when amount is zero (BigNumber)", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, amount: new BigNumber(0) }),
                ),
            ).toThrow(/airdrops\[0\]\.amount must be a positive value/);
        });

        it("accepts positive bigint amounts", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, amount: 5n })),
            ).not.toThrow();
        });

        it("accepts positive Long amounts", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, amount: Long.fromNumber(5) }),
                ),
            ).not.toThrow();
        });

        it("accepts positive BigNumber amounts", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, amount: new BigNumber(5) }),
                ),
            ).not.toThrow();
        });
    });

    describe("expectedDecimals", () => {
        it("accepts an undefined expectedDecimals", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, expectedDecimals: undefined }),
                ),
            ).not.toThrow();
        });

        it("accepts zero expectedDecimals", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, expectedDecimals: 0 }),
                ),
            ).not.toThrow();
        });

        it("throws when expectedDecimals is negative", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, expectedDecimals: -1 }),
                ),
            ).toThrow(
                /airdrops\[0\]\.expectedDecimals must be a non-negative integer/,
            );
        });

        it("throws when expectedDecimals is non-integer", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, expectedDecimals: 1.5 }),
                ),
            ).toThrow(
                /airdrops\[0\]\.expectedDecimals must be a non-negative integer/,
            );
        });
    });
});
