import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
    {
        ignores: ["**/dist/", "**/node_modules/", "target/", "**/*.js", "examples/"],
    },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                { prefer: "type-imports", fixStyle: "separate-type-imports" },
            ],
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-empty-object-type": "off",
        },
    },

    // udoc-ui is what the viewer and the editor are built on, so it reaches
    // neither, and the viewer never reaches the editor, whose edit mode is its
    // own. Their package.json files don't list them, but workspace hoisting
    // would resolve the import anyway.
    {
        files: ["packages/udoc-ui/**/*.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: [
                                "@docmentis/udoc-editor",
                                "@docmentis/udoc-editor/*",
                                "@docmentis/udoc-viewer",
                                "@docmentis/udoc-viewer/*",
                            ],
                            message: "udoc-ui is the base of the viewer and the editor; it imports neither.",
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ["packages/udoc-viewer/**/*.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@docmentis/udoc-editor", "@docmentis/udoc-editor/*"],
                            message: "The viewer never imports the editor.",
                        },
                    ],
                },
            ],
        },
    },

    // Worker/Node config files, the tests, and the Node packages run outside
    // the browser.
    {
        files: [
            "**/vite.config.ts",
            "**/.vitepress/config.ts",
            "**/*.config.mjs",
            "**/scripts/*.mjs",
            "**/test/**/*.ts",
            "packages/udoc-node/src/**/*.ts",
            "packages/udoc-cli/src/**/*.ts",
            "packages/udoc-server/src/**/*.ts",
        ],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },

    eslintConfigPrettier,
);
