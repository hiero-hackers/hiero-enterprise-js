import { describe, it, expect, afterEach, vi } from "vitest";
import { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";
import { convertContractResult } from "../../../src/utils/MirrorNodeConverters.js";
import type { MirrorContractResult } from "../../../src/types/index.js";
import { jsonResponse } from "../../utils/http.js";

/**
 * The spec models contract-result LIST rows and per-result DETAILS as
 * one schema, but the live mirror serves only a 15-field subset on
 * lists — `result`/`status` and the block/ethereum-envelope fields
 * arrive only on details. These tests pin (a) that the list subset
 * converts without inventing fields, and (b) that balance-family
 * pagination stays on ONE snapshot by pinning the timestamp onto
 * next-page links (the mirror's own links omit it).
 */

/** Exactly the fields the live list endpoint returns — no more. */
const LIST_ROW: MirrorContractResult = {
    address: "0x00000000000000000000000000000000009fff35",
    amount: 0,
    bloom: "0x",
    call_result: "0x01",
    contract_id: "0.0.10483157",
    created_contract_ids: [],
    error_message: null,
    from: "0x0000000000000000000000000000000000a1cd45",
    function_parameters: "0x",
    gas_consumed: 21_000,
    gas_limit: 30_000,
    gas_used: 26_327,
    timestamp: "1783169055.476320000",
    to: "0x00000000000000000000000000000000009fff35",
    hash: "0xabc",
};

describe("contract result list vs detail shape", () => {
    it("converts a live-shaped LIST row; detail-only fields stay absent", () => {
        const converted = convertContractResult(LIST_ROW);
        expect(converted.contractId).toBe("0.0.10483157");
        expect(converted.gasUsed).toBe(26_327);
        expect(converted.errorMessage).toBeNull(); // success signal on lists
        // Not invented from nowhere:
        expect(converted.result).toBeUndefined();
        expect(converted.status).toBeUndefined();
        expect(converted.blockNumber).toBeUndefined();
    });
});

describe("balance pagination", () => {
    afterEach(() => vi.restoreAllMocks());

    it("follows the next-page link without adding the body timestamp", async () => {
        const urls: string[] = [];
        vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            urls.push(String(input));
            if (urls.length === 1) {
                return Promise.resolve(
                    jsonResponse({
                        timestamp: "1783171755.402827000",
                        balances: [{ account: "0.0.1", balance: 5 }],
                        links: {
                            next:
                                "/api/v1/tokens/0.0.5/balances" +
                                "?limit=1&account.id=lt:0.0.1",
                        },
                    }),
                );
            }
            return Promise.resolve(
                jsonResponse({
                    timestamp: "1783171755.402827000",
                    balances: [],
                    links: { next: null },
                }),
            );
        });

        const client = new MirrorNodeClient("https://mirror.example");
        const page = await client.queryTokenBalances("0.0.5", { limit: 1 });
        expect(page.links.next).toBe(
            "/api/v1/tokens/0.0.5/balances?limit=1&account.id=lt:0.0.1",
        );
        await page.next?.();

        expect(urls[1]).toBe(
            "https://mirror.example/api/v1/tokens/0.0.5/balances" +
                "?limit=1&account.id=lt:0.0.1",
        );
    });

    it("follows next links on endpoints without a body timestamp", async () => {
        const urls: string[] = [];
        vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            urls.push(String(input));
            return Promise.resolve(
                jsonResponse({
                    transactions: [],
                    links: {
                        next:
                            urls.length === 1
                                ? "/api/v1/transactions?limit=1&timestamp=lt:5"
                                : null,
                    },
                }),
            );
        });

        const client = new MirrorNodeClient("https://mirror.example");
        const page = await client.queryTransactions({ limit: 1 });
        await page.next?.();

        expect(urls[1]).toBe(
            "https://mirror.example/api/v1/transactions?limit=1&timestamp=lt:5",
        );
    });
});
