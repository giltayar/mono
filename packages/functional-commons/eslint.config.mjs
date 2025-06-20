import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import mochaNoOnly from "eslint-plugin-mocha-no-only";
import n from "eslint-plugin-n";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends("plugin:n/recommended"),

    plugins: {
        prettier,
        "mocha-no-only": mochaNoOnly,
        n,
    },

    languageOptions: {
        globals: {
            ...globals.commonjs,
            ...globals.node,
            ...globals.browser,
        },

        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "prettier/prettier": ["warn"],

        "no-warning-comments": ["warn", {
            terms: ["fixme", "removeme", "xxx", "@@@"],
            location: "anywhere",
        }],

        "no-process-exit": "off",
        "no-const-assign": "error",
        "no-this-before-super": "error",
        "no-undef": "warn",
        "no-unreachable": "warn",

        "no-unused-vars": ["warn", {
            varsIgnorePattern: "^_",
            args: "all",
            argsIgnorePattern: "^_",
        }],

        "constructor-super": "warn",
        "valid-typeof": "warn",
        "mocha-no-only/mocha-no-only": "warn",
        "n/exports-style": ["error", "module.exports"],
    },
}]);