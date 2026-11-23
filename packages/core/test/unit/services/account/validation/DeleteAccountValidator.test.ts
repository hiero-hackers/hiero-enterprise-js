import { describe, it, expect } from "vitest";
import { AccountId, PrivateKey } from "@hiero-ledger/sdk";
import { DeleteAccountValidator } from "../../../../../src/services/account/validation/index.js";

describe("DeleteAccountValidator", () => {
    const validator = new DeleteAccountValidator();

    describe("accountId", () => {
        it("passes with a valid accountId string", () => {
            expect(() =>
                validator.validate({ accountId: "0.0.999" }),
            ).not.toThrow();
        });

        it("passes with an AccountId instance", () => {
            expect(() =>
                validator.validate({
                    accountId: AccountId.fromString("0.0.999"),
                }),
            ).not.toThrow();
        });

        it("throws when accountId is null", () => {
            expect(() =>
                validator.validate({
                    accountId: null as unknown as string,
                }),
            ).toThrow(/accountId is required/);
            expect(() =>
                validator.validate({
                    accountId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when accountId is undefined", () => {
            expect(() =>
                validator.validate({
                    accountId: undefined as unknown as string,
                }),
            ).toThrow(/accountId is required/);
        });

        it("throws when accountId is an empty string", () => {
            expect(() => validator.validate({ accountId: "" })).toThrow(
                /accountId cannot be an empty string/,
            );
        });

        it("throws when accountId is whitespace only", () => {
            expect(() => validator.validate({ accountId: "   " })).toThrow(
                /accountId cannot be an empty string/,
            );
        });
    });

    describe("transferAccountId", () => {
        it("passes when transferAccountId is omitted", () => {
            expect(() =>
                validator.validate({ accountId: "0.0.999" }),
            ).not.toThrow();
        });

        it("passes with a valid transferAccountId", () => {
            expect(() =>
                validator.validate({
                    accountId: "0.0.999",
                    transferAccountId: "0.0.555",
                }),
            ).not.toThrow();
        });

        it("throws when transferAccountId is an empty string", () => {
            expect(() =>
                validator.validate({
                    accountId: "0.0.999",
                    transferAccountId: " ",
                }),
            ).toThrow(/transferAccountId cannot be an empty string/);
        });
    });

    describe("accountKey", () => {
        it("passes with an accountKey", () => {
            expect(() =>
                validator.validateAccountKey({
                    accountId: "0.0.999",
                    accountKey: PrivateKey.generateED25519(),
                }),
            ).not.toThrow();
        });

        it("throws when accountKey is missing", () => {
            expect(() =>
                validator.validateAccountKey({
                    accountId: "0.0.999",
                    accountKey: undefined as unknown as PrivateKey,
                }),
            ).toThrow(/accountKey is required/);
        });
    });

    describe("network status", () => {
        it("reports ACCOUNT_ID_DOES_NOT_EXIST for a missing accountId", () => {
            expect(() =>
                validator.validate({
                    accountId: undefined as unknown as string,
                }),
            ).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    sdkStatus: "ACCOUNT_ID_DOES_NOT_EXIST",
                }),
            );
        });
    });
});
