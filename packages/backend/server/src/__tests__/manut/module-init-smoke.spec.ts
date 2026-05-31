import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';

import { ManutModule } from '../../plugins/manut/manut.module';
import { createModule, type TestingModule } from '../create-module';

// ---------------------------------------------------------------------------
// Manut module-init smoke: migration-drift guard (HANDOFF Bug #1, #22).
//
// Problem: with the Manut module enabled on a DB that is missing the
// post-2026-05-14 migration batch, the app boots green and only 502s on the
// FIRST query against a missing mn_* / social_* / mongo table. Nothing fails
// loudly at deploy time.
//
// This spec boots ManutModule via the shared createModule() (which wires
// FunctionalityModules + a real PrismaClient against the CI test Postgres),
// then asserts every gated table exists. A drifted DB fails HERE, at CI time,
// instead of 502-ing in production.
//
// The expected-table set is NOT hardcoded: it is self-discovered by parsing
// the migration SQL, so it auto-stays-correct as migrations are added. See
// docs/manut-bughunt/MIGRATION_RUNBOOK.md.
// ---------------------------------------------------------------------------

const test = ava as TestFn<{
  module: TestingModule;
  db: PrismaClient;
}>;

// Migration folders sorting >= this prefix carry the Manut control-plane +
// social + mongo batch whose tables this guard protects.
const FIRST_GATED_MIGRATION = '20260514';

// Columns added to `workspaces` by the post-May-17 migrations (Bug #1).
const GATED_WORKSPACE_COLUMNS: readonly string[] = ['plan', 'slug'];

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');

// `CREATE TABLE [IF NOT EXISTS] "name"` (or unquoted) — capture the table name.
const CREATE_TABLE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi;

// Self-discover every table created by the gated migration batch. Reading the
// SQL at test time means this set never rots: adding a migration auto-extends
// the guard with no edit here.
function discoverGatedTables(): string[] {
  const tables = new Set<string>();
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name >= FIRST_GATED_MIGRATION)
    .map(entry => entry.name);

  for (const dir of dirs) {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, dir, 'migration.sql'),
      'utf8'
    );
    for (const match of sql.matchAll(CREATE_TABLE_RE)) {
      tables.add(match[1]);
    }
  }

  return [...tables].sort();
}

const GATED_TABLES = discoverGatedTables();

test.before(async t => {
  t.context.module = await createModule({
    imports: [ManutModule],
  });
  t.context.db = t.context.module.get(PrismaClient);
});

test.after.always(async t => {
  await t.context.module?.close();
});

test.serial(
  'manut module-init smoke > given module enabled > every gated table exists',
  async t => {
    // Sanity: the regex must discover something, or the guard is silently inert.
    t.true(
      GATED_TABLES.length > 0,
      `No CREATE TABLE statements discovered under ${MIGRATIONS_DIR}; the ` +
        `migration-drift guard would be a no-op. Check FIRST_GATED_MIGRATION ` +
        `and CREATE_TABLE_RE.`
    );

    const missing: string[] = [];
    for (const table of GATED_TABLES) {
      // to_regclass returns NULL when the relation does not exist, the regclass
      // otherwise. Parameterised so the identifier is never concatenated.
      const rows = await t.context.db.$queryRawUnsafe<{ reg: string | null }[]>(
        'SELECT to_regclass($1) AS reg',
        `public.${table}`
      );
      if (!rows?.[0]?.reg) {
        missing.push(table);
      }
    }

    t.deepEqual(
      missing,
      [],
      `Manut module is enabled but these gated tables are missing on the ` +
        `target DB: ${missing.join(', ')}. Apply the post-2026-05-14 ` +
        `migrations (see docs/manut-bughunt/MIGRATION_RUNBOOK.md) before ` +
        `enabling the module in this environment.`
    );
  }
);

test.serial(
  'manut module-init smoke > given module enabled > workspaces.plan and workspaces.slug exist',
  async t => {
    const rows = await t.context.db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workspaces'
          AND column_name = ANY($1::text[])`,
      GATED_WORKSPACE_COLUMNS as string[]
    );

    const present = new Set(rows.map(r => r.column_name));
    const missing = GATED_WORKSPACE_COLUMNS.filter(c => !present.has(c));

    t.deepEqual(
      missing,
      [],
      `Manut module is enabled but these workspaces columns are missing: ` +
        `${missing.join(', ')}. Apply 20260517120000_workspace_slug and ` +
        `20260520040000_add_workspace_plan first.`
    );
  }
);
