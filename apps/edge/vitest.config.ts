import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const nodeContractTests = [
  "tests/cloudflare-builds.test.ts",
  "tests/deploy-workflow-secrets.test.ts",
] as const;

export default defineConfig({
  test: {
    restoreMocks: true,
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          name: "workers",
          restoreMocks: true,
          exclude: [...nodeContractTests],
        },
      },
      {
        test: {
          name: "node-contracts",
          environment: "node",
          pool: "forks",
          include: [...nodeContractTests],
        },
      },
    ],
  },
});
