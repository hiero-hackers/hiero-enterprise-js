import { describe, it, expect } from "vitest";
import { AccountId, Hbar, TokenId } from "@hiero-ledger/sdk";
import { TransferValidator } from "../../../../../src/services/account/validation/index.js";

describe("TransferValidator", () => {
    const validator = new TransferValidator();

    // HBAR transfers
    describe("validateHbarTransfer", () => {
        it("passes with valid string IDs and positive number amount", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 10,
                }),
            ).not.toThrow();
        });

        it("passes with AccountId instances and Hbar amount", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: AccountId.fromString("0.0.100"),
                    receiverAccountId: AccountId.fromString("0.0.200"),
                    amount: new Hbar(5),
                }),
            ).not.toThrow();
        });

        it("throws when senderAccountId is empty string", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "",
                    receiverAccountId: "0.0.200",
                    amount: 10,
                }),
            ).toThrow(/senderAccountId must not be empty/);
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "",
                    receiverAccountId: "0.0.200",
                    amount: 10,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when receiverAccountId is empty string", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "   ",
                    amount: 10,
                }),
            ).toThrow(/receiverAccountId must not be empty/);
        });

        it("throws when senderAccountId is null", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: null as unknown as string,
                    receiverAccountId: "0.0.200",
                    amount: 10,
                }),
            ).toThrow(/senderAccountId is required/);
        });

        it("throws when sender and receiver are the same string", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.100",
                    amount: 10,
                }),
            ).toThrow(/must be different/);
        });

        it("throws when sender and receiver are the same AccountId", () => {
            const account = AccountId.fromString("0.0.100");
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: account,
                    receiverAccountId: account,
                    amount: 10,
                }),
            ).toThrow(/must be different/);
        });

        it("throws when sender (string) matches receiver (AccountId)", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: AccountId.fromString("0.0.100"),
                    amount: 10,
                }),
            ).toThrow(/must be different/);
        });

        it("throws when amount is zero", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 0,
                }),
            ).toThrow(/amount must be positive/);
        });

        it("throws when amount is negative", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: -5,
                }),
            ).toThrow(/amount must be positive/);
        });

        it("throws when amount is NaN", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: Number.NaN,
                }),
            ).toThrow(/amount must be a finite number/);
        });

        it("throws when amount is Infinity", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: Number.POSITIVE_INFINITY,
                }),
            ).toThrow(/amount must be a finite number/);
        });

        it("throws when Hbar amount is zero", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: new Hbar(0),
                }),
            ).toThrow(/amount must be positive/);
        });

        it("throws when Hbar amount is negative", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: new Hbar(-1),
                }),
            ).toThrow(/amount must be positive/);
        });

        it("throws when amount is null", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: null as unknown as number,
                }),
            ).toThrow(/amount is required/);
        });

        it("throws when amount is undefined", () => {
            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: undefined as unknown as number,
                }),
            ).toThrow(/amount is required/);
        });

        it("throws when Hbar.toTinybars() yields a value BigInt cannot parse", () => {
            // Hbar-like object whose toTinybars().toString() returns a value
            // BigInt() rejects — exercises the catch arm in validateHbarAmount.
            const badHbar = {
                toTinybars: () => ({ toString: () => "not-a-number" }),
            } as unknown as Hbar;

            expect(() =>
                validator.validateHbarTransfer({
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: badHbar,
                }),
            ).toThrow(/amount is not a valid Hbar value/);
        });
    });

    // Fungible token transfers
    describe("validateTokenTransfer", () => {
        it("passes with valid string IDs and integer amount", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                }),
            ).not.toThrow();
        });

        it("passes with TokenId/AccountId instances", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: TokenId.fromString("0.0.456"),
                    senderAccountId: AccountId.fromString("0.0.100"),
                    receiverAccountId: AccountId.fromString("0.0.200"),
                    amount: 100,
                }),
            ).not.toThrow();
        });

        it("passes with valid expectedDecimals", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                    expectedDecimals: 6,
                }),
            ).not.toThrow();
        });

        it("passes with expectedDecimals zero", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                    expectedDecimals: 0,
                }),
            ).not.toThrow();
        });

        it("throws when tokenId is empty string", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                }),
            ).toThrow(/tokenId must not be empty/);
        });

        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: null as unknown as string,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when sender equals receiver", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.100",
                    amount: 100,
                }),
            ).toThrow(/must be different/);
        });

        it("throws when amount is zero", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 0,
                }),
            ).toThrow(/amount must be positive/);
        });

        it("throws when amount is negative", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: -1,
                }),
            ).toThrow(/amount must be positive/);
        });

        it("throws when amount is not an integer", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 1.5,
                }),
            ).toThrow(/amount must be a safe integer/);
        });

        it("throws when amount is null", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: null as unknown as number,
                }),
            ).toThrow(/amount is required/);
        });

        it("throws when expectedDecimals is negative", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                    expectedDecimals: -1,
                }),
            ).toThrow(/expectedDecimals cannot be negative/);
        });

        it("throws when expectedDecimals is not an integer", () => {
            expect(() =>
                validator.validateTokenTransfer({
                    tokenId: "0.0.456",
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                    amount: 100,
                    expectedDecimals: 2.5,
                }),
            ).toThrow(/expectedDecimals must be a finite integer/);
        });
    });

    // NFT transfers
    describe("validateNftTransfer", () => {
        it("passes with valid string IDs and serial", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "0.0.789",
                    serial: 1,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                }),
            ).not.toThrow();
        });

        it("passes with TokenId/AccountId instances", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: TokenId.fromString("0.0.789"),
                    serial: 42,
                    senderAccountId: AccountId.fromString("0.0.100"),
                    receiverAccountId: AccountId.fromString("0.0.200"),
                }),
            ).not.toThrow();
        });

        it("throws when tokenId is empty", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "",
                    serial: 1,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                }),
            ).toThrow(/tokenId must not be empty/);
        });

        it("throws when serial is zero", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "0.0.789",
                    serial: 0,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                }),
            ).toThrow(/serial must be positive/);
        });

        it("throws when serial is negative", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "0.0.789",
                    serial: -1,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                }),
            ).toThrow(/serial must be positive/);
        });

        it("throws when serial is not an integer", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "0.0.789",
                    serial: 1.5,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                }),
            ).toThrow(/serial must be a safe integer/);
        });

        it("throws when serial is null", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "0.0.789",
                    serial: null as unknown as number,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.200",
                }),
            ).toThrow(/serial is required/);
        });

        it("throws when sender equals receiver", () => {
            expect(() =>
                validator.validateNftTransfer({
                    tokenId: "0.0.789",
                    serial: 1,
                    senderAccountId: "0.0.100",
                    receiverAccountId: "0.0.100",
                }),
            ).toThrow(/must be different/);
        });
    });
});
