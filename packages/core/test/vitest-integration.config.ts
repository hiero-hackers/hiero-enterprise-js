import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/integration/**/*.ts"],
        testTimeout: 60000,
        hookTimeout: 60000,
        environment: "node",
        setupFiles: ["test/utils/SetupEnv.ts"],
        coverage: {
            provider: "v8",
            // `json-summary` is required by the vitest-coverage-report
            // GitHub Action; `json` powers its per-file table. `lcov` is
            // kept for local tools and `text-summary` for the terminal.
            reporter: ["text-summary", "json-summary", "json", "lcov"],
            // Emit reports even when tests fail so the PR comment still
            // has data to render.
            reportOnFailure: true,
            reportsDirectory: "./coverage/integration",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/**/*.d.ts", "src/types/**"],
        },
    },
});
