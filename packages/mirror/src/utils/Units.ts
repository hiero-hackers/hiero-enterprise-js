import type { MirrorAmount, TimestampRange } from "../types/index.js";
import {
    MirrorError,
    MirrorErrorCodes,
    describeValue,
} from "../errors/MirrorError.js";

/**
 * Unit and timestamp conversion helpers for mirror node data.
 *
 * The mirror node reports HBAR in tinybars, token amounts in each token's
 * smallest unit, and times as `seconds.nanoseconds` consensus timestamps.
 * These pure helpers convert to and from display-friendly values so
 * consumers stop hand-rolling `/ 100_000_000` and `10 ** decimals` math.
 *
 * Precision: the two *builder* helpers (`hbarToTinybar`, `parseUnits`)
 * return exact decimal strings computed by scaling the decimal text, so
 * they are digit-exact at any magnitude — their outputs feed query
 * thresholds and comparisons against the (string) amount fields. The two
 * *display* helpers (`tinybarToHbar`, `formatUnits`) return `number` and
 * are approximate above 2^53 smallest units (relative error ~1e-16) —
 * fine for rendering, not for arithmetic on whale-sized amounts.
 */

/** Tinybars per HBAR. */
export const TINYBAR_PER_HBAR = 100_000_000;

/**
 * Upper bound on an amount's *integer* digits (and on `decimals`) — the
 * two inputs that size the BigInt work. Real amounts are protocol-bounded
 * (a u64 total supply is 20 digits), so the cap is generous; without it,
 * untrusted input could mint arbitrarily large BigInts (a DoS vector for
 * callers that scale user-supplied amounts). Fractional length is
 * deliberately unbounded: long fractions cost only a linear scan and
 * round away.
 */
const MAX_AMOUNT_DIGITS = 100;

/**
 * Bound on the scientific-notation exponents {@link expandExponent} will
 * expand — expansion allocates ~|exponent| characters, so this exists
 * only to stop pathological `repeat()`s. `String(number)` never exceeds
 * ±324, so every real double fits well inside it.
 */
const MAX_EXPANSION_EXPONENT = 1000;

/** HBAR's decimal places: 10^HBAR_DECIMALS === TINYBAR_PER_HBAR. */
const HBAR_DECIMALS = 8;

/**
 * Rewrite scientific notation (`"2.5e19"`, `String(1e-7)`) as plain decimal
 * text. Plain input passes through untouched.
 */
