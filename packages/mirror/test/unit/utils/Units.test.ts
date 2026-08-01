import { describe, it, expect } from "vitest";
import { MirrorError } from "../../../src/errors/MirrorError.js";
import {
    TINYBAR_PER_HBAR,
    tinybarToHbar,
    tinybarToHbarExact,
    hbarToTinybar,
    formatUnits,
    formatUnitsExact,
    parseUnits,
    amountNumber,
    amountString,
    toConsensusTimestamp,
    fromConsensusTimestamp,
    timestampRange,
} from "../../../src/utils/Units.js";

describe("HBAR conversions", () => {
    it("converts tinybars to HBAR (number and string input)", () => {
        expect(tinybarToHbar(100_000_000)).toBe(1);
        expect(tinybarToHbar("250000000")).toBe(2.5);
        expect(tinybarToHbar(0)).toBe(0);
    });

    it("converts HBAR to tinybars as an exact decimal string", () => {
        expect(hbarToTinybar(1)).toBe(String(TINYBAR_PER_HBAR));
        expect(hbarToTinybar(2.5)).toBe("250000000");
        // 0.1 ℏ is not exactly representable in binary floating point;
        // scaling the decimal text still lands on the exact tinybar amount.
        expect(hbarToTinybar(0.1)).toBe("10000000");
    });

    it("builds tinybar amounts past 2^53 digit-exactly (#136)", () => {
        // 9007199254740993 tinybar is odd and above 2^53 — float math
        // cannot produce it (it rounds to ...92); text scaling can.
        expect(hbarToTinybar("90071992.54740993")).toBe("9007199254740993");
        expect(parseUnits(2, 18)).toBe("2000000000000000000");
        expect(parseUnits("123456789.123456789123456789", 18)).toBe(
            "123456789123456789123456789",
        );
    });

    it("accepts scientific-notation numbers and rounds half away from zero", () => {
        // String(1e-7) === "1e-7" — the expander must normalise it.
        expect(parseUnits(1e-7, 9)).toBe("100");
        expect(parseUnits("1.0000005", 6)).toBe("1000001");
        expect(parseUnits("-2.5", 6)).toBe("-2500000");
        expect(parseUnits("0.4", 0)).toBe("0");
    });

    it("round-trips", () => {
        expect(tinybarToHbar(hbarToTinybar(1234.56789))).toBeCloseTo(
            1234.56789,
            8,
        );
    });
});

