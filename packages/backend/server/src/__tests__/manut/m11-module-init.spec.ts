/**
 * M11 module-init static smoke. Same pattern as m7-module-init.spec.ts:
 * scans source files for the three traps that have crashed production
 * on past Manut module flips:
 *
 *  1. Every M11 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M11 provider source file must decorate its class with
 *     `@Injectable()` / `@Resolver()` (v1.12.0 DI scar).
 *  3. No M11 service / resolver imports its DI target via
 *     `import type` (PR #57 incident class).
 *
 * Also asserts the schema.prisma + migration additions are present.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M11_PROVIDERS = [
  'MnOutcomeVerifierService',
  'MnOutcomeVerifierResolver',
] as const;

const M11_FILES: Record<(typeof M11_PROVIDERS)[number], string> = {
  MnOutcomeVerifierService: 'manut-outcome-verifier.service.ts',
  MnOutcomeVerifierResolver: 'manut-outcome-verifier.resolver.ts',
};

test('manut.module.ts registers every M11 provider in the enabled branch', t => {
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

  const missing = M11_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M11 providers: ${missing.join(', ')}. ` +
      `Without that, the DoD verifier ships silently broken (v1.5.4 scar).`
  );
});

test('every M11 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M11_PROVIDERS) {
    const file = M11_FILES[provider];
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

test('no M11 file imports its DI target via `import type`', t => {
  // PrismaClient + MnOutcomeVerifierService + AccessController are the
  // DI targets we want runtime-imported on the M11 surface.
  const DI_TARGETS = new Set([
    'PrismaClient',
    'MnOutcomeVerifierService',
    'AccessController',
  ]);

  const offenses: string[] = [];
  for (const provider of M11_PROVIDERS) {
    const file = M11_FILES[provider];
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

test('schema.prisma adds definition_of_done JSONB column on MnTask', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  // We expect TWO occurrences: the Prisma field decl + the @map.
  const matches = schema.match(/definitionOfDone|definition_of_done/g) ?? [];
  t.true(
    matches.length >= 2,
    `expected definitionOfDone column + @map, got ${matches.length} match(es)`
  );
  // Belt-and-suspenders: shape check.
  t.regex(
    schema,
    /definitionOfDone\s+Json\?\s+@map\("definition_of_done"\)\s+@db\.JsonB/,
    'definition_of_done column shape mismatch'
  );
});

test('migration file exists with idempotent ADD COLUMN', t => {
  const migrationPath = join(
    process.cwd(),
    'migrations/20260518170000_add_mn_m11_definition_of_done/migration.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');
  t.regex(sql, /ADD COLUMN IF NOT EXISTS "definition_of_done" JSONB/);
});

test('PM resolver wires the verifier as an optional constructor param', t => {
  // The status-transition gate fires only when the verifier is wired
  // — but it MUST be wired in the live module. Verifying the type
  // appears in the resolver's constructor (and the optional `?: ...`
  // syntax) guards against a future refactor that drops the wiring.
  const src = readSource('manut-pm.resolver.ts');
  t.regex(
    src,
    /MnOutcomeVerifierService/,
    'MnPmResolver must import MnOutcomeVerifierService'
  );
  t.regex(
    src,
    /assertCanTransitionToDone\(/,
    'MnPmResolver must call assertCanTransitionToDone before status writes'
  );
});
