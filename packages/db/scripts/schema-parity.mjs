// Proves Drizzle migrations reproduce the Prisma schema: applies drizzle/ to a
// fresh database and diffs information_schema against the Prisma-managed one.
//   PRISMA_URL=postgres://.../intranet DRIZZLE_URL=postgres://.../parity node scripts/schema-parity.mjs
// Exits 1 on any column/type/nullability/index difference outside the allowlist.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const prismaUrl = process.env.PRISMA_URL, drizzleUrl = process.env.DRIZZLE_URL;
if (!prismaUrl || !drizzleUrl) throw new Error("PRISMA_URL and DRIZZLE_URL are required");

// Additions the Drizzle side is expected to have (Better Auth); anything else is a defect.
const ALLOW_EXTRA_TABLES = new Set(["account", "session", "verification"]);
const ALLOW_EXTRA_COLUMNS = new Set(["users.email_verified"]);

async function snapshot(url) {
  const sql = postgres(url, { max: 1 });
  try {
    const cols = await sql`select table_name, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns where table_schema='public' order by 1,2`;
    const idx = await sql`select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2`;
    return {
      columns: new Map(cols.map((c) => [`${c.table_name}.${c.column_name}`, `${c.udt_name}|${c.is_nullable}|${(c.column_default ?? "").replace(/::[\w\s"]+(\[\])?/g, "")}`])),
      tables: new Set(cols.map((c) => c.table_name)),
      indexes: new Map(idx.map((i) => [i.indexname, i.indexdef.replace(/^CREATE (UNIQUE )?INDEX \S+ ON /, "$1")])),
    };
  } finally { await sql.end(); }
}

const mig = postgres(drizzleUrl, { max: 1 });
await migrate(drizzle(mig), { migrationsFolder: "./drizzle", migrationsSchema: "drizzle", migrationsTable: "__drizzle_migrations" });
await mig.end();

const [a, b] = await Promise.all([snapshot(prismaUrl), snapshot(drizzleUrl)]);
const problems = [];
for (const t of b.tables) if (!a.tables.has(t) && !ALLOW_EXTRA_TABLES.has(t)) problems.push(`extra table on drizzle side: ${t}`);
for (const t of a.tables) if (!b.tables.has(t)) problems.push(`missing table on drizzle side: ${t}`);
for (const [k, v] of a.columns) { const w = b.columns.get(k); if (w === undefined) problems.push(`missing column: ${k}`); else if (w !== v) problems.push(`column differs: ${k}\n    prisma : ${v}\n    drizzle: ${w}`); }
for (const [k] of b.columns) if (!a.columns.has(k) && !ALLOW_EXTRA_COLUMNS.has(k) && !ALLOW_EXTRA_TABLES.has(k.split(".")[0])) problems.push(`extra column on drizzle side: ${k}`);
for (const [k, v] of a.indexes) { const w = b.indexes.get(k); if (w === undefined) problems.push(`missing index: ${k}`); else if (w !== v) problems.push(`index differs: ${k}`); }
console.log(`parity: ${a.tables.size} prisma tables vs ${b.tables.size} drizzle tables, ${a.columns.size} vs ${b.columns.size} columns, ${a.indexes.size} vs ${b.indexes.size} indexes`);
if (problems.length) { console.log(problems.map((p) => " - " + p).join("\n")); process.exit(1); }
console.log("parity: PASS");
