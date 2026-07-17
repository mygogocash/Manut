import { config as loadDotenv } from "dotenv";
import path from "path";
import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(__dirname, "../..");
// Same order as Vite: base env, then overrides (no secrets committed in setup.ts).
loadDotenv({ path: path.join(repoRoot, ".env") });
loadDotenv({ path: path.join(repoRoot, ".env.local"), override: true });
loadDotenv({ path: path.join(repoRoot, ".env.test"), override: true });
loadDotenv({ path: path.join(repoRoot, ".env.test.local"), override: true });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "**/*.d.ts", "**/*.test.ts"],
    },
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
