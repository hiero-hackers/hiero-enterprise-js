import { describe, it, expect } from "vitest";
import { AccountId, Long } from "@hiero-ledger/sdk";
import { TokenAirdropNftValidator } from "../../../../../src/services/token/validation/index.js";
import type {
    NftAirdrop,
    TokenAirdropNftOperationOptions,
} from "../../../../../src/services/token/operations/index.js";

describe("TokenAirdropNftValidator", () => {
    const validator = new TokenAirdropNftValidator();

    const baseAirdrop: NftAirdrop = {
        tokenId: "0.0.500",
        serial: 1,
        senderAccountId: "0.0.700",
        receiverAccountId: "0.0.800",
    };

    const wrap = (airdrop: NftAirdrop): TokenAirdropNftOperationOptions => ({
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
                        { ...baseAirdrop, serial: 2 },
                        {
                            ...baseAirdrop,
                            tokenId: "0.0.600",
                            serial: 5,
                            receiverAccountId: "0.0.803",
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when airdrops is null", () => {
            expect(() =>
                validator.validate({
                    airdrops: null as unknown as NftAirdrop[],
                }),
            ).toThrow(/airdrops is required/);
            expect(() =>
                validator.validate({
                    airdrops: null as unknown as NftAirdrop[],
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when airdrops is not an array", () => {
            expect(() =>
                validator.validate({
                    airdrops: "nope" as unknown as NftAirdrop[],
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
                        { ...baseAirdrop, serial: 2 },
                        { ...baseAirdrop, serial: -1 },
                    ],
                }),
            ).toThrow(/airdrops\[2\]\.serial must be a positive integer/);
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

    describe("serial", () => {
        it("throws when serial is null", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        serial: null as unknown as number,
                    }),
                ),
            ).toThrow(/airdrops\[0\]\.serial is required/);
        });

        it("throws when serial is zero (number)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, serial: 0 })),
            ).toThrow(/airdrops\[0\]\.serial must be a positive integer/);
        });

        it("throws when serial is negative (number)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, serial: -1 })),
            ).toThrow(/airdrops\[0\]\.serial must be a positive integer/);
        });

        it("throws when serial is non-integer (number)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, serial: 1.5 })),
            ).toThrow(/airdrops\[0\]\.serial must be a positive integer/);
        });

        it("throws when serial is zero (Long)", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, serial: Long.ZERO })),
            ).toThrow(/airdrops\[0\]\.serial must be a positive integer/);
        });

        it("throws when serial is negative (Long)", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, serial: Long.fromNumber(-1) }),
                ),
            ).toThrow(/airdrops\[0\]\.serial must be a positive integer/);
        });

        it("throws when serial is neither number nor Long", () => {
            expect(() =>
                validator.validate(
                    wrap({
                        ...baseAirdrop,
                        serial: "1" as unknown as number,
                    }),
                ),
            ).toThrow(/airdrops\[0\]\.serial must be a positive integer/);
        });

        it("accepts positive number serials", () => {
            expect(() =>
                validator.validate(wrap({ ...baseAirdrop, serial: 42 })),
            ).not.toThrow();
        });

        it("accepts positive Long serials", () => {
            expect(() =>
                validator.validate(
                    wrap({ ...baseAirdrop, serial: Long.fromNumber(42) }),
                ),
            ).not.toThrow();
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
});
