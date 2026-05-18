/**
 * M14 module-init static smoke. Same pattern as m6a-module-init.spec.ts:
 * source-level checks for the traps that have crashed production on past
 * Manut module flips:
 *
 *   1. Every M14 provider is registered in `manut.module.ts` providers[].
 *   2. The public `MnWorkQueueController` is registered in controllers[].
 *   3. Every M14 class is decorated with @Injectable() or @Resolver()
 *      or @Controller() (v1.12.0 DI scar).
 *   4. No M14 file imports its DI target via `import type` (PR #57
 *      incident class).
 *   5. Schema defines `model MnWorkQueue`, `model MnWorkQueueIntake`,
 *      and `enum MnIntakeStatus`.
 *   6. Every nullable `@Field` declaration in the DTO carries an
 *      explicit type tag (v1.7.0 / v1.10.2 UndefinedTypeError scar).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M14_PROVIDERS = ['MnWorkQueueService', 'MnWorkQueueResolver'] as const;

const M14_FILES: Record<(typeof M14_PROVIDERS)[number], string> = {
  MnWorkQueueService: 'manut-work-queue.service.ts',
  MnWorkQueueResolver: 'manut-work-queue.resolver.ts',
};

const M14_CONTROLLER = 'MnWorkQueueController';
const M14_CONTROLLER_FILE = 'manut-work-queue.controller.ts';

test('manut.module.ts registers every M14 provider in the enabled branch', t => {
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

  const missing = M14_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M14 providers: ${missing.join(', ')}. ` +
      `Without that, the work-queue routes ship silently broken (v1.5.4 scar).`
  );
});

test('manut.module.ts registers MnWorkQueueController in controllers[]', t => {
  const source = readSource('manut.module.ts');
  t.regex(
    source,
    /controllers\s*:\s*\[[^\]]*MnWorkQueueController/s,
    'public intake webhook controller must be registered in controllers[]'
  );
});

test('every M14 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M14_PROVIDERS) {
    const file = M14_FILES[provider];
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

test('MnWorkQueueController is decorated with @Controller()', t => {
  const source = readSource(M14_CONTROLLER_FILE);
  const declRe = new RegExp(
    `(@[A-Za-z_$][A-Za-z0-9_$]*\\([^)]*\\)\\s*)?export\\s+class\\s+${M14_CONTROLLER}\\b`,
    's'
  );
  const decl = source.match(declRe);
  t.not(decl, null);
  if (decl && decl.index !== undefined) {
    const window = source.slice(Math.max(0, decl.index - 200), decl.index + 50);
    t.regex(window, /@Controller\s*\(/);
  }
});

test('no M14 file imports its DI target via `import type`', t => {
  const DI_TARGETS = new Set(['PrismaClient', 'MnWorkQueueService']);

  const allFiles: string[] = [...Object.values(M14_FILES), M14_CONTROLLER_FILE];

  const offenses: string[] = [];
  for (const file of allFiles) {
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

test('schema.prisma defines MnWorkQueue, MnWorkQueueIntake, MnIntakeStatus', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnWorkQueue\b/m, 'MnWorkQueue model missing');
  t.regex(
    schema,
    /^model MnWorkQueueIntake\b/m,
    'MnWorkQueueIntake model missing'
  );
  t.regex(schema, /^enum MnIntakeStatus\b/m, 'MnIntakeStatus enum missing');
});

test('every nullable @Field in the M14 DTO carries an explicit type tag', t => {
  const source = readSource('manut-work-queue.dto.ts');
  // Find any `@Field(` without an arrow type — i.e. `@Field({ ... })`
  // shaped declarations. These trigger the v1.7.0 / v1.10.2
  // UndefinedTypeError class because NestJS can't reflect the GraphQL
  // type from a nullable TypeScript union alone.
  const offenders = source.match(/@Field\s*\(\s*\{/g);
  t.is(
    offenders,
    null,
    'every @Field in M14 DTOs must pass an explicit type ' +
      '(e.g. @Field(() => String, { nullable: true })) — v1.7.0 / v1.10.2 scar'
  );
});
