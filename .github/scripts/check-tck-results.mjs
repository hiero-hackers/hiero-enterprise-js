// Compares the TCK's mochawesome report with tck/known-differences.json.
// Fails on a failure that isn't listed, and on a listed test that didn't
// fail, so the list stays accurate. Usage:
//   node .github/scripts/check-tck-results.mjs <mochawesome.json> <known-differences.json>
/* eslint-disable security/detect-non-literal-fs-filename -- paths come from the workflow: the report, the list and GITHUB_STEP_SUMMARY */
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [reportPath, listPath] = process.argv.slice(2);

if (!reportPath || !existsSync(reportPath)) {
    console.error(
        `No TCK report at "${reportPath ?? ""}": the TCK didn't finish.`,
    );
    process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const known = JSON.parse(readFileSync(listPath, "utf8"));

const tests = [];
const walk = (suite) => {
    tests.push(...(suite.tests ?? []));
    (suite.suites ?? []).forEach(walk);
};
report.results.forEach(walk);

const listed = new Set(known.map((entry) => entry.test));
const failed = tests
    .filter((t) => t.state === "failed")
    .map((t) => t.fullTitle);
const unexpected = failed.filter((title) => !listed.has(title));
const stale = [...listed].filter((title) => !failed.includes(title));

const lines = [`### Known differences`, ""];

if (unexpected.length > 0) {
    lines.push(
        `Failed but not in \`tck/known-differences.json\` (${unexpected.length}):`,
        "",
    );
    lines.push(...unexpected.map((title) => `- ${title}`), "");
}

if (stale.length > 0) {
    lines.push(
        `Listed in \`tck/known-differences.json\` but didn't fail (${stale.length}); remove them:`,
        "",
    );
    lines.push(...stale.map((title) => `- ${title}`), "");
}

if (unexpected.length === 0 && stale.length === 0) {
    lines.push(`All ${failed.length} failures are known differences.`);
}

const summary = lines.join("\n");
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

process.exit(unexpected.length > 0 || stale.length > 0 ? 1 : 0);
