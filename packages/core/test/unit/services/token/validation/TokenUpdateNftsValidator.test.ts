import { describe, it, expect } from "vitest";
import { Long } from "@hiero-ledger/sdk";
import { TokenUpdateNftsValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenUpdateNftsOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenUpdateNftsValidator", () => {
    const validator = new TokenUpdateNftsValidator();

    const baseOptions: TokenUpdateNftsOperationOptions = {
        tokenId: "0.0.500",
        serialNumbers: [1],
        metadata: new Uint8Array([1, 2, 3]),
    };

    it("passes with valid minimal options", () => {
        expect(() => validator.validate(baseOptions)).not.toThrow();
    });

    it("passes with Long serial numbers", () => {
        expect(() =>
            validator.validate({
                ...baseOptions,
                serialNumbers: [Long.fromNumber(1), Long.fromNumber(2)],
            }),
        ).not.toThrow();
    });

    it("passes with a mixed array of Long and number serials", () => {
        expect(() =>
            validator.validate({
                ...baseOptions,
                serialNumbers: [1, Long.fromNumber(2), 3],
            }),
        ).not.toThrow();
    });

    describe("tokenId", () => {
        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: null as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: null as unknown as string,
                }),
            ).toThrow(expect.objectContaining({ code: "INPUT_INVALID" }));
        });

        it("throws when tokenId is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: undefined as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when tokenId is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenId: "   " }),
            ).toThrow(/tokenId cannot be empty/);
        });
    });

    describe("serialNumbers", () => {
        it("throws when serialNumbers is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    serialNumbers: null as unknown as number[],
                }),
            ).toThrow(/serialNumbers is required/);
        });

        it("throws when serialNumbers is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    serialNumbers: undefined as unknown as number[],
                }),
            ).toThrow(/serialNumbers is required/);
        });

        it("throws when serialNumbers is not an array", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    serialNumbers: 1 as unknown as number[],
                }),
            ).toThrow(/serialNumbers must be an array/);
        });

        it("throws when serialNumbers is empty", () => {
            expect(() =>
                validator.validate({ ...baseOptions, serialNumbers: [] }),
            ).toThrow(/serialNumbers must not be empty/);
        });

        it("throws when serialNumbers contains a null entry", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    serialNumbers: [1, null as unknown as number, 3],
                }),
            ).toThrow(/serialNumbers\[1\] is required/);
        });
    });

    describe("metadata", () => {
        it("throws when metadata is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    metadata: null as unknown as Uint8Array,
                }),
            ).toThrow(/metadata is required/);
        });

        it("throws when metadata is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    metadata: undefined as unknown as Uint8Array,
                }),
            ).toThrow(/metadata is required/);
        });

        it("throws when metadata is not a Uint8Array", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    metadata: [1, 2, 3] as unknown as Uint8Array,
                }),
            ).toThrow(/metadata must be a Uint8Array/);
        });

        it("throws when metadata is empty", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    metadata: new Uint8Array(),
                }),
            ).toThrow(/metadata cannot be empty/);
        });
    });
});
