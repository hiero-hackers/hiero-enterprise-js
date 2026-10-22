import { describe, it, expect } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { CreateAccountValidator } from "../../../../../src/services/account/validation/index.js";
import type { CreateAccountOptions } from "../../../../../src/services/account/operations/index.js";
import { AccountType } from "../../../../../src/types/index.js";

describe("CreateAccountValidator", () => {
    const validator = new CreateAccountValidator();
    const publicKey = PrivateKey.generateED25519().publicKey.toStringRaw();
    const validate = (options: Partial<CreateAccountOptions>) => () =>
        validator.validate({ publicKey, ...options });

    describe("keyType", () => {
        it("passes with ED25519 or ECDSA", () => {
            expect(validate({ keyType: AccountType.ED25519 })).not.toThrow();
            expect(validate({ keyType: AccountType.ECDSA })).not.toThrow();
        });

        it("throws on an unknown keyType", () => {
            expect(
                validate({ keyType: "rsa" as unknown as AccountType }),
            ).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    message: expect.stringContaining('Invalid keyType "rsa"'),
                }),
            );
        });
    });

    describe("key / publicKey", () => {
        it("passes with only key", () => {
            expect(() =>
                validator.validate({
                    key: PrivateKey.generateED25519().publicKey,
                }),
            ).not.toThrow();
        });

        it("throws when both key and publicKey are given", () => {
            expect(
                validate({ key: PrivateKey.generateED25519().publicKey }),
            ).toThrow(
                /either 'key' \(Key\) or 'publicKey' \(string\) — not both/,
            );
        });

        it("throws when neither key nor publicKey is given", () => {
            expect(() => validator.validate({})).toThrow(
                /Either 'key' \(SDK Key\) or 'publicKey' \(string\) must be provided/,
            );
        });

        it("throws when alias is combined with key", () => {
            expect(() =>
                validator.validate({
                    key: PrivateKey.generateECDSA().publicKey,
                    alias: true,
                }),
            ).toThrow(/alias is not supported when using 'key' directly/);
        });
    });

    describe("alias", () => {
        it("passes with alias: true and keyType ECDSA", () => {
            expect(
                validate({ alias: true, keyType: AccountType.ECDSA }),
            ).not.toThrow();
        });

        it("throws with alias: true and the default ED25519 keyType", () => {
            expect(validate({ alias: true })).toThrow(
                /alias: true requires keyType AccountType.ECDSA/,
            );
        });
    });

    describe("initialBalance", () => {
        it("passes with zero", () => {
            expect(validate({ initialBalance: 0 })).not.toThrow();
        });

        it("throws when negative", () => {
            expect(validate({ initialBalance: -1 })).toThrow(
                /Initial balance cannot be negative/,
            );
        });
    });

    describe("staking", () => {
        it("passes with only stakedNodeId", () => {
            expect(validate({ stakedNodeId: 3 })).not.toThrow();
        });

        it("throws when stakedAccountId and stakedNodeId are both set", () => {
            expect(
                validate({ stakedAccountId: "0.0.3", stakedNodeId: 3 }),
            ).toThrow(
                /stakedAccountId and stakedNodeId are mutually exclusive/,
            );
        });
    });

    describe("memo", () => {
        it("passes at exactly 100 bytes", () => {
            expect(validate({ memo: "a".repeat(100) })).not.toThrow();
        });

        it("throws over 100 bytes, counting UTF-8 bytes", () => {
            // 34 × 3-byte characters = 102 bytes
            expect(validate({ memo: "€".repeat(34) })).toThrow(
                /Account memo exceeds 100 bytes \(got 102\)/,
            );
        });
    });

    describe("autoRenewPeriod", () => {
        it("leaves the range to the network, whose bounds are configurable", () => {
            expect(validate({ autoRenewPeriod: 2_591_999 })).not.toThrow();
            expect(validate({ autoRenewPeriod: 8_000_001 })).not.toThrow();
            expect(validate({ autoRenewPeriod: 9_000_000 })).not.toThrow();
        });
    });
});
