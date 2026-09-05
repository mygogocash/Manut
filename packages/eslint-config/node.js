import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import turboPlugin from "eslint-plugin-turbo";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * A custom ESLint configuration for Node.js (Express) applications.
 * Does NOT include readable-tailwind since backend has no Tailwind.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [
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
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier,
      "simple-import-sort": simpleImportSort,
      import: importPlugin,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
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

      // Prettier
      "prettier/prettier": "warn",

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
    },
  },
  // Allow relative imports in config files
  {
    files: ["**/*.config.js", "**/*.config.mjs", "**/*.config.ts"],
    rules: {
      "no-restricted-imports": "off",
      "import/no-relative-parent-imports": "off",
    },
  },
  // Allow relative imports in test files
  {
    files: ["**/*.test.ts", "**/test/**/*"],
    rules: {
      "no-restricted-imports": "off",
      "import/no-relative-parent-imports": "off",
    },
  },
];
