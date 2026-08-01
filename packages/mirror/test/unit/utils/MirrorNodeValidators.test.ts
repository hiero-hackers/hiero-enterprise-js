import { describe, it, expect } from "vitest";
import {
    assertPageResponse,
    assertAccountResponse,
    assertNftResponse,
    assertTokenResponse,
    assertTopicMessageResponse,
    assertTransactionListResponse,
    assertTransactionResponse,
    assertExchangeRatesResponse,
    assertNetworkSupplyResponse,
    assertNetworkStakeResponse,
} from "../../../src/utils/MirrorNodeValidators.js";
import { MirrorError } from "../../../src/errors/MirrorError.js";

describe("mirror node response validators", () => {
    it("accept well-formed payloads", () => {
        expect(() => assertPageResponse({ items: [] }, "/p")).not.toThrow();
        expect(() =>
            assertAccountResponse({ account: "0.0.1" }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertNftResponse({ token_id: "0.0.5", serial_number: 1 }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertTokenResponse({ token_id: "0.0.5" }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertTopicMessageResponse(
                { topic_id: "0.0.7", sequence_number: 1 },
                "/p",
            ),
        ).not.toThrow();
        expect(() =>
            assertTransactionListResponse({ transactions: [] }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertTransactionResponse({ transaction_id: "x" }, "/p"),
        ).not.toThrow();
        expect(() =>
            assertExchangeRatesResponse(
                { current_rate: {}, next_rate: {} },
                "/p",
            ),
        ).not.toThrow();
        expect(() =>
            assertNetworkSupplyResponse(
                { released_supply: "1", total_supply: "2" },
                "/p",
            ),
        ).not.toThrow();
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: 1 }, "/p"),
        ).not.toThrow();
        // Mainnet's max_stake_rewarded is 18 digits, so the lossless parse
        // delivers it as a string — the validator must accept that arm too,
        // or every mainnet /network/stake call throws a schema mismatch.
        expect(() =>
            assertNetworkStakeResponse(
                { max_stake_rewarded: "650000000000000001" },
                "/p",
            ),
        ).not.toThrow();
        // …but only the integer-string arm the lossless parse can actually
        // produce — arbitrary strings in an amount slot are a malformed
        // payload, not a parse artifact.
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: "abc" }, "/p"),
        ).toThrow(MirrorError);
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: "1.5" }, "/p"),
        ).toThrow(MirrorError);
        // The number arm enforces the same provably-exact invariant as the
        // normalisers: 1.5 is valid JSON and must not pass. (NaN/Infinity
        // cannot arrive via JSON.parse at all; isSafeInteger rejects them
        // for free.)
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: 1.5 }, "/p"),
        ).toThrow(MirrorError);
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: NaN }, "/p"),
        ).toThrow(MirrorError);
        // An integer-valued number at/past 2^53 (`1e20` is valid JSON) can
        // only have arrived through a form the lossless quoter cannot
        // protect — already rounded, so not provably exact. Same rule as
        // amountString/amountNumber: reject at the schema boundary.
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: 1e20 }, "/p"),
        ).toThrow(MirrorError);
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: 2 ** 53 }, "/p"),
        ).toThrow(MirrorError);
        // The exact boundary still passes.
        expect(() =>
            assertNetworkStakeResponse(
                { max_stake_rewarded: Number.MAX_SAFE_INTEGER },
                "/p",
            ),
        ).not.toThrow();
        // …and the diagnostic names the culprit: JSON.stringify would
        // report NaN as "null".
        expect(() =>
            assertNetworkStakeResponse({ max_stake_rewarded: NaN }, "/p"),
        ).toThrow(/got NaN/);
        // A huge invalid string is truncated in the diagnostic — a
        // multi-megabyte payload value must not become the error message.
        let message = "";
        try {
            assertNetworkStakeResponse(
                { max_stake_rewarded: "x".repeat(1_000_000) },
                "/p",
            );
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toMatch(/expected a whole amount/);
        expect(message.length).toBeLessThan(200);
    });

    it("reject malformed payloads with MirrorError schema mismatches", () => {
        const cases: Array<() => void> = [
            () => assertPageResponse({ links: {} }, "/p"),
            () => assertPageResponse(null, "/p"),
            () => assertAccountResponse({}, "/p"),
            () => assertNftResponse({ token_id: "0.0.5" }, "/p"),
            () => assertTokenResponse({ name: "T" }, "/p"),
            () => assertTopicMessageResponse({ topic_id: "0.0.7" }, "/p"),
            () => assertTransactionListResponse({}, "/p"),
            () => assertTransactionResponse({}, "/p"),
            () => assertExchangeRatesResponse({ current_rate: {} }, "/p"),
            () => assertNetworkSupplyResponse({ released_supply: "1" }, "/p"),
            () => assertNetworkStakeResponse({}, "/p"),
            () => assertAccountResponse([1, 2], "/p"),
        ];
        for (const attempt of cases) {
            expect(attempt).toThrow(MirrorError);
        }
    });
});
