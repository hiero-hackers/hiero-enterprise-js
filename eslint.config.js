import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import security from "eslint-plugin-security";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig(
    globalIgnores(["**/dist/**", "**/node_modules/**"]),

    ...tseslint.configs.recommended,
    eslint.configs.recommended,
    security.configs.recommended,
    prettierConfig,

    // Node.js globals (process, console, Buffer, fetch, etc.)
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },

    //  Prettier plugin (reports formatting as errors)
    {
        plugins: { prettier: prettierPlugin },
        rules: {
            "prettier/prettier": "error",
        },
    },

    // Project-specific rules (TypeScript-specific rules that require type information)
    {
        files: ["**/*.{js,ts}"],
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.eslint.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Warn if deprecated functions are used
            "@typescript-eslint/no-deprecated": "error",
            // Require await in async functions
            "require-await": "off",
            "@typescript-eslint/require-await": "error",
        },
    },
    {
        files: ["**/*.{js,ts}"],
        rules: {
            // Disable base rule in favour of TypeScript-aware version
            // (the base rule misreads TS function overloads as redeclarations)
            "no-redeclare": "off",
            "@typescript-eslint/no-redeclare": "error",
            "no-unused-vars": "off",
            // Allow unused vars when prefixed with _
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],

            // Allow explicit `any` in specific patterns (options objects, SDK interop)
            "@typescript-eslint/no-explicit-any": "error",

            // Allow non-null assertions (common pattern with SDK receipts)
            "@typescript-eslint/no-non-null-assertion": "off",

            // Allow empty interfaces / object types (used for extensibility)
            "@typescript-eslint/no-empty-object-type": "off",

            // Prefer `import type` for type-only imports
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                { prefer: "type-imports", fixStyle: "separate-type-imports" },
            ],
        },
    },
);
