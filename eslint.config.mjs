import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
    {
        ignores: ["**/dist/**", "**/node_modules/**", ".tmp/**", "coverage/**", "packages/draco/worker/**"]
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["eslint.config.mjs", "scripts/*.mjs", "packages/*/scripts/*.mjs"],
        languageOptions: {
            globals: {
                process: "readonly",
                console: "readonly",
                URL: "readonly",
                Buffer: "readonly"
            }
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            eqeqeq: ["error", "always"],
            "no-var": "error",
            "prefer-const": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/consistent-type-imports": "error"
        }
    }
]);
