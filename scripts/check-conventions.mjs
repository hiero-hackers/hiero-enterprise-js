/**
 * Mechanical enforcement of the repo's naming & structure conventions
 * (documented in CONTRIBUTING.md → "Naming & Structure Conventions").
 *
 *   node scripts/check-conventions.mjs
 *
 * Exits non-zero on any violation, so CI can gate on it. Checks:
 *   1. class-bearing src files are named after an exported class
 *   2. unit tests mirror src/ and are named after an implementation
 *      file (facet suffixes allowed; cross-cutting suites exempted)
 *   3. unit tests use .test.ts, integration tests use .spec.ts
 *   4. multi-file src directories carry an index.ts barrel
 *   5. sample packages follow <thing>-sample / hiero-<thing>-sample
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, relative } from "node:path";

const failures = [];
const fail = (msg) => failures.push(msg);

/** Cross-cutting unit suites that cover no single implementation file. */
const CROSS_CUTTING = new Set([
    "spec-coverage",
    "response-field-completeness",
    "field-drift",
    "security",
    "stress",
]);

function* walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) yield* walk(path);
        else yield path;
    }
}

const packages = readdirSync("packages").filter((p) =>
    existsSync(join("packages", p, "src")),
);

for (const pkg of packages) {
    const src = join("packages", pkg, "src");
    const unit = join("packages", pkg, "test", "unit");
    const integration = join("packages", pkg, "test", "integration");

    // 1 — class files named after an exported class
    for (const f of walk(src)) {
        if (!f.endsWith(".ts") || f.endsWith("index.ts")) continue;
        const code = readFileSync(f, "utf8");
        const classes = [
            ...code.matchAll(/^export (?:abstract )?class (\w+)/gm),
        ].map((m) => m[1]);
        const base = basename(f, ".ts");
        if (classes.length > 0 && !classes.includes(base)) {
            fail(
                `${f}: exports class(es) ${classes.join(", ")} but is named ${base}.ts`,
            );
        }
    }

    // 2 + 3 — unit tests: suffix, mirroring, naming
    for (const f of walk(unit)) {
        if (!f.endsWith(".ts")) continue;
        if (f.endsWith(".spec.ts")) {
            fail(`${f}: .spec.ts under test/unit — unit tests use .test.ts`);
            continue;
        }
        if (!f.endsWith(".test.ts")) continue; // helpers are fine
        const rel = relative(unit, f);
        const stem = rel.replace(/(\.[a-z0-9-]+)?\.test\.ts$/, "");
        if (CROSS_CUTTING.has(basename(stem))) continue;
        const impl = join(src, `${stem}.ts`);
        if (!existsSync(impl)) {
            fail(`${f}: no implementation at ${impl} (unit tests mirror src/)`);
        }
    }

    // 3 — integration tests use .spec.ts
    for (const f of walk(integration)) {
        if (f.endsWith(".test.ts")) {
            fail(
                `${f}: .test.ts under test/integration — integration tests use .spec.ts`,
            );
        }
    }

    // 4 — multi-file src directories carry a barrel
    const dirs = new Set(
        [...walk(src)].map((f) => join(f, "..")).filter((d) => d !== src),
    );
    for (const d of dirs) {
        const files = readdirSync(d).filter((f) => f.endsWith(".ts"));
        if (files.length > 1 && !files.includes("index.ts")) {
            fail(`${d}: ${files.length} modules but no index.ts barrel`);
        }
    }
}

// 5 — sample naming
for (const dir of readdirSync("samples")) {
    const pkgPath = join("samples", dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    if (dir === "examples") continue; // the script gallery, not a sample app
    const { name, version } = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (!dir.endsWith("-sample")) {
        fail(`samples/${dir}: directory should end in -sample`);
    }
    if (!/^hiero-[a-z-]+-sample$/.test(name ?? "")) {
        fail(
            `samples/${dir}: package name "${name}" should match hiero-<thing>-sample`,
        );
    }
    if (version !== "1.0.0") {
        fail(`samples/${dir}: version ${version} — samples pin 1.0.0`);
    }
}

if (failures.length > 0) {
    console.error(`conventions: ${failures.length} violation(s)\n`);
    for (const f of failures) console.error("  ✗ " + f);
    process.exit(1);
}
console.log("conventions: all checks pass");
