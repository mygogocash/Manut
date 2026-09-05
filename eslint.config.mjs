import { config } from "@nexora/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
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
