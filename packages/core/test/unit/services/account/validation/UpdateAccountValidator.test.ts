import { describe, it, expect } from "vitest";
import {
    ContractId,
    EvmHook,
    HookCreationDetails,
    HookExtensionPoint,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { UpdateAccountValidator } from "../../../../../src/services/account/validation/index.js";
import type { UpdateAccountOptions } from "../../../../../src/services/account/operations/index.js";

describe("UpdateAccountValidator", () => {
    const validator = new UpdateAccountValidator();
    const validate = (options: Partial<UpdateAccountOptions>) => () =>
        validator.validate({ accountId: "0.0.1001", ...options });

    it("passes with only accountId", () => {
        expect(validate({})).not.toThrow();
    });

    it.each([
        [undefined, "accountId is required."],
        [null, "accountId is required."],
        ["", "accountId cannot be an empty string."],
        ["   ", "accountId cannot be an empty string."],
    ])("rejects accountId %j with INPUT_INVALID", (accountId, message) => {
        expect(validate({ accountId: accountId as unknown as string })).toThrow(
            expect.objectContaining({ code: "INPUT_INVALID", message }),
        );
    });

    describe("key rotation", () => {
        const newKey = PrivateKey.generateED25519();

        it("passes with additionalSigners", () => {
            expect(
                validate({
                    key: newKey.publicKey,
                    additionalSigners: [newKey],
                }),
            ).not.toThrow();
        });

        it("passes with externalSigners", () => {
            expect(
                validate({
                    key: newKey.publicKey,
                    externalSigners: [
                        {
                            publicKey: newKey.publicKey,
                            sign: (message) =>
                                Promise.resolve(newKey.sign(message)),
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when a new key has no signers", () => {
            expect(validate({ key: newKey.publicKey })).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    message: expect.stringContaining(
                        "Key rotation requires both the old and new key to sign",
                    ),
                }),
            );
        });

        it("throws when the signer lists are empty", () => {
            expect(
                validate({
                    key: newKey.publicKey,
                    additionalSigners: [],
                    externalSigners: [],
                }),
            ).toThrow(/Key rotation requires both the old and new key to sign/);
        });
    });

    describe("expirationTime", () => {
        it("passes with a future date", () => {
            expect(
                validate({ expirationTime: new Date(Date.now() + 60_000) }),
            ).not.toThrow();
        });

        it("throws with a past date", () => {
            expect(
                validate({ expirationTime: new Date(Date.now() - 60_000) }),
            ).toThrow(/expirationTime must be in the future/);
        });
    });

    describe("staking", () => {
        it("passes with only stakedAccountId", () => {
            expect(validate({ stakedAccountId: "0.0.3" })).not.toThrow();
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

        it("throws over 100 bytes", () => {
            expect(validate({ memo: "a".repeat(101) })).toThrow(
                /Account memo exceeds 100 bytes \(got 101\)/,
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

    describe("hooksToCreate / hooksToDelete", () => {
        const hook = (hookId: number) =>
            new HookCreationDetails({
                extensionPoint: HookExtensionPoint.ACCOUNT_ALLOWANCE_HOOK,
                hookId,
                evmHook: new EvmHook({
                    contractId: ContractId.fromString("0.0.1234"),
                }),
            });

        it("passes with hooks to create and hook IDs to delete", () => {
            expect(
                validate({ hooksToCreate: [hook(2)], hooksToDelete: [1] }),
            ).not.toThrow();
        });

        it("throws on an invalid hook to create", () => {
            expect(validate({ hooksToCreate: [hook(-1)] })).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    context: "UpdateAccountValidator",
                    message: expect.stringContaining(
                        "hooksToCreate[0].hookId must be a non-negative integer",
                    ),
                }),
            );
        });

        it("throws on a negative hook ID to delete", () => {
            expect(validate({ hooksToDelete: [-1] })).toThrow(
                expect.objectContaining({
                    code: "INPUT_INVALID",
                    context: "UpdateAccountValidator",
                    message: expect.stringContaining(
                        "hooksToDelete[0] must be a non-negative integer",
                    ),
                }),
            );
        });
    });
});
