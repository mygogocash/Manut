/**
 * M12 module-init static smoke. Mirrors m11-module-init.spec.ts: source-
 * level checks for the three traps that have crashed production on past
 * Manut module flips, plus shape checks for the schema / migration /
 * frontend wiring that ship together.
 *
 *   1. Every M12 provider registered in `manut.module.ts` `providers[]`
 *      must appear in the enabled branch (v1.5.4 half-feature scar).
 *   2. Every M12 provider source file must decorate its class with
 *      `@Injectable()` / `@Resolver()` (v1.12.0 DI scar).
 *   3. No M12 service / resolver imports its DI target via
 *      `import type` (PR #57 incident class).
 *   4. The schema.prisma adds the `maximizerMode` column on MnAgent.
 *   5. The migration adds an idempotent ADD COLUMN with IF NOT EXISTS.
 *   6. Every nullable @Field in the M12 DTO carries an explicit type tag
 *      (v1.7.0 / v1.10.2 UndefinedTypeError scar).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M12_PROVIDERS = ['MnMaximizerService', 'MnMaximizerResolver'] as const;

const M12_FILES: Record<(typeof M12_PROVIDERS)[number], string> = {
  MnMaximizerService: 'manut-maximizer.service.ts',
  MnMaximizerResolver: 'manut-maximizer.resolver.ts',
};

test('manut.module.ts registers every M12 provider in the enabled branch', t => {
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

  const missing = M12_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M12 providers: ${missing.join(', ')}. ` +
      `Without that, MAXIMIZER MODE ships silently broken (v1.5.4 scar).`
  );
});

test('every M12 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M12_PROVIDERS) {
    const file = M12_FILES[provider];
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

test('no M12 file imports its DI target via `import type`', t => {
  // The DI targets in the M12 surface are PrismaClient (both service
  // and resolver), MnOutcomeVerifierService (constructor-injected on
  // the service), MnMaximizerService (constructor-injected on the
  // resolver), and AccessController (constructor-injected on the
  // resolver). All must be runtime imports.
  const DI_TARGETS = new Set([
    'PrismaClient',
    'MnOutcomeVerifierService',
    'MnMaximizerService',
    'AccessController',
  ]);

  const offenses: string[] = [];
  for (const provider of M12_PROVIDERS) {
    const file = M12_FILES[provider];
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

test('schema.prisma adds maximizerMode column on MnAgent', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  // We expect TWO occurrences: the Prisma field decl + the @map.
  const matches = schema.match(/maximizerMode|maximizer_mode/g) ?? [];
  t.true(
    matches.length >= 2,
    `expected maximizerMode column + @map, got ${matches.length} match(es)`
  );
  // Belt-and-suspenders: shape check — must be a non-nullable Boolean
  // with default(false) so existing rows get the safe value.
  t.regex(
    schema,
    /maximizerMode\s+Boolean\s+@default\(false\)\s+@map\("maximizer_mode"\)/,
    'maximizer_mode column shape mismatch'
  );
});

test('migration file exists with idempotent ADD COLUMN', t => {
  const migrationPath = join(
    process.cwd(),
    'migrations/20260518210000_add_mn_m12_maximizer_mode/migration.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');
  t.regex(sql, /ADD COLUMN IF NOT EXISTS "maximizer_mode" BOOLEAN/);
  t.regex(sql, /DEFAULT FALSE/);
});

test('every nullable @Field in the M12 DTO carries an explicit type tag', t => {
  const source = readSource('manut-maximizer.dto.ts');
  // Find any `@Field(` without an arrow type — i.e. `@Field({ ... })`
  // shaped declarations. These trigger the v1.7.0 / v1.10.2
  // UndefinedTypeError class because NestJS can't reflect the GraphQL
  // type from a TypeScript type alone.
  const offenders = source.match(/@Field\s*\(\s*\{/g);
  t.is(
    offenders,
    null,
    'every @Field in M12 DTOs must pass an explicit type ' +
      '(e.g. @Field(() => String, { nullable: true })) — v1.7.0 / v1.10.2 scar'
  );
});

test('resolver wires enableMnAgentMaximizer + disableMnAgentMaximizer mutations', t => {
  const src = readSource('manut-maximizer.resolver.ts');
  // Require an `@Mutation(` decorator AND the named method body each
  // appear in the resolver. We don't constrain proximity (description
  // strings between the decorator and method signature are long).
  t.regex(src, /@Mutation\s*\(/, 'resolver must declare @Mutation');
  t.regex(
    src,
    /\benableMnAgentMaximizer\s*\(/,
    'resolver must expose enableMnAgentMaximizer mutation method'
  );
  t.regex(
    src,
    /\bdisableMnAgentMaximizer\s*\(/,
    'resolver must expose disableMnAgentMaximizer mutation method'
  );
});

test('service exposes the four maximizer invariants', t => {
  const src = readSource('manut-maximizer.service.ts');
  t.regex(src, /\bMAX_BATCH_SIZE\b\s*=\s*10/);
  t.regex(src, /\bCOST_APPROVAL_THRESHOLD\b\s*=\s*0\.5/);
  // Auto-delegation surface — must traverse direct reports.
  t.regex(src, /reportsToAgentId/);
  // Outcome-verifier integration — every DONE transition.
  t.regex(src, /assertCanTransitionToDone/);
  // Persistent state mutator.
  t.regex(src, /maximizerMode/);
});
