import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { SPEC_COVERAGE } from "../spec/coverage-manifest.js";

/**
 * Drift tripwire: diffs the coverage manifest against the vendored
 * OpenAPI spec in both directions. When the snapshot in
 * `spec/openapi.yml` is refreshed and upstream has added (or removed)
 * operations or query parameters, these tests fail with a named list —
 * coverage must then be consciously extended or the omission documented.
 */

interface SpecParameter {
    name: string;
    in: string;
}

interface SpecOperation {
    parameters?: Array<{ $ref?: string } & Partial<SpecParameter>>;
}

const readSource = (path: string) =>
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant paths derived from import.meta.url, no user input
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const spec = parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
    readFileSync(
        fileURLToPath(new URL("../../spec/openapi.yml", import.meta.url)),
        "utf8",
    ),
) as {
    paths: Record<string, Record<string, SpecOperation>>;
    components: {
        parameters: Record<string, SpecParameter>;
        schemas: { TransactionTypes: { enum: string[] } };
    };
};

/** `"GET /api/v1/accounts"` → its spec-defined query param names. */
function specOperations(): Map<string, string[]> {
    const operations = new Map<string, string[]>();
    for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
            const params = (operation.parameters ?? [])
                .map((parameter) =>
                    parameter.$ref
                        ? spec.components.parameters[
                              parameter.$ref.split("/").pop() as string
                          ]
                        : (parameter as SpecParameter),
                )
                .filter((parameter) => parameter?.in !== "path")
                .map((parameter) => parameter.name);
            operations.set(`${method.toUpperCase()} ${path}`, params.sort());
        }
    }
    return operations;
}

describe("spec coverage manifest", () => {
    const operations = specOperations();

    it("covers every operation in the vendored spec", () => {
        const uncovered = [...operations.keys()].filter(
            (operation) => !(operation in SPEC_COVERAGE),
        );
        expect(uncovered, "spec operations missing from manifest").toEqual([]);
    });

    it("lists no operations that the spec no longer defines", () => {
        const stale = Object.keys(SPEC_COVERAGE).filter(
            (operation) => !operations.has(operation),
        );
        expect(stale, "manifest operations absent from spec").toEqual([]);
    });

    it("accounts for every query parameter of every operation", () => {
        const mismatches: string[] = [];
        for (const [operation, specParams] of operations) {
            const entry =
                SPEC_COVERAGE[operation as keyof typeof SPEC_COVERAGE];
            if (!entry) continue; // reported by the first test
            const covered = new Set(entry.covered);
            const omitted = new Set(entry.omitted ?? []);
            for (const name of specParams) {
                if (!covered.has(name) && !omitted.has(name)) {
                    mismatches.push(
                        `${operation}: spec param "${name}" is neither covered nor omitted`,
                    );
                }
            }
            for (const name of [...covered, ...omitted]) {
                if (!specParams.includes(name)) {
                    mismatches.push(
                        `${operation}: manifest param "${name}" no longer in spec`,
                    );
                }
            }
            for (const name of covered) {
                if (omitted.has(name)) {
                    mismatches.push(
                        `${operation}: "${name}" is both covered and omitted`,
                    );
                }
            }
        }
        expect(mismatches).toEqual([]);
    });
});

describe("TransactionType", () => {
    it("lists exactly the spec's TransactionTypes enum", () => {
        const union = readSource("../../src/types/transaction.ts").match(
            /export type TransactionType =([^;]*);/,
        )?.[1];
        const members = [...(union ?? "").matchAll(/"([A-Z_]+)"/g)].map(
            (match) => match[1],
        );
        expect(members.sort()).toEqual(
            [...spec.components.schemas.TransactionTypes.enum].sort(),
        );
    });
});
