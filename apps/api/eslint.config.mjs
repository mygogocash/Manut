import { nodeConfig } from "@nexora/eslint-config/node";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nodeConfig,
  {
    ignores: [
      "**/*.d.ts",
      "eslint.config.mjs",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
    ],
  },
];
