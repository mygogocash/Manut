import { nextJsConfig } from "@manut/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*"],
    rules: {
      "no-restricted-imports": "off",
      "import/no-relative-parent-imports": "off",
    },
  },
];
