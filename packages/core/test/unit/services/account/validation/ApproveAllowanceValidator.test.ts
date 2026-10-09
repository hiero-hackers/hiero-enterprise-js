import { describe, it, expect } from "vitest";
import { ApproveAllowanceValidator } from "../../../../../src/services/account/validation/index.js";
import type { ApproveAllowanceOptions } from "../../../../../src/services/account/operations/index.js";

describe("ApproveAllowanceValidator", () => {
    const validator = new ApproveAllowanceValidator();

    // At least one allowance required

    it("throws when no allowances are provided", () => {
        expect(() => validator.validate({} as ApproveAllowanceOptions)).toThrow(
            /At least one allowance must be provided/,
        );
        expect(() => validator.validate({} as ApproveAllowanceOptions)).toThrow(
            expect.objectContaining({ code: "INPUT_INVALID" }),
        );
    });

    it("throws when all arrays are empty", () => {
        expect(() =>
            validator.validate({
                hbarAllowances: [],
                tokenAllowances: [],
                nftAllowances: [],
            }),
        ).toThrow(/At least one allowance must be provided/);
    });

    // HBAR allowances

    describe("hbarAllowances", () => {
        it("passes with valid HBAR allowance", () => {
            expect(() =>
                validator.validate({
                    hbarAllowances: [
                        {
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: 10,
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when ownerAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    hbarAllowances: [
                        {
                            ownerAccountId: "",
                            spenderAccountId: "0.0.200",
                            amount: 10,
                        },
                    ],
                }),
            ).toThrow(/ownerAccountId is required/);
        });

        it("throws when spenderAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    hbarAllowances: [
                        {
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "",
                            amount: 10,
                        },
                    ],
                }),
            ).toThrow(/spenderAccountId is required/);
        });

        it("throws when amount is null", () => {
            expect(() =>
                validator.validate({
                    hbarAllowances: [
                        {
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: null as unknown as number,
                        },
                    ],
                }),
            ).toThrow(/amount is required/);
        });

        it("throws when amount is negative", () => {
            expect(() =>
                validator.validate({
                    hbarAllowances: [
                        {
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: -1,
                        },
                    ],
                }),
            ).toThrow(/amount cannot be negative/);
        });

        it("allows zero amount (revoke pattern)", () => {
            expect(() =>
                validator.validate({
                    hbarAllowances: [
                        {
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: 0,
                        },
                    ],
                }),
            ).not.toThrow();
        });
    });

    // Token allowances

    describe("tokenAllowances", () => {
        it("passes with valid token allowance", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: 1000,
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when tokenId is missing", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: 100,
                        },
                    ],
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when ownerAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "",
                            spenderAccountId: "0.0.200",
                            amount: 100,
                        },
                    ],
                }),
            ).toThrow(/ownerAccountId is required/);
        });

        it("throws when spenderAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "",
                            amount: 100,
                        },
                    ],
                }),
            ).toThrow(/spenderAccountId is required/);
        });

        it("throws when amount is null", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: null as unknown as number,
                        },
                    ],
                }),
            ).toThrow(/amount is required/);
        });

        it("throws when amount is negative", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: -1,
                        },
                    ],
                }),
            ).toThrow(/amount cannot be negative/);
        });

        it("allows zero amount (revoke pattern)", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: 0,
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when amount is not an integer", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: 1.5,
                        },
                    ],
                }),
            ).toThrow(/must be a finite integer/);
        });

        it("throws when amount is Infinity", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: Infinity,
                        },
                    ],
                }),
            ).toThrow(/must be a finite integer/);
        });

        it("allows bigint amount", () => {
            expect(() =>
                validator.validate({
                    tokenAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            amount: BigInt(1000),
                        },
                    ],
                }),
            ).not.toThrow();
        });
    });

    // NFT allowances

    describe("nftAllowances", () => {
        it("passes with serial numbers", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [1, 2, 3],
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("passes with allSerials: true", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            allSerials: true,
                        },
                    ],
                }),
            ).not.toThrow();
        });

        it("throws when tokenId is missing", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [1],
                        },
                    ],
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when ownerAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [1],
                        },
                    ],
                }),
            ).toThrow(/ownerAccountId is required/);
        });

        it("throws when spenderAccountId is missing", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "",
                            serialNumbers: [1],
                        },
                    ],
                }),
            ).toThrow(/spenderAccountId is required/);
        });

        it("throws when neither serialNumbers nor allSerials is set", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                        },
                    ],
                }),
            ).toThrow(/must specify either serialNumbers or allSerials/);
        });

        it("throws when both serialNumbers and allSerials are set", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [1],
                            allSerials: true,
                        },
                    ],
                }),
            ).toThrow(/mutually exclusive/);
        });

        it("throws when serial number is zero", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [0],
                        },
                    ],
                }),
            ).toThrow(/positive integers/);
        });

        it("throws when serial number is negative", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [-1],
                        },
                    ],
                }),
            ).toThrow(/positive integers/);
        });

        it("throws when serial number is not an integer", () => {
            expect(() =>
                validator.validate({
                    nftAllowances: [
                        {
                            tokenId: "0.0.500",
                            ownerAccountId: "0.0.100",
                            spenderAccountId: "0.0.200",
                            serialNumbers: [1.5],
                        },
                    ],
                }),
            ).toThrow(/positive integers/);
        });
    });

    // Mixed allowances

    it("passes with mixed allowance types", () => {
        expect(() =>
            validator.validate({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5,
                    },
                ],
                tokenAllowances: [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 1000,
                    },
                ],
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                    },
                ],
            }),
        ).not.toThrow();
    });
});
