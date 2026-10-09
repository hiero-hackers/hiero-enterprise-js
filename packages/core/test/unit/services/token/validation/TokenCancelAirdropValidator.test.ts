import { describe, it, expect } from "vitest";
import { AccountId, NftId, PendingAirdropId, TokenId } from "@hiero-ledger/sdk";
import { TokenCancelAirdropValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenCancelAirdropOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenCancelAirdropValidator", () => {
    const validator = new TokenCancelAirdropValidator();

    const fungible = new PendingAirdropId({
        senderId: AccountId.fromString("0.0.700"),
        receiverId: AccountId.fromString("0.0.800"),
        tokenId: TokenId.fromString("0.0.500"),
    });

    const nft = new PendingAirdropId({
        senderId: AccountId.fromString("0.0.700"),
        receiverId: AccountId.fromString("0.0.800"),
        nftId: new NftId(TokenId.fromString("0.0.600"), 1),
    });

    it("passes with a single fungible pending airdrop id", () => {
        expect(() =>
            validator.validate({ pendingAirdropIds: [fungible] }),
        ).not.toThrow();
    });

    it("passes with a single NFT pending airdrop id", () => {
        expect(() =>
            validator.validate({ pendingAirdropIds: [nft] }),
        ).not.toThrow();
    });

    it("passes with a mixed batch of fungible and NFT pending ids", () => {
        expect(() =>
            validator.validate({ pendingAirdropIds: [fungible, nft] }),
        ).not.toThrow();
    });

    it("throws when pendingAirdropIds is null", () => {
        expect(() =>
            validator.validate({
                pendingAirdropIds: null as unknown as PendingAirdropId[],
            }),
        ).toThrow(/pendingAirdropIds is required/);
        expect(() =>
            validator.validate({
                pendingAirdropIds: null as unknown as PendingAirdropId[],
            }),
        ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
    });

    it("throws when pendingAirdropIds is undefined", () => {
        expect(() =>
            validator.validate(
                {} as unknown as TokenCancelAirdropOperationOptions,
            ),
        ).toThrow(/pendingAirdropIds is required/);
    });

    it("throws when pendingAirdropIds is not an array", () => {
        expect(() =>
            validator.validate({
                pendingAirdropIds: "nope" as unknown as PendingAirdropId[],
            }),
        ).toThrow(/pendingAirdropIds must be an array/);
    });

    it("throws when pendingAirdropIds is empty", () => {
        expect(() => validator.validate({ pendingAirdropIds: [] })).toThrow(
            /pendingAirdropIds must not be empty/,
        );
    });

    it("throws with an indexed message when a single entry is null", () => {
        expect(() =>
            validator.validate({
                pendingAirdropIds: [null as unknown as PendingAirdropId],
            }),
        ).toThrow(/pendingAirdropIds\[0\] is required/);
    });

    it("throws with an indexed message when a later entry is null", () => {
        expect(() =>
            validator.validate({
                pendingAirdropIds: [
                    fungible,
                    nft,
                    null as unknown as PendingAirdropId,
                ],
            }),
        ).toThrow(/pendingAirdropIds\[2\] is required/);
    });

    it("throws with an indexed message when an entry is undefined", () => {
        expect(() =>
            validator.validate({
                pendingAirdropIds: [
                    fungible,
                    undefined as unknown as PendingAirdropId,
                ],
            }),
        ).toThrow(/pendingAirdropIds\[1\] is required/);
    });
});
