/**
 * M13 module-init static smoke. Same pattern as m11-module-init.spec.ts:
 * source-level checks for the traps that have crashed production on past
 * Manut module flips:
 *
 *   1. Every M13 provider is registered in `manut.module.ts` providers[]
 *      in the enabled branch (v1.5.4 half-feature scar).
 *   2. Every M13 class is decorated with @Injectable() or @Resolver()
 *      (v1.12.0 DI scar).
 *   3. No M13 file imports its DI target via `import type` (PR #57
 *      incident class).
 *   4. Schema defines `model MnTaskPlan` and `enum MnTaskPlanStatus`.
 *   5. Every nullable `@Field` declaration in the DTO carries an
 *      explicit type tag (v1.7.0 / v1.10.2 UndefinedTypeError scar).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M13_PROVIDERS = ['MnTaskPlanService', 'MnTaskPlanResolver'] as const;

const M13_FILES: Record<(typeof M13_PROVIDERS)[number], string> = {
  MnTaskPlanService: 'manut-task-plan.service.ts',
  MnTaskPlanResolver: 'manut-task-plan.resolver.ts',
};

test('manut.module.ts registers every M13 provider in the enabled branch', t => {
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

  const missing = M13_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M13 providers: ${missing.join(', ')}. ` +
      `Without that, deep planning ships silently broken (v1.5.4 scar).`
  );
});

test('every M13 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M13_PROVIDERS) {
    const file = M13_FILES[provider];
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

test('no M13 file imports its DI target via `import type`', t => {
  // PrismaClient, MnTaskPlanService, and AccessController are the
  // DI targets we need runtime-imported on the M13 surface.
  const DI_TARGETS = new Set([
    'PrismaClient',
    'MnTaskPlanService',
    'AccessController',
  ]);

  const offenses: string[] = [];
  for (const provider of M13_PROVIDERS) {
    const file = M13_FILES[provider];
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

test('schema.prisma defines MnTaskPlan + MnTaskPlanStatus', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnTaskPlan\b/m, 'MnTaskPlan model missing');
  t.regex(schema, /^enum MnTaskPlanStatus\b/m, 'MnTaskPlanStatus enum missing');
  // Belt-and-suspenders: confirm the unique constraint shape.
  t.regex(
    schema,
    /@@unique\(\[taskId, revisionNumber\]\)/,
    'MnTaskPlan must declare @@unique([taskId, revisionNumber])'
  );
});

test('every nullable @Field in the M13 DTO carries an explicit type tag', t => {
  const source = readSource('manut-task-plan.dto.ts');
  // Find any `@Field(` without an arrow type — i.e. `@Field({ ... })`
  // shaped declarations. These trigger the v1.7.0 / v1.10.2
  // UndefinedTypeError class because NestJS can't reflect the GraphQL
  // type from a nullable TypeScript union alone.
  const offenders = source.match(/@Field\s*\(\s*\{/g);
  t.is(
    offenders,
    null,
    'every @Field in M13 DTOs must pass an explicit type ' +
      '(e.g. @Field(() => String, { nullable: true })) — v1.7.0 / v1.10.2 scar'
  );
});
