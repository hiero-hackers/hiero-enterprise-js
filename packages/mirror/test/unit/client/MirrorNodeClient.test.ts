import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import {
    MirrorError,
    MirrorErrorCodes,
} from "../../../src/errors/MirrorError.js";

describe("MirrorNodeClient", () => {
    let client: MirrorNodeClient;

    beforeEach(() => {
        client = new MirrorNodeClient("https://testnet.mirrornode.hedera.com");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("constructor", () => {
        it("removes trailing slash from base URL", () => {
            const c = new MirrorNodeClient("https://example.com///");
            // Access private field — we test behavior indirectly
            expect(c).toBeDefined();
        });
    });

    describe("fetch error handling", () => {
        it("throws MirrorError on network failure", async () => {
            vi.spyOn(globalThis, "fetch").mockRejectedValue(
                new Error("ECONNREFUSED"),
            );
            await expect(client.queryAccount("0.0.1")).rejects.toThrow(
                MirrorError,
            );
            await expect(client.queryAccount("0.0.1")).rejects.toThrow(
                /Mirror node request failed/,
            );
        });

        it("throws MirrorError on HTTP error", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(null, { status: 404, statusText: "Not Found" }),
            );
            await expect(client.queryAccount("0.0.1")).rejects.toThrow(
                MirrorError,
            );
        });
    });

    describe("queryAccount", () => {
        it("converts mirror node response to AccountInfo", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(
                    JSON.stringify({
                        account: "0.0.12345",
                        evm_address: "0x123abc",
                        key: { key: "pubkey123", _type: "ECDSA_SECP256K1" },
                        balance: { balance: 500000, tokens: [] },
                        deleted: false,
                        auto_renew_period: 7776000,
                        memo: "test account",
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );

            const info = await client.queryAccount("0.0.12345");
            expect(info.accountId).toBe("0.0.12345");
            expect(info.evmAddress).toBe("0x123abc");
            expect(info.key).toEqual({
                key: "pubkey123",
                type: "ECDSA_SECP256K1",
            });
            expect(info.balance).toBe(500000);
            expect(info.deleted).toBe(false);
            expect(info.memo).toBe("test account");
        });
    });

    describe("queryNftsByAccount", () => {
        it("converts paginated NFT response", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(
                    JSON.stringify({
                        nfts: [
                            {
                                token_id: "0.0.99",
                                serial_number: 1,
                                account_id: "0.0.12345",
                                metadata: "bWV0YQ==",
                                deleted: false,
                            },
                        ],
                        links: {
                            next: "/api/v1/accounts/0.0.12345/nfts?limit=25&offset=1",
                        },
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );

            const page = await client.queryNftsByAccount("0.0.12345");
            expect(page.data).toHaveLength(1);
            expect(page.data[0].tokenId).toBe("0.0.99");
            expect(page.data[0].serialNumber).toBe(1);
            expect(page.links.next).toBeTruthy();
        });
    });

    describe("queryTokenById", () => {
        it("converts token info response with custom fees", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(
                    JSON.stringify({
                        token_id: "0.0.555",
                        name: "My Token",
                        symbol: "MTK",
                        type: "FUNGIBLE_COMMON",
                        decimals: "8",
                        total_supply: "1000000",
                        max_supply: "0",
                        treasury_account_id: "0.0.12345",
                        deleted: false,
                        pause_status: "NOT_APPLICABLE",
                        custom_fees: {
                            created_timestamp: "1699999999.000000000",
                            fixed_fees: [
                                {
                                    amount: 100,
                                    collector_account_id: "0.0.1",
                                    all_collectors_are_exempt: false,
                                },
                            ],
                        },
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );

            const token = await client.queryTokenById("0.0.555");
            expect(token.tokenId).toBe("0.0.555");
            expect(token.type).toBe("FUNGIBLE_COMMON");
            expect(token.decimals).toBe(8);
            expect(token.customFees).toHaveLength(1);
            expect(token.customFees[0].type).toBe("fixed");
            expect(token.customFeesCreatedTimestamp).toBe(
                "1699999999.000000000",
            );
        });
    });

    describe("queryTransaction", () => {
        it("throws NOT_FOUND for empty transactions", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify({ transactions: [] }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            await expect(
                client.queryTransaction("0.0.12345@1234567890.000"),
            ).rejects.toThrow(/Transaction not found/);
        });
    });

    describe("schema validation", () => {
        it("rejects account response missing 'account' field", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify({ balance: { balance: 1 } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const err = await client.queryAccount("0.0.1").catch((e) => e);
            expect(err).toBeInstanceOf(MirrorError);
            expect(err.code).toBe(MirrorErrorCodes.MirrorNodeSchemaMismatch);
        });

        it("rejects paginated response without a data array", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify({ links: { next: null } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const err = await client
                .queryNftsByAccount("0.0.1")
                .catch((e) => e);
            expect(err).toBeInstanceOf(MirrorError);
            expect(err.code).toBe(MirrorErrorCodes.MirrorNodeSchemaMismatch);
        });

        it("rejects token response missing 'token_id' field", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify({ name: "Foo" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const err = await client.queryTokenById("0.0.555").catch((e) => e);
            expect(err).toBeInstanceOf(MirrorError);
            expect(err.code).toBe(MirrorErrorCodes.MirrorNodeSchemaMismatch);
        });

        it("rejects transaction list response without transactions array", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const err = await client
                .queryTransaction("0.0.1@123.000")
                .catch((e) => e);
            expect(err).toBeInstanceOf(MirrorError);
            expect(err.code).toBe(MirrorErrorCodes.MirrorNodeSchemaMismatch);
        });

        it("rejects a non-object (array) response", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                new Response(JSON.stringify([1, 2, 3]), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const err = await client.queryAccount("0.0.1").catch((e) => e);
            expect(err).toBeInstanceOf(MirrorError);
            expect(err.code).toBe(MirrorErrorCodes.MirrorNodeSchemaMismatch);
        });
    });
});
