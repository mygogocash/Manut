import { nextJsConfig } from "@nexora/eslint-config/next-js";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["src/pages/api/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*"],
    rules: {
      "no-restricted-imports": "off",
      "import/no-relative-parent-imports": "off",
    },
  },
];
