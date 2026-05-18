/**
 * M16 module-init static smoke. Same pattern as m11-module-init.spec.ts:
 * scans source files for the three traps that have crashed production
 * on past Manut module flips.
 *
 *  1. Every M16 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M16 provider source file must decorate its class with
 *     `@Injectable()` / `@Resolver()` (v1.12.0 DI scar).
 *  3. No M16 service / resolver imports its DI target via
 *     `import type` (PR #57 incident class).
 *
 * Also verifies the candidate-marker discipline:
 *  - The service module exports the expected internal helpers and the
 *    `MnLearningCandidateStatus` enum.
 *  - The DTO file has zero nullable `@Field` declarations without an
 *    explicit `() => Type` arrow (v1.7.0 / v1.10.2 scar).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M16_PROVIDERS = [
  'MnOrgLearningService',
  'MnOrgLearningResolver',
  'MnTaskCompletionHookService',
] as const;

const M16_FILES: Record<(typeof M16_PROVIDERS)[number], string> = {
  MnOrgLearningService: 'manut-org-learning.service.ts',
  MnOrgLearningResolver: 'manut-org-learning.resolver.ts',
  MnTaskCompletionHookService: 'manut-task-completion-hook.service.ts',
};

test('manut.module.ts registers every M16 provider in the enabled branch', t => {
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

  const missing = M16_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M16 providers: ${missing.join(', ')}. ` +
      `Without that, auto-learning ships silently broken (v1.5.4 scar).`
  );
});

test('every M16 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M16_PROVIDERS) {
    const file = M16_FILES[provider];
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

test('no M16 file imports its DI target via `import type`', t => {
  const DI_TARGETS = new Set([
    'PrismaClient',
    'AccessController',
    'MnOrgLearningService',
  ]);

  const offenses: string[] = [];
  for (const provider of M16_PROVIDERS) {
    const file = M16_FILES[provider];
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

test('every nullable @Field in DTO has explicit () => Type form (v1.7.0/v1.10.2 scar)', t => {
  let dto = readSource('manut-org-learning.dto.ts');
  // Strip JSDoc / line comments so a docstring example doesn't trip
  // the foot-gun check.
  dto = dto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const offenses: string[] = [];
  for (const m of dto.matchAll(/@Field\s*\(\s*\{[^}]*nullable[^}]*\}\s*\)/g)) {
    offenses.push(
      `manut-org-learning.dto.ts: nullable @Field without explicit type arrow at offset ${m.index}: ${m[0]}`
    );
  }
  t.deepEqual(
    offenses,
    [],
    'shipping nullable @Field without () => Type crashes the server on startup'
  );
});

test('service exports the internal helper surface for tests + diagnostics', t => {
  const src = readSource('manut-org-learning.service.ts');
  t.regex(src, /export\s+const\s+__internal\s*=/);
  t.regex(src, /buildCandidateSlug/);
  t.regex(src, /parseMarker/);
  t.regex(src, /stampMarkerOntoContent/);
});

test('DTO exports MnLearningCandidateStatus enum with the three documented values', t => {
  const src = readSource('manut-org-learning.dto.ts');
  t.regex(src, /enum\s+MnLearningCandidateStatus/);
  t.regex(src, /PENDING\s*=\s*'PENDING'/);
  t.regex(src, /APPROVED\s*=\s*'APPROVED'/);
  t.regex(src, /REJECTED\s*=\s*'REJECTED'/);
});

test('candidate marker uses HTML comment shape — no schema column needed', t => {
  const src = readSource('manut-org-learning.service.ts');
  // The marker is the entire mechanism by which M16 avoids a schema
  // change. If a future refactor moves it elsewhere, the test should
  // fail loudly.
  t.regex(src, /<!--\s+mn-learning-candidate:/);
  t.notRegex(
    readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8'),
    /candidateOf|mn_learning_candidate|MnLearningCandidate\b/,
    'M16 must not add a schema column — owner rule says no Prisma changes'
  );
});

test('resolver gates write mutations on Workspace.Settings.Update', t => {
  const src = readSource('manut-org-learning.resolver.ts');
  // Each write mutation must call .assert('Workspace.Settings.Update').
  // Read query is gated on Workspace.Read.
  const writeAsserts = src.match(/Workspace\.Settings\.Update/g) ?? [];
  t.true(
    writeAsserts.length >= 3,
    `expected 3 mutations gated on Workspace.Settings.Update, found ${writeAsserts.length}`
  );
  t.regex(src, /Workspace\.Read/);
});
