import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseUrl = process.env.MIGRATION_TEST_URL;
if (!databaseUrl) {
  console.error("MIGRATION_TEST_URL is required");
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm", ["migration:check"]);
run(
  "pnpm",
  ["--filter", "@manut/database", "exec", "prisma", "migrate", "deploy"],
  {
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  },
);

const manifest = await import(
  "../packages/database/prisma/migrations/baseline-manifest.json",
  { with: { type: "json" } }
).then((module) => module.default);
const baseline = new Set(manifest.baseline.map((entry) => entry.path));
const migrationsRoot = join(root, "packages/database/prisma/migrations");
const files = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  {
    cwd: root,
    encoding: "utf8",
  },
);
if (files.status !== 0) process.exit(files.status ?? 1);

const newMigrations = files.stdout
  .split("\n")
  .filter((path) => /\/migrations\/[^/]+\/migration\.sql$/.test(path))
  .filter((path) => !baseline.has(path))
  .sort();

for (const migration of newMigrations) {
  const directory = dirname(join(root, migration));
  for (const file of ["setup.sql", "migration.sql", "assert.sql"]) {
    const path = join(directory, file);
    if (!existsSync(path)) throw new Error(`Missing ${path}`);
    run("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", path]);
  }
}

const baselineAssert = join(
  migrationsRoot,
  "20260717000000_manut_baseline/assert.sql",
);
run("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", baselineAssert]);
console.log("Migration deploy, replay, and assertions passed.");
