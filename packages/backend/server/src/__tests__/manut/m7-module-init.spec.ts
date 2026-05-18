/**
 * M7 module-init static smoke. Same pattern as m6a-module-init.spec.ts:
 * static source scans for the three traps that have crashed production
 * on past Manut module flips:
 *
 *  1. Every M7 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M7 provider source file must decorate its class with
 *     `@Injectable()` / `@Resolver()` (v1.12.0 DI scar).
 *  3. No M7 service / resolver / cron imports its DI target via
 *     `import type` (PR #57 incident class).
 *
 * Also asserts the schema.prisma additions are present.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M7_PROVIDERS = [
  'MnTaskCheckoutService',
  'MnTaskCheckoutResolver',
  'MnTaskWatchdogCron',
] as const;

const M7_FILES: Record<(typeof M7_PROVIDERS)[number], string> = {
  MnTaskCheckoutService: 'manut-task-checkout.service.ts',
  MnTaskCheckoutResolver: 'manut-task-checkout.resolver.ts',
  MnTaskWatchdogCron: 'manut-task-watchdog.cron.ts',
};

test('manut.module.ts registers every M7 provider in the enabled branch', t => {
  const source = readSource('manut.module.ts');
  const stripped = source.replace(/\/\/[^\n]*/g, '');

  const matches = [
    ...stripped.matchAll(/providers\s*:\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/const\s+providers[^=]*=\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/providers\.push\s*\(([^)]+)\)/g),
  ];

  const known = new Set<string>();
  for (const match of matches) {
    for (const id of match[1].split(',')) {
      const trimmed = id.trim().split(/\s/)[0];
      if (trimmed) known.add(trimmed);
    }
  }

  const missing = M7_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M7 providers: ${missing.join(', ')}. ` +
      `Without that, atomic checkout ships silently broken (v1.5.4 scar).`
  );
});

test('every M7 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M7_PROVIDERS) {
    const file = M7_FILES[provider];
    const source = readSource(file);
    const declRe = new RegExp(
      `(@[A-Za-z_$][A-Za-z0-9_$]*\\([^)]*\\)\\s*)?export\\s+class\\s+${provider}\\b`,
      's'
    );
    const decl = source.match(declRe);
    if (!decl || decl.index === undefined) {
      offenses.push(`${file}: class declaration ${provider} not found`);
      continue;
    }
    const window = source.slice(Math.max(0, decl.index - 200), decl.index + 50);
    if (!/@Injectable\s*\(/.test(window) && !/@Resolver\s*\(/.test(window)) {
      offenses.push(
        `${file}: ${provider} is missing @Injectable() / @Resolver() ` +
          `(v1.12.0 DI scar)`
      );
    }
  }
  t.deepEqual(offenses, [], offenses.join('\n'));
});

test('no M7 file imports its DI target via `import type`', t => {
  // PrismaClient + MnTaskCheckoutService are the two DI targets used
  // across the M7 surface. Both must be runtime imports.
  const DI_TARGETS = new Set(['PrismaClient', 'MnTaskCheckoutService']);

  const offenses: string[] = [];
  for (const provider of M7_PROVIDERS) {
    const file = M7_FILES[provider];
    const src = readSource(file);

    const typeOnly = new Set<string>();
    for (const m of src.matchAll(
      /import\s+type\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g
    )) {
      for (const id of m[1].split(',')) {
        const name = id.trim().split(/\s+as\s+/)[0];
        if (name) typeOnly.add(name);
      }
    }
    if (typeOnly.size === 0) continue;

    const ctorMatch = src.match(/constructor\s*\(([\s\S]*?)\)\s*\{/);
    if (!ctorMatch) continue;
    for (const param of ctorMatch[1].split(',')) {
      const typeMatch = param.match(/:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (!typeMatch) continue;
      const typeName = typeMatch[1];
      if (typeOnly.has(typeName) && DI_TARGETS.has(typeName)) {
        offenses.push(
          `${file}: constructor parameter type '${typeName}' is type-only ` +
            `(NestJS DI will see Object — v1.12.0 scar)`
        );
      }
    }
  }
  t.deepEqual(offenses, [], offenses.join('\n'));
});

test('schema.prisma adds checkout columns + MnExecutionRun model', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /checkout_run_id/, 'checkout_run_id column missing');
  t.regex(schema, /execution_run_id/, 'execution_run_id column missing');
  t.regex(schema, /execution_locked_at/, 'execution_locked_at column missing');
  t.regex(schema, /^model MnExecutionRun\b/m, 'MnExecutionRun model missing');
  t.regex(
    schema,
    /^enum MnExecutionRunStatus\b/m,
    'MnExecutionRunStatus enum missing'
  );
  t.regex(
    schema,
    /executionRuns\s+MnExecutionRun\[\]/,
    'MnTask back-relation to MnExecutionRun missing'
  );
});

test('migration file exists with required statements', t => {
  const migrationPath = join(
    process.cwd(),
    'migrations/20260518100000_add_mn_m7_execution_locks/migration.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');
  t.regex(sql, /ADD COLUMN IF NOT EXISTS "checkout_run_id"/);
  t.regex(sql, /ADD COLUMN IF NOT EXISTS "execution_run_id"/);
  t.regex(sql, /CREATE TYPE "MnExecutionRunStatus"/);
  t.regex(sql, /CREATE TABLE "mn_execution_runs"/);
  t.regex(sql, /ON DELETE CASCADE/);
  t.regex(sql, /ON DELETE SET NULL/);
});
