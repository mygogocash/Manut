// Marks the introspected baseline migration (0000_*) as already applied on a
// database whose schema was created by Prisma. Run ONCE per existing database
// (staging, production) before the first `drizzle-kit migrate`; a fresh empty
// database must NOT be baselined (it needs 0000 to actually run).
// Idempotent: exits 0 without changes if the baseline row already exists.
//
//   DIRECT_URL=postgres://... node scripts/baseline.mjs [--dry-run]
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL is required");

const journal = JSON.parse(readFileSync(resolve("drizzle/meta/_journal.json"), "utf8"));
const first = journal.entries[0];
if (!first || first.idx !== 0) throw new Error("journal has no idx 0 baseline entry");
const sqlFile = readdirSync(resolve("drizzle")).find((f) => f.startsWith("0000_") && f.endsWith(".sql"));
if (!sqlFile) throw new Error("0000_*.sql not found");
const hash = createHash("sha256").update(readFileSync(resolve("drizzle", sqlFile), "utf8")).digest("hex");

const sql = postgres(url, { max: 1 });
try {
  const [{ n }] = await sql`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='users'`;
  if (n === 0) throw new Error("refusing to baseline: database has no users table (empty DB should run 0000 for real)");
  await sql`create schema if not exists drizzle`;
  await sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  const existing = await sql`select id from drizzle.__drizzle_migrations where hash = ${hash}`;
  if (existing.length > 0) { console.log(`baseline: already marked (${sqlFile})`); process.exit(0); }
  if (dryRun) { console.log(`baseline: DRY RUN would mark ${sqlFile} (created_at=${first.when})`); process.exit(0); }
  await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${first.when})`;
  console.log(`baseline: marked ${sqlFile} as applied (created_at=${first.when})`);
} finally { await sql.end(); }
