import { describe, it, expect } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { TopicCreateValidator } from "../../../../../src/services/topic/validation/index.js";
import type { TopicCreateOperationOptions } from "../../../../../src/services/topic/operations/index.js";

describe("TopicCreateValidator", () => {
    const validator = new TopicCreateValidator();

    it("accepts empty options (public, immutable topic)", () => {
        expect(() => validator.validate({})).not.toThrow();
    });

    it("accepts a submitKey-only private topic", () => {
        const submitKey = PrivateKey.generateED25519().publicKey;
        expect(() => validator.validate({ submitKey })).not.toThrow();
    });

    it("accepts adminKey + autoRenewAccountId", () => {
        const adminKey = PrivateKey.generateED25519().publicKey;
        const options: TopicCreateOperationOptions = {
            adminKey,
            autoRenewAccountId: "0.0.99",
        };
        expect(() => validator.validate(options)).not.toThrow();
    });

    it("rejects adminKey without autoRenewAccountId", () => {
        const adminKey = PrivateKey.generateED25519().publicKey;
        expect(() => validator.validate({ adminKey })).toThrow(
            /autoRenewAccountId is required when an adminKey is set/,
        );
        expect(() => validator.validate({ adminKey })).toThrow(
            expect.objectContaining({ code: "INPUT_INVALID" }),
        );
    });
});
