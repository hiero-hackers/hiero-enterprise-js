import { describe, it, expect } from "vitest";
import {
    parseLossless,
    quoteLargeIntegers,
} from "../../../src/utils/LosslessJson.js";

describe("quoteLargeIntegers", () => {
    it("quotes bare integers of 16+ digits", () => {
        expect(quoteLargeIntegers('{"balance":31869085891081369}')).toBe(
            '{"balance":"31869085891081369"}',
        );
    });

    it("leaves 15-digit integers (always exact) untouched", () => {
        expect(quoteLargeIntegers('{"balance":999999999999999}')).toBe(
            '{"balance":999999999999999}',
        );
    });

    it("quotes negative large integers (transfer debit legs)", () => {
        expect(quoteLargeIntegers('{"amount":-31869085891081369}')).toBe(
            '{"amount":"-31869085891081369"}',
        );
    });

    it("never touches digits inside string values", () => {
        const text = '{"memo":"ref: 99999999999999999","id":"0.0.1"}';
        expect(quoteLargeIntegers(text)).toBe(text);
    });

    it("honours escaped quotes inside strings", () => {
        const text = '{"memo":"say \\"99999999999999999\\" twice"}';
        expect(quoteLargeIntegers(text)).toBe(text);
    });

    it("leaves fractions and exponents alone", () => {
        const text = '{"rate":0.0000915,"big":1234567890123456.5,"e":1e20}';
        expect(quoteLargeIntegers(text)).toBe(text);
    });

    it("never quotes the digits of a 16+-digit fraction", () => {
        // The fraction's digits must not be re-scanned as a standalone
        // integer once the scanner rejects the number token.
        const text = '{"ratio":0.12345678901234567,"next":1}';
        expect(quoteLargeIntegers(text)).toBe(text);
    });

    it("never launders leading-zero tokens — invalid JSON must stay invalid", () => {
        // `00000000000000001` is not a valid JSON number. Quoting it
        // would turn a malformed payload into a well-formed string that
        // even passes the amount validators; leaving it bare lets
        // JSON.parse reject it, which the client surfaces as its typed
        // malformed-body error.
        const bad = '{"a":00000000000000001}';
        expect(quoteLargeIntegers(bad)).toBe(bad);
        expect(() => parseLossless(bad)).toThrow(SyntaxError);
        expect(() => parseLossless('{"a":-00000000000000001}')).toThrow(
            SyntaxError,
        );
    });

    it("quotes inside arrays and nested objects", () => {
        expect(
            quoteLargeIntegers(
                '{"a":[12345678901234567,{"b":98765432109876543}]}',
            ),
        ).toBe('{"a":["12345678901234567",{"b":"98765432109876543"}]}');
    });
});

describe("parseLossless", () => {
    it("preserves every #136 mainnet evidence value JSON.parse corrupts", () => {
        // The 7-of-10 top mainnet balances from #136 that round at JSON.parse.
        const wire = [
            "31869085891081369",
            "34853937876028246",
            "28116264834294619",
            "28912437152291031",
            "10000002599702345",
            "75429753064560425",
            "32843903199313405",
        ];
        for (const value of wire) {
            // Sanity: plain JSON.parse really does corrupt these…
            expect(String(JSON.parse(value))).not.toBe(value);
            // …and the lossless parse does not.
            const parsed = parseLossless(`{"balance":${value}}`) as {
                balance: string;
            };
            // Pin the `number | string` union to its string branch at this
            // magnitude — the cast above types the access, this proves it.
            expect(typeof parsed.balance).toBe("string");
            expect(parsed.balance).toBe(value);
        }
    });

    it("leaves small numbers as numbers", () => {
        expect(parseLossless('{"balance":42,"decimals":8}')).toEqual({
            balance: 42,
            decimals: 8,
        });
    });

    it("round-trips an untouched payload identically to JSON.parse", () => {
        const text =
            '{"account":"0.0.98","deleted":false,"tokens":[],"links":{"next":null}}';
        expect(parseLossless(text)).toEqual(JSON.parse(text));
    });
});
