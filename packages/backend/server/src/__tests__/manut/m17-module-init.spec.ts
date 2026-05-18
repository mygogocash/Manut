/**
 * M17 module-init static smoke. Same pattern as m14-module-init.spec.ts:
 * source-level checks for the traps that have crashed production on past
 * Manut module flips:
 *
 *   1. Every M17 provider is registered in `manut.module.ts` providers[].
 *   2. Every M17 class is decorated with @Injectable() or @Resolver()
 *      (v1.12.0 DI scar).
 *   3. No M17 file imports its DI target via `import type` (PR #57
 *      incident class).
 *   4. Schema defines `model MnCeoConversation`, `model MnCeoTurn`,
 *      `enum MnCeoTurnRole`, `enum MnCeoResolutionKind`.
 *   5. Every nullable `@Field` declaration in the DTO carries an
 *      explicit type tag (v1.7.0 / v1.10.2 UndefinedTypeError scar).
 *   6. Workspace + User models carry back-refs for the new conversation
 *      table — Prisma rejects the schema at codegen otherwise.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M17_PROVIDERS = ['MnCeoChatService', 'MnCeoChatResolver'] as const;

const M17_FILES: Record<(typeof M17_PROVIDERS)[number], string> = {
  MnCeoChatService: 'manut-ceo-chat.service.ts',
  MnCeoChatResolver: 'manut-ceo-chat.resolver.ts',
};

test('manut.module.ts registers every M17 provider in the enabled branch', t => {
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

  const missing = M17_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M17 providers: ${missing.join(', ')}. ` +
      `Without that, the CEO Chat surface ships silently broken (v1.5.4 scar).`
  );
});

test('every M17 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M17_PROVIDERS) {
    const file = M17_FILES[provider];
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

test('no M17 file imports its DI target via `import type`', t => {
  const DI_TARGETS = new Set([
    'PrismaClient',
    'MnCeoChatService',
    'AccessController',
  ]);

  const offenses: string[] = [];
  for (const provider of M17_PROVIDERS) {
    const file = M17_FILES[provider];
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

test('schema.prisma defines MnCeoConversation, MnCeoTurn, MnCeoTurnRole, MnCeoResolutionKind', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(
    schema,
    /^model MnCeoConversation\b/m,
    'MnCeoConversation model missing'
  );
  t.regex(schema, /^model MnCeoTurn\b/m, 'MnCeoTurn model missing');
  t.regex(schema, /^enum MnCeoTurnRole\b/m, 'MnCeoTurnRole enum missing');
  t.regex(
    schema,
    /^enum MnCeoResolutionKind\b/m,
    'MnCeoResolutionKind enum missing'
  );
});

test('Workspace + User models carry back-refs to MnCeoConversation', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  // Workspace.mnCeoConversations
  t.regex(
    schema,
    /mnCeoConversations\s+MnCeoConversation\[\]/,
    'Workspace must back-reference MnCeoConversation as mnCeoConversations'
  );
  // User.mnCeoConversations with the MnCeoConversationOwner relation tag
  t.regex(
    schema,
    /MnCeoConversation\[\]\s+@relation\("MnCeoConversationOwner"\)/,
    'User must back-reference MnCeoConversation with the Owner relation tag'
  );
});

test('every nullable @Field in the M17 DTO carries an explicit type tag', t => {
  const raw = readSource('manut-ceo-chat.dto.ts');
  // Strip block + line comments first so JSDoc examples (like
  // "@Field({ ... })" in this file's own scar warning) don't trigger
  // false positives.
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  // Any `@Field(` with an object-literal options arg but no arrow:
  // `@Field({ ... })`. That shape triggers the v1.7.0 / v1.10.2
  // UndefinedTypeError class because NestJS can't reflect the GraphQL
  // type from a nullable TypeScript union alone.
  const offenders = source.match(/@Field\s*\(\s*\{/g);
  t.is(
    offenders,
    null,
    'every @Field in M17 DTOs must pass an explicit type ' +
      '(e.g. @Field(() => String, { nullable: true })) — v1.7.0 / v1.10.2 scar'
  );
});
