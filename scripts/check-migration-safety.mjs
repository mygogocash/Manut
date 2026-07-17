import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsRoot = join(root, "packages/database/prisma/migrations");
const manifestPath = join(migrationsRoot, "baseline-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const baseline = new Map(
  manifest.baseline.map((entry) => [entry.path, entry.sha256]),
);
const failures = [];

for (const [path, expected] of baseline) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    failures.push(`baseline migration removed: ${path}`);
    continue;
  }
  const actual = createHash("sha256")
    .update(readFileSync(absolute))
    .digest("hex");
  if (actual !== expected) failures.push(`baseline migration edited: ${path}`);
}

const migrationFiles = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(
    (entry) =>
      `packages/database/prisma/migrations/${entry.name}/migration.sql`,
  )
  .filter((path) => existsSync(join(root, path)))
  .sort();
const newMigrations = migrationFiles.filter((path) => !baseline.has(path));

for (const migration of newMigrations) {
  const directory = dirname(join(root, migration));
  for (const companion of ["setup.sql", "assert.sql"]) {
    if (!existsSync(join(directory, companion))) {
      failures.push(`${migration} is missing required ${companion}`);
    }
  }
}

const baseSha = process.env.GITHUB_BASE_SHA;
if (baseSha) {
  const baseHasSchema =
    spawnSync(
      "git",
      ["cat-file", "-e", `${baseSha}:packages/database/prisma/schema`],
      { cwd: root },
    ).status === 0;

  if (baseHasSchema) {
    const diff = spawnSync(
      "git",
      ["diff", "--name-only", `${baseSha}...HEAD`],
      { cwd: root, encoding: "utf8" },
    );
    if (diff.status !== 0) {
      process.stderr.write(diff.stderr);
      process.exit(diff.status ?? 1);
    }
    const changed = diff.stdout.split("\n").filter(Boolean);
    const schemaChanged = changed.some((path) =>
      path.startsWith("packages/database/prisma/schema/"),
    );
    const newMigrationChanged = changed.some((path) =>
      newMigrations.includes(path),
    );
    if (schemaChanged && !newMigrationChanged) {
      failures.push("Prisma schema changed without a new migration");
    }
  }
}

if (failures.length > 0) {
  console.error("Migration safety violations:\n");
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Migration safety passed (${baseline.size} clean baseline, ${newMigrations.length} new).`,
);
