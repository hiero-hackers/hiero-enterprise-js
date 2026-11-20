// SPDX-License-Identifier: Apache-2.0
// Runs what users install: packs enterprise-core and enterprise-mirror,
// installs the tarballs into throwaway ESM and CommonJS projects, runs a
// short script in each, and bundles enterprise-mirror for the browser.
//
//   node test/packed/run.mjs [pack] [consumers] [bundle]
//
// With no step names it runs all three. `pack` needs pnpm; `consumers` only
// needs node and npm, so it can run on any Node version once the tarballs
// exist. Work happens in $PACKED_WORK_DIR (default: <tmp>/hiero-packed),
// which is left behind on purpose: the consumers reuse the packed tarballs.
//
// The consumers submit a topic message when HIERO_OPERATOR_ID and the other
// HIERO_* variables point at a network (Solo in CI); without them they only
// build a HieroContext. Set PACKED_REQUIRE_NETWORK=1 to make that an error.
// The mirror query uses HIERO_MIRROR_NODE_URL, or the public mainnet mirror.

/* eslint-disable security/detect-non-literal-fs-filename -- every path is built from import.meta.url or PACKED_WORK_DIR, set by whoever runs the script */
import { execFileSync } from "node:child_process";
import {
    appendFileSync,
    copyFileSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const work = resolve(
    process.env.PACKED_WORK_DIR ?? join(tmpdir(), "hiero-packed"),
);
const tarballs = join(work, "tarballs");
const nodeMajor = process.versions.node.split(".")[0];

function run(command, args, cwd) {
    console.log(`$ ${command} ${args.join(" ")}  (in ${cwd})`);
    execFileSync(command, args, { cwd, stdio: "inherit" });
}

function tarball(name) {
    const file = readdirSync(tarballs).find(
        (f) =>
            f.startsWith(`hiero-hackers-enterprise-${name}-`) &&
            f.endsWith(".tgz"),
    );

    if (!file) {
        throw new Error(
            `No ${name} tarball in ${tarballs}; run the pack step first`,
        );
    }

    return join(tarballs, file);
}

// A fresh project with only the given tarballs installed from disk; their
// dependencies come from the npm registry, as they would for a user.
function project(name, type, packages) {
    const dir = join(work, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
            { name: `packed-${name}`, private: true, type },
            null,
            4,
        ),
    );
    run(
        "npm",
        [
            "install",
            "--no-audit",
            "--no-fund",
            "--no-package-lock",
            "--loglevel=error",
            ...packages.map(tarball),
            // core's peer dependency, installed as the README says
            ...(packages.includes("core") ? ["@hiero-ledger/sdk"] : []),
        ],
        dir,
    );

    return dir;
}

function pack() {
    rmSync(tarballs, { recursive: true, force: true });
    mkdirSync(tarballs, { recursive: true });
    for (const pkg of ["core", "mirror"]) {
        run(
            "pnpm",
            ["pack", "--pack-destination", tarballs],
            join(root, "packages", pkg),
        );
    }
}

function consumers() {
    for (const [type, fixture] of [
        ["module", "consumer.mjs"],
        ["commonjs", "consumer.cjs"],
    ]) {
        const dir = project(`node${nodeMajor}-${type}`, type, [
            "core",
            "mirror",
        ]);
        copyFileSync(join(here, fixture), join(dir, "index.js"));
        run(process.execPath, ["index.js"], dir);
    }
}

async function bundle() {
    // Only enterprise-mirror is installed: the bundle must not need core.
    const dir = project("browser", "module", ["mirror"]);
    copyFileSync(join(here, "browser.mjs"), join(dir, "entry.js"));
    const { build } = await import("esbuild");
    const outfile = join(dir, "bundle.js");
    await build({
        absWorkingDir: dir,
        entryPoints: ["entry.js"],
        outfile,
        bundle: true,
        minify: true,
        format: "esm",
        platform: "browser",
        target: "es2020",
        logLevel: "warning",
    });
    const bytes = readFileSync(outfile);
    const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;
    const size = kib(bytes.length);
    const gzip = kib(gzipSync(bytes).length);
    console.log(
        `enterprise-mirror browser bundle: ${size} minified, ${gzip} gzipped`,
    );

    if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(
            process.env.GITHUB_STEP_SUMMARY,
            [
                "### enterprise-mirror browser bundle",
                "",
                "| Minified | Gzipped |",
                "| --- | --- |",
                `| ${size} | ${gzip} |`,
                "",
            ].join("\n"),
        );
    }
}

const steps = new Map([
    ["pack", pack],
    ["consumers", consumers],
    ["bundle", bundle],
]);
const requested = process.argv.slice(2);
for (const name of requested.length ? requested : steps.keys()) {
    const step = steps.get(name);

    if (!step) {
        throw new Error(
            `Unknown step "${name}"; expected one of: ${[...steps.keys()].join(", ")}`,
        );
    }

    await step();
}
