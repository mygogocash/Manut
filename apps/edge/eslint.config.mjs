import { nodeConfig } from "@manut/eslint-config/node";

const workerGlobals = Object.fromEntries(
  [
    "atob",
    "btoa",
    "caches",
    "crypto",
    "fetch",
    "Headers",
    "Request",
    "Response",
    "TextDecoder",
    "TextEncoder",
    "URL",
    "WebSocket",
    "WebSocketPair",
  ].map((name) => [name, "readonly"]),
);

export default [
  ...nodeConfig,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      globals: workerGlobals,
    },
    rules: {
      "import/no-relative-parent-imports": "off",
      "no-console": "off",
      "no-restricted-imports": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    // Deploy-time provisioning CLI: console output is its UI.
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
];
