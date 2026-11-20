import { describe, it, expect } from "vitest";
import {
    ContractId,
    EvmHook,
    HookCreationDetails,
    HookExtensionPoint,
    PrivateKey,
} from "@hiero-ledger/sdk";
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

        it("passes when an EVM address alias is combined with key", () => {
            expect(() =>
                validator.validate({
                    key: PrivateKey.generateED25519().publicKey,
                    alias: PrivateKey.generateECDSA().publicKey.toEvmAddress(),
                }),
            ).not.toThrow();
        });

        it("throws when an ecdsaPublicKey alias is combined with key", () => {
            expect(() =>
                validator.validate({
                    key: PrivateKey.generateED25519().publicKey,
                    alias: {
                        ecdsaPublicKey:
                            PrivateKey.generateECDSA().publicKey.toStringRaw(),
                    },
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

        it("passes with an EVM address, with or without 0x", () => {
            const address = PrivateKey.generateECDSA().publicKey.toEvmAddress();
            expect(validate({ alias: address })).not.toThrow();
            expect(validate({ alias: `0x${address}` })).not.toThrow();
            expect(validate({ alias: address.toUpperCase() })).not.toThrow();
        });

        it.each([
            ["empty", ""],
            ["too short", "0x" + "a".repeat(38)],
            ["too long", "a".repeat(42)],
            ["non-hex", "0x" + "g".repeat(40)],
            ["account ID", "0.0.1234"],
        ])("throws on an alias that isn't an EVM address (%s)", (_, alias) => {
            expect(validate({ alias })).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    context: "CreateAccountValidator",
                    message: expect.stringContaining(
                        "alias must be an EVM address: 40 hex characters, optionally prefixed with 0x.",
                    ),
                }),
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

        it("passes at exactly 100 bytes of multi-byte characters", () => {
            // 50 × 2-byte characters = 100 bytes
            expect(validate({ memo: "é".repeat(50) })).not.toThrow();
        });

        it("throws one byte over 100 with multi-byte characters", () => {
            // 49 × 2 bytes + 3 bytes = 101 bytes
            expect(validate({ memo: "é".repeat(49) + "€" })).toThrow(
                /Account memo exceeds 100 bytes \(got 101\)/,
            );
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

    describe("hooks", () => {
        const hook = (hookId: number) =>
            new HookCreationDetails({
                extensionPoint: HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK,
                hookId,
                evmHook: new EvmHook({
                    contractId: ContractId.fromString("0.0.1234"),
                }),
            });

        it("passes with valid hooks", () => {
            expect(validate({ hooks: [hook(0), hook(1)] })).not.toThrow();
        });

        it("throws on a duplicate hook ID", () => {
            expect(validate({ hooks: [hook(1), hook(1)] })).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    context: "CreateAccountValidator",
                    message: expect.stringContaining(
                        "hooks uses hookId 1 more than once",
                    ),
                }),
            );
        });
    });
});
