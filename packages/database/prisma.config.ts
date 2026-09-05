import path from "node:path";
import { defineConfig } from "prisma/config";

/** Keeps migration SQL under `prisma/migrations/` (repo convention) while datasource lives in `prisma/schema/`. */
export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
