/**
 * Precision-preserving JSON parse for mirror node responses.
 *
 * `JSON.parse` reads every number as an IEEE-754 double, so an integer above
 * `Number.MAX_SAFE_INTEGER` (2^53−1 = 9,007,199,254,740,991 — ~90.07M ℏ in
 * tinybars) is silently rounded to the nearest representable double *before*
 * any converter runs. Live mainnet balances exceed this today (see #136:
 * 7 of the 10 largest accounts parse wrong), and token amounts with high
 * decimals exceed it routinely.
 *
 * The mirror node itself is inconsistent about the risk: `/network/supply`
 * quotes its 19-digit values as JSON strings, while `/accounts/{id}` sends
 * `balance` as a bare number. Until upstream quotes them uniformly, the only
 * lossless option is to intervene on the raw text — a `JSON.parse` reviver
 * is too late (it receives the already-rounded double).
 *
 * {@link parseLossless} therefore quotes every bare integer of
 * {@link QUOTE_DIGITS}+ digits before parsing, turning would-be doubles into
 * exact strings. Fields that can carry such values are typed
 * `number | string` on the wire and normalised to `string` by the
 * converters; small values stay ordinary numbers and nothing else in the
 * payload changes shape.
 *
 * Dependency-free by design — this package runs in browsers (the explorer)
 * and uses only isomorphic globals, which rules out `json-bigint`; and the
 * `JSON.parse` source-access reviver (`context.source`) is not yet available
 * across the runtimes this package supports.
 */

/**
 * Quote threshold, in digits. 2^53 is 16 digits, so 15-digit integers are
 * always exact and 16-digit ones may not be. Quoting *all* 16+-digit
 * integers over-quotes some exactly-representable values. For amount
 * fields that is free (they are normalised to strings anyway); for
 * counter-classified fields (serial numbers, sequence numbers) a quoted
 * value surfaces as a typed schema error — deliberately loud, because a
 * 16-digit counter would mean a broken upstream, not a real counter.
 *
 * Exported because it IS the quoting contract: consumers that need to
 * recognise "a string this parser produced" (e.g. the token-expiry
 * normaliser) derive their checks from this constant rather than
 * re-encoding the number 16.
 */
export const QUOTE_DIGITS = 16;

/**
 * The exact shape of every string {@link quoteLargeIntegers} can emit:
 * optionally signed, {@link QUOTE_DIGITS}+ digits, first digit nonzero.
 * The leading digit matters — the quoter refuses leading-zero tokens
 * (they are invalid JSON, left bare so `JSON.parse` rejects them), so a
 * recogniser that accepted them would treat strings the quoter cannot
 * produce as parse products.
 *
 * This lives HERE, beside the quoter, as the single source of truth:
 * consumers (the token-expiry normaliser) import it rather than
 * re-deriving the shape — a re-derived copy is exactly how recogniser
 * and quoter drift apart when one of them changes.
 */
export const QUOTED_INTEGER = new RegExp(`^-?[1-9]\\d{${QUOTE_DIGITS - 1},}$`);

/**
 * Wrap every bare integer literal of {@link QUOTE_DIGITS}+ digits in quotes.
 *
 * A character scan rather than a regex so that digits inside string values
 * (`"memo": "ref: 99999999999999999"`) are never touched: strings are
 * skipped wholesale, escapes included. Only plain integers qualify —
 * anything with a fraction or exponent is left alone (mirror node
 * timestamps are already strings; genuine doubles stay doubles).
 *
 * Cost model: the scan never copies until it finds something to quote, and
 * most payloads contain no 16-digit integers — the common case returns the
 * input string itself, allocation-free. When quoting does happen, untouched
 * spans are collected as slices and joined once, so the slow path is a
 * single linear pass too.
 */
export function quoteLargeIntegers(text: string): string {
    /** Output segments; stays `null` until the first quote is inserted. */
    let chunks: string[] | null = null;
    /** Everything before this index has been pushed onto `chunks`. */
    let copied = 0;
    let i = 0;
    const n = text.length;

    while (i < n) {
        const ch = text.charAt(i);

        if (ch === '"') {
            // Skip the whole string literal, honouring \" escapes.
            i++;
            while (i < n) {
                if (text.charAt(i) === "\\") i += 2;
                else if (text.charAt(i) === '"') {
                    i++;
                    break;
                } else i++;
            }
            continue;
        }

        if (ch === "-" || (ch >= "0" && ch <= "9")) {
            const start = i;
            if (ch === "-") i++;
            const digitsStart = i;
            while (i < n && text.charAt(i) >= "0" && text.charAt(i) <= "9") i++;
            const digits = i - digitsStart;
            const isPlainInteger =
                i >= n ||
                (text.charAt(i) !== "." &&
                    text.charAt(i) !== "e" &&
                    text.charAt(i) !== "E");
            // A leading zero on a multi-digit token is INVALID JSON —
            // quoting it would launder a malformed payload into a valid
            // string. Left unquoted, JSON.parse rejects it and the
            // client surfaces its typed malformed-body error. (Every
            // 16+-digit token has >1 digit, so plain `0` is unaffected.)
            const canonical = text.charAt(digitsStart) !== "0";
            if (isPlainInteger && canonical && digits >= QUOTE_DIGITS) {
                chunks ??= [];
                chunks.push(
                    text.slice(copied, start),
                    '"',
                    text.slice(start, i),
                    '"',
                );
                copied = i;
            } else if (!isPlainInteger) {
                // Skip the rest of the number token (fraction/exponent) so
                // its digits are never re-scanned as a fresh integer — a
                // 16-digit fraction must not be quoted.
                while (
                    i < n &&
                    (text.charAt(i) === "." ||
                        text.charAt(i) === "e" ||
                        text.charAt(i) === "E" ||
                        text.charAt(i) === "+" ||
                        text.charAt(i) === "-" ||
                        (text.charAt(i) >= "0" && text.charAt(i) <= "9"))
                ) {
                    i++;
                }
            }
            continue;
        }

        i++;
    }

    if (chunks === null) return text;
    chunks.push(text.slice(copied));
    return chunks.join("");
}

/**
 * `JSON.parse`, except integers too large for an IEEE-754 double arrive as
 * exact strings instead of rounded numbers. See the module doc for why.
 */
export function parseLossless(text: string): unknown {
    return JSON.parse(quoteLargeIntegers(text)) as unknown;
}
