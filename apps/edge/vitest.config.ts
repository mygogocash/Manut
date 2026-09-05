import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    poolOptions: {
      workers: {
        // Tests run inside workerd with the same bindings as `wrangler dev`.
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Assets dir may not exist in CI before `expo export`; tests never touch it.
          assets: undefined,
        },
      },
    },
  },
});
