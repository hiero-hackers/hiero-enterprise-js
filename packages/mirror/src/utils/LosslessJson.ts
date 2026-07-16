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
 * integers over-quotes some exactly-representable values, which is harmless:
 * the affected fields are normalised to strings anyway.
 */
const QUOTE_DIGITS = 16;

/**
 * Wrap every bare integer literal of {@link QUOTE_DIGITS}+ digits in quotes.
 *
 * A character scan rather than a regex so that digits inside string values
 * (`"memo": "ref: 99999999999999999"`) are never touched: strings are
 * skipped wholesale, escapes included. Only plain integers qualify —
 * anything with a fraction or exponent is left alone (mirror node
 * timestamps are already strings; genuine doubles stay doubles).
 */
export function quoteLargeIntegers(text: string): string {
    let out = "";
    let i = 0;
    const n = text.length;

    while (i < n) {
        const ch = text.charAt(i);

        if (ch === '"') {
            // Copy the whole string literal, honouring \" escapes.
            const start = i;
            i++;
            while (i < n) {
                if (text.charAt(i) === "\\") i += 2;
                else if (text.charAt(i) === '"') {
                    i++;
                    break;
                } else i++;
            }
            out += text.slice(start, i);
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
            if (isPlainInteger && digits >= QUOTE_DIGITS) {
                out += `"${text.slice(start, i)}"`;
            } else {
                // Not a candidate: copy the full number token (including any
                // fraction/exponent) unchanged.
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
                out += text.slice(start, i);
            }
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}

/**
 * `JSON.parse`, except integers too large for an IEEE-754 double arrive as
 * exact strings instead of rounded numbers. See the module doc for why.
 */
export function parseLossless(text: string): unknown {
    return JSON.parse(quoteLargeIntegers(text)) as unknown;
}
