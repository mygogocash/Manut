import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import readableTailwind from "eslint-plugin-readable-tailwind";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

const callees = [
  "clsx",
  "cva",
  "ctl",
  "twMerge",
  "cx",
  "cn",
  ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
];

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", ".next/**"],
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      import: importPlugin,
      "readable-tailwind": readableTailwind,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
        },
      ],

      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/extensions": 0,
      "import/no-relative-parent-imports": "error",

      // General rules
      semi: "warn",
      curly: ["error", "multi-line"],
      "no-console": "warn",

      // Prevent importing from apps into shared packages
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/**", "@/apps/**", "apps/**"],
              message:
                "Cannot import from apps into shared packages. Only import from shared into apps.",
            },
            {
              group: ["../*", "../**/*", "./*", "./**/*"],
              message:
                "Relative imports are not allowed. Please use path aliases instead.",
            },
          ],
        },
      ],

      // Tailwind readable
      "readable-tailwind/multiline": [
        "warn",
        {
          callees,
          printWidth: 80,
        },
      ],
      "readable-tailwind/no-unnecessary-whitespace": [
        "warn",
        {
          callees,
        },
      ],
      "readable-tailwind/sort-classes": [
        "warn",
        {
          callees,
        },
      ],
      "readable-tailwind/no-duplicate-classes": [
        "error",
        {
          callees,
        },
      ],
    },
  },
  // Allow relative imports in eslint-config files (no path aliases available)
  {
    files: ["**/eslint-config/**/*.js", "**/eslint-config/*.js"],
    rules: {
      "no-restricted-imports": "off",
      "import/no-relative-parent-imports": "off",
    },
  },
];
