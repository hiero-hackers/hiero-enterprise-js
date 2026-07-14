import { expect } from "vitest";

/**
 * Shared helper for the field-drift completeness guard (WS5). Rationale and the
 * fixtures live in `test/unit/field-drift.test.ts`.
 *
 * The guard feeds a converter a maximal fixture (typed `Required<RawType>`,
 * which forces every **top-level** wire field to be present — a newly-added
 * top-level field won't compile until the fixture grows) whose every leaf is a
 * unique sentinel, then asserts every sentinel survives into the converted
 * output. A dropped field = a missing sentinel = a failing test.
 *
 * Caveat: `Required<T>` is shallow, so a newly-added *nested* optional field is
 * not auto-forced — nested completeness relies on the fixture author populating
 * nested objects/arrays, which the value-diff then checks. Populate them fully.
 */

/** Every primitive leaf in an object graph, stringified, collected into a set. */
export function leafValues(v: unknown, out = new Set<string>()): Set<string> {
    if (v === null || v === undefined) return out;
    if (Array.isArray(v)) {
        for (const x of v) leafValues(x, out);
    } else if (typeof v === "object") {
        for (const x of Object.values(v)) leafValues(x, out);
    } else {
        out.add(String(v));
    }
    return out;
}

/**
 * Assert the converter carried every wire leaf into its output. `known` maps
 * each raw leaf that legitimately does NOT appear verbatim to the reason why
 * (a value transform, or a documented not-yet-carried gap). A raw leaf that is
 * neither in the output nor in `known` is a silent drop → failure.
 *
 * Note: booleans (`true`/`false`) and other low-cardinality values can collide,
 * so a dropped boolean field may be masked by another; the per-converter unit
 * tests cover those. This guard's job is the high-cardinality identifiers,
 * timestamps, keys, and hashes where drift actually hides.
 */
export function assertNoSilentDrops(
    raw: object,
    converted: object,
    known: Record<string, string> = {},
): void {
    const out = leafValues(converted);
    const dropped = [...leafValues(raw)].filter(
        (val) => !out.has(val) && !(val in known),
    );
    expect(dropped, "wire fields dropped without a documented reason").toEqual(
        [],
    );
}
