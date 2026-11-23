import { describe, it, expect } from "vitest";
import { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TransferNftValidator } from "../../../../../src/services/account/validation/index.js";

describe("TransferNftValidator", () => {
    const validator = new TransferNftValidator();

    it("passes with valid string IDs and serial", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: 1,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.200",
            }),
        ).not.toThrow();
    });

    it("passes with TokenId/AccountId instances", () => {
        expect(() =>
            validator.validate({
                tokenId: TokenId.fromString("0.0.789"),
                serial: 42,
                senderAccountId: AccountId.fromString("0.0.100"),
                receiverAccountId: AccountId.fromString("0.0.200"),
            }),
        ).not.toThrow();
    });

    it("throws when tokenId is empty", () => {
        expect(() =>
            validator.validate({
                tokenId: "",
                serial: 1,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.200",
            }),
        ).toThrow(/tokenId must not be empty/);
    });

    it("throws when serial is zero", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: 0,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.200",
            }),
        ).toThrow(/serial must be positive/);
    });

    it("throws when serial is negative", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: -1,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.200",
            }),
        ).toThrow(/serial must be positive/);
    });

    it("throws when serial is not an integer", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: 1.5,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.200",
            }),
        ).toThrow(/serial must be a safe integer/);
    });

    it("throws when serial is null", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: null as unknown as number,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.200",
            }),
        ).toThrow(/serial is required/);
    });

    it("throws when sender equals receiver", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: 1,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.100",
            }),
        ).toThrow(/must be different/);
    });

    it("reports ACCOUNT_REPEATED_IN_ACCOUNT_AMOUNTS when sender equals receiver", () => {
        expect(() =>
            validator.validate({
                tokenId: "0.0.789",
                serial: 1,
                senderAccountId: "0.0.100",
                receiverAccountId: "0.0.100",
            }),
        ).toThrow(
            expect.objectContaining({
                code: "INPUT_INVALID",
                sdkStatus: "ACCOUNT_REPEATED_IN_ACCOUNT_AMOUNTS",
            }),
        );
    });
});
