import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
          alwaysTryTypes: true,
        },
        node: {
          extensions: [
            ".web.ts",
            ".web.tsx",
            ".native.ts",
            ".native.tsx",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
          ],
        },
      },
    },
    rules: {
      // TypeScript and Metro resolve these SDK-standard .web/.native pairs.
      // eslint-plugin-import does not apply TypeScript's moduleSuffixes.
      "import/no-unresolved": [
        "error",
        {
          ignore: [
            "^@/platform/api-client$",
            "^@/platform/app-shell$",
            "^@/platform/auth-link-source$",
            "^@/platform/auth-gateway$",
            "^@/platform/app-visibility$",
            "^@/platform/current-hash$",
            // Platform pair: preferences-storage.web.ts / .native.ts
            "^@/features/settings/preferences-storage$",
          ],
        },
      ],
    },
    ignores: [
      "dist/**",
      "dist-ios/**",
      "dist-android/**",
      ".expo/**",
      ".wrangler/**",
    ],
  },
];
