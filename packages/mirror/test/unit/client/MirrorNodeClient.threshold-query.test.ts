import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { jsonResponse } from "../../utils/http.js";

describe("MirrorNodeClient balance threshold queries", () => {
    let client: MirrorNodeClient;
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = new MirrorNodeClient("https://x");
    });
    afterEach(() => vi.restoreAllMocks());

    const url = () => String(spy.mock.calls[0][0]);

    describe("queryAccounts", () => {
        beforeEach(() => {
            spy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(
                    jsonResponse({ accounts: [], links: { next: null } }),
                );
        });

        it("builds a balance-range query with limit and order", async () => {
            await client.queryAccounts({
                balance: { gte: 100_000_000_000, lt: 1_000_000_000_000 },
                limit: 100,
                order: "desc",
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts" +
                    "?account.balance=gte:100000000000" +
                    "&account.balance=lt:1000000000000" +
                    "&limit=100&order=desc",
            );
        });

        it("accepts exact string thresholds past 2^53 — composing with the builders", async () => {
            // A whale threshold cannot be expressed as a number without
            // rounding; the string arm carries the builders' exact output.
            await client.queryAccounts({
                balance: { gte: "31869085891081369" },
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts" +
                    "?account.balance=gte:31869085891081369",
            );
        });

        it("supports an exact balance as a plain number", async () => {
            await client.queryAccounts({ balance: 5_000_000_000 });
            expect(url()).toBe(
                "https://x/api/v1/accounts?account.balance=5000000000",
            );
        });

        it("adds no params when options are omitted", async () => {
            await client.queryAccounts();
            expect(url()).toBe("https://x/api/v1/accounts");
        });

        it("passes the includeBalance toggle as the balance param", async () => {
            await client.queryAccounts({
                includeBalance: false,
                limit: 100,
            });
            expect(url()).toBe(
                "https://x/api/v1/accounts?balance=false&limit=100",
            );
        });

        it("converts account items and exposes pagination", async () => {
            vi.restoreAllMocks();
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                jsonResponse({
                    accounts: [
                        {
                            account: "0.0.5",
                            balance: { balance: 200_000_000_000, tokens: [] },
                        },
                    ],
                    links: { next: "/api/v1/accounts?account.id=gt:0.0.5" },
                }),
            );
            const page = await client.queryAccounts({
                balance: { gte: 100_000_000_000 },
            });
            expect(page.data).toHaveLength(1);
            expect(page.data[0].accountId).toBe("0.0.5");
            expect(page.data[0].balance).toBe("200000000000");
            expect(page.next).toBeTypeOf("function");
        });
    });

    describe("queryTokenBalances", () => {
        it("builds a holder threshold query", async () => {
            spy = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(
                    jsonResponse({ balances: [], links: { next: null } }),
                );
            await client.queryTokenBalances("0.0.456858", {
                accountBalance: { gte: 1_000_000 },
                order: "desc",
                limit: 100,
            });
            expect(url()).toBe(
                "https://x/api/v1/tokens/0.0.456858/balances" +
                    "?account.balance=gte:1000000&limit=100&order=desc",
            );
        });

        it("converts holder entries to TokenHolder", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(
                jsonResponse({
                    timestamp: "1700000000.000000000",
                    balances: [
                        { account: "0.0.7", balance: 2_500_000, decimals: 6 },
                        { account: "0.0.8", balance: 1_000_000 },
                    ],
                    links: { next: null },
                }),
            );
            const page = await client.queryTokenBalances("0.0.456858");
            expect(page.data).toEqual([
                { accountId: "0.0.7", balance: "2500000", decimals: 6 },
                { accountId: "0.0.8", balance: "1000000", decimals: undefined },
            ]);
            expect(page.next).toBeNull();
        });
    });
});