describe("token unit conversions", () => {
    it("formats a raw amount using decimals", () => {
        expect(formatUnits("2500000", 6)).toBe(2.5); // 2.5 USDC
        expect(formatUnits(7, 0)).toBe(7);
    });

    it("holds every helper to the same decimals contract", () => {
        // 10 ** -1 or 10 ** 1e6 would silently yield a misscaled figure
        // or Infinity — the typed error is the contract, display helper
        // or not.
        expect(() => formatUnits("1", -1)).toThrow(MirrorError);
        expect(() => formatUnits("1", 1.5)).toThrow(MirrorError);
        expect(() => formatUnits("1", 101)).toThrow(MirrorError);
    });

    it("parses a display amount to the smallest unit", () => {
        expect(parseUnits(2.5, 6)).toBe("2500000");
        expect(parseUnits(0.1, 2)).toBe("10");
    });

    it("trims edge whitespace on HUMAN input — deliberately, unlike the wire normalisers", () => {
        // Builders parse human input (form fields, config); trimming
        // cannot change a digit, so it carries zero precision risk. The
        // wire normalisers (amountString/amountNumber) reject the same
        // whitespace because THEIR input is machine-generated, where
        // whitespace can only mean a corrupted payload.
        expect(parseUnits(" 2.5 ", 6)).toBe("2500000");
        expect(hbarToTinybar("\t1\n")).toBe("100000000");
        expect(formatUnitsExact(" 25 ", 1)).toBe("2.5");
        // Interior whitespace could hide a malformed amount — typed error.
        expect(() => parseUnits("2 .5", 6)).toThrow(MirrorError);
        expect(() => formatUnitsExact("2 5", 1)).toThrow(MirrorError);
    });

    it("rejects malformed amounts and invalid decimals", () => {
        expect(() => parseUnits("1,5", 6)).toThrow(MirrorError);
        expect(() => parseUnits("abc", 6)).toThrow(MirrorError);
        expect(() => parseUnits(1, -1)).toThrow(MirrorError);
        expect(() => parseUnits(1, 1.5)).toThrow(MirrorError);
        expect(() => parseUnits(NaN, 6)).toThrow(MirrorError);
        // The diagnostic names the culprit — JSON.stringify(NaN) is "null".
        expect(() => parseUnits(NaN, 6)).toThrow(/got NaN/);
        // Deliberately stricter than Number(): amounts must be in plain
        // decimal form — no bare fraction, no leading plus.
        expect(() => parseUnits(".5", 6)).toThrow(MirrorError);
        expect(() => parseUnits("+5", 6)).toThrow(MirrorError);
    });

    it("rejects absurd exponents with a typed error, not a string-length crash", () => {
        // '0'.repeat(2^31) would otherwise throw an uncontrolled RangeError
        // (and mid-size exponents would silently allocate huge strings).
        expect(() => parseUnits("1e2147483646", 0)).toThrow(MirrorError);
        expect(() => parseUnits("1e100000000", 0)).toThrow(MirrorError);
    });

    it("rounds legitimately tiny values to zero instead of rejecting them", () => {
        // The digit cap counts INTEGER digits — a long fraction is
        // cost-free and simply rounds away.
        expect(hbarToTinybar(1e-100)).toBe("0");
        expect(hbarToTinybar(5e-324)).toBe("0"); // smallest positive double
        expect(parseUnits(`0.${"0".repeat(150)}1`, 6)).toBe("0");
        // Negative-exponent bombs still get the typed error, not a
        // pathological repeat() allocation.
        expect(() => parseUnits("1e-100000000", 6)).toThrow(MirrorError);
    });

    it("caps digits — untrusted input cannot mint giant BigInts or buffers", () => {
        const giant = "9".repeat(1_000_000);
        // A million valid digits: typed rejection before any BigInt work.
        expect(() => parseUnits(giant, 6)).toThrow(MirrorError);
        expect(() => parseUnits(giant, 6)).toThrow(/digits/);
        expect(() => hbarToTinybar(`${giant}.5`)).toThrow(MirrorError);
        // `decimals` is capped too — `padEnd(decimals)` is a buffer bomb
        // otherwise.
        expect(() => parseUnits("1", 101)).toThrow(MirrorError);
        // The cap is generous: a 100-digit amount still converts exactly.
        expect(parseUnits("9".repeat(100), 0)).toBe("9".repeat(100));
        // A huge *invalid* input is not echoed back into the error message.
        let message = "";
        try {
            parseUnits(`x${giant}`, 6);
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toMatch(/expected a decimal amount/);
        expect(message.length).toBeLessThan(200);
    });
});

describe("exact display formatting", () => {
    it("formats a whale amount digit-exactly where the number helper rounds", () => {
        // A real top-10 mainnet balance from #136 — not representable as
        // an IEEE-754 double, so `formatUnits` cannot render it exactly.
        expect(formatUnitsExact("31869085891081369", 8)).toBe(
            "318690858.91081369",
        );
        expect(tinybarToHbarExact("31869085891081369")).toBe(
            "318690858.91081369",
        );
    });

    it("is the exact inverse of parseUnits at any magnitude", () => {
        for (const [amount, decimals] of [
            ["31869085891081369", 8],
            ["9007199254740993", 0],
            ["-28912437152291031", 8],
            ["1", 18],
            ["1000000000000000000", 18],
        ] as const) {
            expect(
                parseUnits(formatUnitsExact(amount, decimals), decimals),
            ).toBe(amount);
        }
    });

    it("trims trailing zeros and pads sub-unit values", () => {
        expect(formatUnitsExact("2500000", 6)).toBe("2.5");
        expect(formatUnitsExact("250000000", 8)).toBe("2.5");
        expect(formatUnitsExact("1", 8)).toBe("0.00000001");
        expect(formatUnitsExact("7", 0)).toBe("7");
        expect(formatUnitsExact(100_000_000, 8)).toBe("1");
    });

    it("keeps the sign on debits and normalises zero", () => {
        expect(formatUnitsExact("-28912437152291031", 8)).toBe(
            "-289124371.52291031",
        );
        expect(formatUnitsExact("0", 8)).toBe("0");
        expect(formatUnitsExact("-0", 8)).toBe("0");
        expect(formatUnitsExact("000", 2)).toBe("0");
    });

    it("canonicalises leading zeros so the round-trip holds", () => {
        expect(formatUnitsExact("0001", 0)).toBe("1");
        expect(formatUnitsExact("00025", 1)).toBe("2.5");
        expect(formatUnitsExact("-007", 2)).toBe("-0.07");
        // The round-trip re-emits canonical digits, so it must hold for
        // non-canonical input too.
        expect(parseUnits(formatUnitsExact("0001", 0), 0)).toBe("1");
    });

    it("rejects fractional input, bad decimals, and oversized digits", () => {
        // The input is a raw amount in smallest units — always whole.
        expect(() => formatUnitsExact("2.5", 6)).toThrow(MirrorError);
        expect(() => formatUnitsExact("abc", 6)).toThrow(MirrorError);
        expect(() => formatUnitsExact("1", -1)).toThrow(MirrorError);
        expect(() => formatUnitsExact("1", 101)).toThrow(MirrorError);
        expect(() => formatUnitsExact("9".repeat(101), 0)).toThrow(MirrorError);
        // The cap is generous: 100 digits still format exactly.
        expect(formatUnitsExact("9".repeat(100), 0)).toBe("9".repeat(100));
    });
});

describe("wire amount normalisers", () => {
    it("folds both arms of the lossless-parse union to strings", () => {
        expect(amountString(42)).toBe("42");
        expect(amountString(-42)).toBe("-42");
        expect(amountString(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991");
        expect(amountString("31869085891081369")).toBe("31869085891081369");
        expect(amountString("-31869085891081369")).toBe("-31869085891081369");
        expect(amountString(null)).toBeNull();
        expect(amountString(undefined)).toBeUndefined();
    });

    it("validates BOTH arms — nothing unprovably exact becomes a 'decimal string'", () => {
        // Number arm: the quoter only protects bare integer literals, so
        // a fractional, non-finite, or ≥2^53 number reaching here is
        // either already rounded (exponent/fraction JSON forms) or a
        // direct caller's malformed input. Stringifying it would smuggle
        // "1.5"/"NaN"/a rounded double into the decimal-string contract.
        expect(() => amountString(1.5)).toThrow(MirrorError);
        expect(() => amountString(NaN)).toThrow(MirrorError);
        expect(() => amountString(Infinity)).toThrow(MirrorError);
        expect(() => amountString(2 ** 53)).toThrow(MirrorError);
        // String arm: only the quoter's own shape (optionally signed,
        // digit-only) is a lossless-parse product.
        expect(() => amountString("1e3")).toThrow(MirrorError);
        expect(() => amountString("12.0")).toThrow(MirrorError);
        expect(() => amountString(" 42 ")).toThrow(MirrorError);
        expect(() => amountString("abc")).toThrow(MirrorError);
    });

    it("narrows protocol-bounded amounts back to numbers", () => {
        expect(amountNumber(400000)).toBe(400000);
        expect(amountNumber("-42")).toBe(-42);
        // A quoted 16-digit gas value sits below 2^53, so the narrowing
        // is exact — the whole point of the QUOTE_DIGITS < 2^53 margin.
        expect(amountNumber("9007199254740991")).toBe(9007199254740991);
        expect(amountNumber(null)).toBeNull();
        expect(amountNumber(undefined)).toBeUndefined();
    });

    it("validates the number arm too — no fractional/non-finite/unsafe pass-through", () => {
        expect(() => amountNumber(1.5)).toThrow(MirrorError);
        expect(() => amountNumber(NaN)).toThrow(MirrorError);
        expect(() => amountNumber(Infinity)).toThrow(MirrorError);
        expect(() => amountNumber(2 ** 53)).toThrow(MirrorError);
        // String arm holds the quoter's digit-only shape: "1e3" narrows
        // to a safe 1000, but it is not a lossless-parse product and
        // must not be blessed as one.
        expect(() => amountNumber("1e3")).toThrow(MirrorError);
        expect(() => amountNumber("12.0")).toThrow(MirrorError);
    });

    it("refuses to narrow past the safe-integer range — loud, never lossy", () => {
        // 2^53 + 1: Number() would silently round it to ...992. This
        // helper exists to end silent precision loss, so it must never
        // be a new source of it — the value belongs in amountString.
        expect(() => amountNumber("9007199254740993")).toThrow(MirrorError);
        expect(() => amountNumber("9007199254740993")).toThrow(/safe integer/);
        expect(() => amountNumber("-31869085891081369")).toThrow(MirrorError);
        // Direct callers can pass junk the lossless parse never produces;
        // the typed error beats a silent NaN.
        expect(() => amountNumber("abc")).toThrow(MirrorError);
        // The exact boundary still narrows: MAX_SAFE_INTEGER is safe.
        expect(amountNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
            Number.MAX_SAFE_INTEGER,
        );
    });
});

describe("consensus timestamps", () => {
    it("converts a Date to seconds.nanoseconds", () => {
        expect(toConsensusTimestamp(new Date(1_700_000_000_000))).toBe(
            "1700000000.000000000",
        );
        // Sub-millisecond float input that rounds up to a whole second must
        // carry into seconds — not emit a 10-digit nanos field.
        expect(toConsensusTimestamp(999.9999999996)).toBe("1.000000000");
        expect(toConsensusTimestamp(1_700_000_000_123)).toBe(
            "1700000000.123000000",
        );
    });

    it("converts a consensus timestamp back to a Date", () => {
        expect(fromConsensusTimestamp("1700000000.123456789").getTime()).toBe(
            1_700_000_000_123,
        );
        // Missing nanos segment defaults to zero
        expect(fromConsensusTimestamp("1700000000").getTime()).toBe(
            1_700_000_000_000,
        );
    });

    it("round-trips at millisecond precision", () => {
        const ms = 1_712_345_678_901;
        expect(fromConsensusTimestamp(toConsensusTimestamp(ms)).getTime()).toBe(
            ms,
        );
    });
});

describe("timestampRange", () => {
    it("builds a half-open [gte, lt) window", () => {
        expect(
            timestampRange({
                from: 1_700_000_000_000,
                to: 1_700_086_400_000,
            }),
        ).toEqual({
            gte: "1700000000.000000000",
            lt: "1700086400.000000000",
        });
    });

    it("emits only the provided bounds", () => {
        expect(timestampRange({ from: 1_700_000_000_000 })).toEqual({
            gte: "1700000000.000000000",
        });
        expect(timestampRange({})).toEqual({});
    });
});
