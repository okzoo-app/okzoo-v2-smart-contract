/* eslint-disable no-undef */
// eslint.config.js

const js = require("@eslint/js");
const ts = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettier = require("eslint-plugin-prettier");

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@typescript-eslint": ts,
            prettier: prettier,
        },
        rules: {
            ...ts.configs.recommended.rules,
            "prettier/prettier": ["error", { endOfLine: "auto" }],
        },
        ignores: ["*.config.js", "typechain-types/**"],
    },
];