function expandExponent(text: string): string {
    // eslint-disable-next-line security/detect-unsafe-regex -- anchored, no nested quantifiers: linear on any input
    const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
    if (!match) return text;
    const [, sign, int, frac = "", expText] = match;
    // One allocation bound, both directions: expansion allocates ~|exp|
    // chars, so this only needs to stop pathological `repeat()`s. Values
    // the bound admits are still judged by scaleDecimal — oversized
    // integer parts hit the digit cap's clear error, tiny fractions round
    // to "0" (5e-324, a legitimate float underflow, must not be rejected).
    // Past the bound, return unexpanded and let the decimal validation
    // produce the typed error.
    if (Math.abs(Number(expText)) > MAX_EXPANSION_EXPONENT) return text;
    const digits = int + frac;
    // Position of the decimal point within `digits` after applying the
    // exponent: right of `int`, shifted by the exponent.
    const point = int.length + Number(expText);
    if (point <= 0) {
        return `${sign}0.${"0".repeat(-point)}${digits}`;
    }
    if (point >= digits.length) {
        return `${sign}${digits}${"0".repeat(point - digits.length)}`;
    }
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * Scale a decimal value by 10^decimals into an exact integer string —
 * the decimal point moves through the *text*, so no digit ever passes
 * through IEEE-754 arithmetic. Rounds half away from zero when the input
 * has more fractional digits than `decimals`.
 */
function assertDecimals(decimals: number): void {
    if (
        !Number.isInteger(decimals) ||
        decimals < 0 ||
        decimals > MAX_AMOUNT_DIGITS
    ) {
        throw new MirrorError(
            `decimals must be an integer between 0 and ${MAX_AMOUNT_DIGITS}, got ${decimals}.`,
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
}

function scaleDecimal(value: number | string, decimals: number): string {
    assertDecimals(decimals);
    const text = expandExponent(
        typeof value === "number" ? String(value) : value.trim(),
    );
    // eslint-disable-next-line security/detect-unsafe-regex -- anchored, no nested quantifiers: linear on any input
    const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text);
    if (!match) {
        throw new MirrorError(
            `expected a decimal amount, got ${describeValue(value)}.`,
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
    const [, sign, int, frac = ""] = match;
    // Cap the *integer* digits — they are what feeds BigInt (the fraction
    // contributes at most `decimals` digits, itself capped). Fractional
    // length stays unbounded on purpose: "0.000…0001" with any number of
    // zeros is a legitimate tiny value that simply rounds to "0", at
    // linear-scan cost only.
    if (int.length > MAX_AMOUNT_DIGITS) {
        throw new MirrorError(
            `amount has ${int.length} integer digits — more than the ${MAX_AMOUNT_DIGITS} any real amount needs.`,
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
    const kept = int + frac.slice(0, decimals).padEnd(decimals, "0");
    let scaled = BigInt(kept);
    // Round half away from zero on the first dropped digit.
    if (frac.length > decimals && frac.charAt(decimals) >= "5") {
        scaled += 1n;
    }
    return scaled === 0n ? "0" : `${sign}${scaled}`;
}

/**
 * Convert tinybars (number or raw mirror-node string) to HBAR, for display.
 * Approximate above 2^53 tinybars (~90.07M ℏ) — see the module note.
 */
export function tinybarToHbar(tinybar: number | string): number {
    return Number(tinybar) / TINYBAR_PER_HBAR;
}

/**
 * Convert HBAR to tinybars as an exact decimal string — e.g.
 * `hbarToTinybar("2.5")` → `"250000000"`. Digit-exact at any magnitude
 * (pass the amount as a string to avoid float artifacts in the input
 * itself); rounds half away from zero below one tinybar. Integer parts
 * beyond 100 digits are rejected with a typed `MirrorError` — no real
 * amount needs them, and unbounded input is a DoS vector. (Tiny values
 * with long fractions are fine; they round to `"0"`.)
 */
export function hbarToTinybar(hbar: number | string): string {
    return scaleDecimal(hbar, HBAR_DECIMALS);
}

/**
 * Convert a raw token amount (in the token's smallest unit) to its display
 * value using the token's `decimals` — e.g. `formatUnits("2500000", 6)`
 * → `2.5` USDC. Approximate above 2^53 smallest units — see the module note.
 * `decimals` obeys the same 0–100 integer contract as every other helper
 * here — out-of-range values throw the typed error instead of silently
 * producing `Infinity` (via `10 ** decimals`) or a misscaled figure.
 */
export function formatUnits(amount: number | string, decimals: number): number {
    assertDecimals(decimals);
    return Number(amount) / 10 ** decimals;
}

/**
 * Convert a raw token amount to its display value as an exact decimal
 * string — the digit-exact counterpart of {@link formatUnits}, for the
 * whale-sized values whose exactness the lossless parse preserved:
 * `formatUnitsExact("31869085891081369", 8)` → `"318690858.91081369"`.
 *
 * The decimal point moves through the *text* (the inverse of the builders'
 * scaling), so no digit ever passes through IEEE-754 arithmetic —
 * `parseUnits(formatUnitsExact(x, d), d)` returns `x` unchanged. The
 * amount must be a whole number of smallest units (what the mirror node
 * sends); fractional input is rejected with a typed `MirrorError`, as are
 * integer parts beyond 100 digits.
 */
export function formatUnitsExact(
    amount: number | string,
    decimals: number,
): string {
    assertDecimals(decimals);
    const text = expandExponent(
        typeof amount === "number" ? String(amount) : amount.trim(),
    );
    const match = /^(-?)(\d+)$/.exec(text);
    if (!match) {
        throw new MirrorError(
            `expected a whole amount in smallest units, got ${describeValue(amount)}.`,
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
    const [, sign, rawDigits] = match;
    if (rawDigits.length > MAX_AMOUNT_DIGITS) {
        throw new MirrorError(
            `amount has ${rawDigits.length} digits — more than the ${MAX_AMOUNT_DIGITS} any real amount needs.`,
            { code: MirrorErrorCodes.ConfigInvalid },
        );
    }
    // All-zero digits normalise to "0", never "-0" — same as scaleDecimal.
    if (!/[1-9]/.test(rawDigits)) return "0";
    // Canonicalise before splitting: leading zeros in the input would
    // otherwise survive into the output ("0001" @ 0 → "0001") and break
    // the parseUnits round-trip, which re-emits canonical digits.
    const digits = rawDigits.replace(/^0+/, "");
    const padded = digits.padStart(decimals + 1, "0");
    const int = padded.slice(0, padded.length - decimals);
    const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
    return frac === "" ? `${sign}${int}` : `${sign}${int}.${frac}`;
}

/**
 * Convert tinybars to HBAR as an exact decimal string — the digit-exact
 * counterpart of {@link tinybarToHbar}, for balances past 2^53 tinybars
 * where the `number` helper starts rounding. See {@link formatUnitsExact}.
 */
export function tinybarToHbarExact(tinybar: number | string): string {
    return formatUnitsExact(tinybar, HBAR_DECIMALS);
}

/**
 * The only shapes a lossless-parsed amount can legitimately take:
 * a digit-only (optionally signed) string — exactly what the quoter
 * emits — or a number the parse provably did NOT round. A number is
 * provably exact only when it is a safe integer: the quoter protects
 * bare integer literals, so an amount arriving as a non-integer or as a
 * number at/past 2^53 means either a form the quoter cannot protect
 * (fraction/exponent notation, already rounded at JSON.parse) or a
 * direct caller's malformed input. Both normalisers reject those with a
 * typed error — they exist to end silent precision loss and must never
 * pass along a value whose exactness cannot be proven.
 */
const AMOUNT_DIGITS = /^-?\d+$/;

function assertAmountArms(value: number | string): void {
    const valid =
        typeof value === "string"
            ? AMOUNT_DIGITS.test(value)
            : Number.isSafeInteger(value);
    if (!valid) {
        throw new MirrorError(
            `expected a whole amount (digit string, or integer within ±(2^53−1)), got ${describeValue(value)}.`,
            { code: MirrorErrorCodes.MirrorNodeSchemaMismatch },
        );
    }
}

/**
 * Normalise a wire amount to the public `string` representation.
 *
 * After the lossless parse (`utils/LosslessJson.ts`) a tinybar or token
 * amount arrives as a `number` when it was left unquoted and as a decimal
 * `string` when the parse quoted it to preserve precision (all bare
 * integers of 16+ digits — a conservative bound, since 2^53 is 16 digits).
 * Both arms stringify digit-exact, and both arms are *validated*: a
 * non-integer or unsafe number, or a non-digit string, throws a typed
 * `MirrorError` rather than smuggling `"1.5"`, `"NaN"`, or a
 * silently-rounded double into the "decimal string" contract.
 * `null`/`undefined` pass through so optional fields keep their absence
 * semantics.
 *
 * Exported for consumers of the raw `client.get<T>()` escape hatch, whose
 * bodies obey the same quoting contract the typed converters normalise
 * through this function — `amountString(row.balance)` is the supported
 * way to fold the `MirrorAmount` union without re-deriving the contract.
 *
 * The four signatures are TypeScript *overloads* over the single
 * implementation below — they propagate each call site's exact nullability
 * (required in → `string` out; optional in → `string | undefined` out), so
 * no call site needs a cast.
 */
export function amountString(value: MirrorAmount): string;
export function amountString(
    value: MirrorAmount | undefined,
): string | undefined;
export function amountString(value: MirrorAmount | null): string | null;
export function amountString(
    value: MirrorAmount | null | undefined,
): string | null | undefined;
export function amountString(
    value: MirrorAmount | null | undefined,
): string | null | undefined {
    if (value == null) return value;
    assertAmountArms(value);
    return typeof value === "string" ? value : String(value);
}

/**
 * Narrow a wire amount to `number`, for protocol-bounded fields (gas,
 * block totals) that stay `number` in the public API. The lossless parse
 * quotes on digit count, not meaning, so these arrive as strings once a
 * value reaches 16 digits. Quoted values up to 2^53−1 (≈9.007e15)
 * convert back exactly — which covers everything these fields can
 * plausibly hold (network gas throttles cap real gas orders of
 * magnitude lower). A 16-digit value *above* 2^53 would round, so it is
 * refused instead — see below.
 *
 * That plausibility argument is *enforced* on BOTH arms, not assumed: a
 * digit string that does not narrow to a safe integer, a non-digit
 * string, or a number that is fractional, non-finite, or at/past 2^53
 * throws a typed `MirrorError` instead of silently rounding (or passing
 * a `NaN`/`1.5` along) — this helper exists to end silent precision
 * loss, so it must never be a new source of it. Hitting the error on an
 * oversized value means the field is not protocol-bounded after all:
 * keep it as a string via {@link amountString}.
 */
export function amountNumber(value: MirrorAmount): number;
export function amountNumber(
    value: MirrorAmount | undefined,
): number | undefined;
export function amountNumber(value: MirrorAmount | null): number | null;
export function amountNumber(
    value: MirrorAmount | null | undefined,
): number | null | undefined;
export function amountNumber(
    value: MirrorAmount | null | undefined,
): number | null | undefined {
    if (value == null) return value;
    assertAmountArms(value);
    if (typeof value !== "string") return value;
    const narrowed = Number(value);
    // Digit-valid but too many digits to survive the trip back to a
    // double — the one arm-valid case that would still round.
    if (!Number.isSafeInteger(narrowed)) {
        throw new MirrorError(
            `amount ${describeValue(value)} does not fit a safe integer — ` +
                `a protocol-bounded field can never carry it; keep it as a ` +
                `string (amountString).`,
            { code: MirrorErrorCodes.MirrorNodeSchemaMismatch },
        );
    }
    return narrowed;
}

/**
 * Convert a display value to the token's smallest unit as an exact decimal
 * string — e.g. `parseUnits("2.5", 6)` → `"2500000"`, and
 * `parseUnits(2, 18)` → `"2000000000000000000"` (a value `number` math
 * cannot represent). Rounds half away from zero beyond `decimals`.
 * Integer parts and `decimals` beyond 100 digits are rejected with a
 * typed `MirrorError` — no real amount needs them, and unbounded input
 * is a DoS vector. (Tiny values with long fractions are fine; they round
 * to `"0"`.)
 */
export function parseUnits(amount: number | string, decimals: number): string {
    return scaleDecimal(amount, decimals);
}

/**
 * The canonical consensus-timestamp text — `"seconds.nnnnnnnnn"`, always
 * nine nanosecond digits. The one place this format is written; everything
 * that produces a timestamp string goes through it.
 *
 * Caller contract: `nanos` must already be in `[0, 1e9)` — this formats,
 * it does not carry or clamp (see `toConsensusTimestamp` and the
 * converters' `nanosToTimestamp` for the two normalisations).
 */
export function formatConsensusTimestamp(
    seconds: number | bigint,
    nanos: number | bigint,
): string {
    return `${seconds}.${String(nanos).padStart(9, "0")}`;
}

/**
 * Convert a `Date` (or Unix epoch milliseconds) to a mirror node consensus
 * timestamp string — `"seconds.nanoseconds"` with nine nanosecond digits.
 */
export function toConsensusTimestamp(when: Date | number): string {
    const ms = when instanceof Date ? when.getTime() : when;
    let seconds = Math.floor(ms / 1000);
    let nanos = Math.round((ms - seconds * 1000) * 1_000_000);
    // Math.round can land exactly on a whole second (e.g. 999.9999999996ms
    // of sub-millisecond float input) — carry it, or the nanos field grows
    // a tenth digit and the timestamp parses as ~1/10th of its value.
    if (nanos === 1_000_000_000) {
        seconds += 1;
        nanos = 0;
    }
    return formatConsensusTimestamp(seconds, nanos);
}

/**
 * Convert a mirror node consensus timestamp (`"seconds.nanoseconds"`) to a
 * `Date`. Sub-millisecond precision is truncated.
 */
export function fromConsensusTimestamp(timestamp: string): Date {
    const [seconds, nanos = "0"] = timestamp.split(".");
    const ms =
        Number(seconds) * 1000 +
        Math.floor(Number(nanos.padEnd(9, "0")) / 1_000_000);
    return new Date(ms);
}

/**
 * Build a half-open consensus-timestamp window `[from, to)` from `Date`s or
 * epoch milliseconds — the ergonomic way to express time-series buckets:
 *
 * @example
 * repo.find({
 *   transactionType: "CRYPTOTRANSFER",
 *   timestamp: timestampRange({ from: dayStart, to: dayEnd }),
 * });
 */
export function timestampRange(window: {
    from?: Date | number;
    to?: Date | number;
}): TimestampRange {
    return {
        ...(window.from !== undefined && {
            gte: toConsensusTimestamp(window.from),
        }),
        ...(window.to !== undefined && {
            lt: toConsensusTimestamp(window.to),
        }),
    };
}
