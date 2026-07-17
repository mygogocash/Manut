import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

/** Keeps migration SQL under `prisma/migrations/` (repo convention) while datasource lives in `prisma/schema/`. */
export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://manut:manut@127.0.0.1:5432/manut",
  },
});
