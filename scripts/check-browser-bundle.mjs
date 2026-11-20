/**
 * Bundle the built core and mirror packages for browsers and React Native,
 * and fail if they pull in a Node built-in (`node:*`, `fs`, `crypto`, ...).
 *
 *   node scripts/check-browser-bundle.mjs     (after `pnpm run build`)
 *
 * With `platform: "browser"`, esbuild cannot resolve Node built-ins, so the
 * bundle fails on them. Free globals such as `Buffer` and `process` don't
 * fail a bundle; ESLint's `no-restricted-globals` catches those.
 * `@hiero-ledger/sdk` stays external: an app's bundler resolves its
 * per-platform entry.
 */
import { build } from "esbuild";

const packages = [
    "@hiero-hackers/enterprise-core",
    "@hiero-hackers/enterprise-mirror",
];

const targets = [
    { name: "browser", conditions: ["browser"] },
    { name: "react-native", conditions: ["react-native"] },
];

let failed = false;

for (const pkg of packages) {
    for (const target of targets) {
        try {
            await build({
                stdin: {
                    contents: `export * from "${pkg}";`,
                    resolveDir: import.meta.dirname,
                },
                bundle: true,
                write: false,
                logLevel: "silent",
                platform: "browser",
                format: "esm",
                conditions: target.conditions,
                external: ["@hiero-ledger/sdk"],
            });
            console.log(`ok    ${pkg} (${target.name})`);
        } catch (error) {
            failed = true;
            console.error(`FAIL  ${pkg} (${target.name})`);
            for (const { text, location } of error.errors ?? []) {
                console.error(`  ${location?.file ?? ""}: ${text}`);
            }
        }
    }
}

if (failed) {
    process.exit(1);
}
