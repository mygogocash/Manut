import { nodeConfig } from "@manut/eslint-config/node";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nodeConfig,
  {
    ignores: [
      "**/*.d.ts",
      "eslint.config.mjs",
      "postcss.config.mjs",
      ".next/**",
      "**/.next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      ".vercel/**",
      "coverage/**",
    ],
  },
];
