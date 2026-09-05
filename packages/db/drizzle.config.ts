import { defineConfig } from "drizzle-kit";

/**
 * Drizzle owns schema migrations from the Cloudflare rewrite onward.
 * `db:pull` introspects an existing database (Prisma-managed history) into
 * `src/schema/schema.ts`; `db:generate` diffs `src/schema/*.ts` against the
 * last snapshot in `drizzle/meta` and writes the next SQL migration.
 *
 * DATABASE_URL must be a DIRECT (non-pgbouncer) connection for pull/migrate:
 * drizzle-kit uses prepared statements and multi-statement DDL.
 * `db:check` only validates journal/snapshots and accepts a placeholder URL.
 */
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  (process.argv.includes("check") ? "postgresql://postgres:postgres@127.0.0.1:5432/postgres" : undefined);
if (!url) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for drizzle-kit");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dbCredentials: { url },
  introspect: { casing: "camel" },
  migrations: { schema: "drizzle", table: "__drizzle_migrations" },
  strict: true,
  verbose: true,
});
