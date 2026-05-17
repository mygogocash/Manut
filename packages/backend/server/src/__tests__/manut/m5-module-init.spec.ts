/**
 * M5 module-init static smoke. Mirrors `m4-module-init.spec.ts`:
 * rather than booting the NestJS DI container against a real Postgres,
 * this checks the source files for the two traps that crashed
 * production on the v1.12.0 flip:
 *
 *  1. Every M5 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch.
 *  2. Every M5 provider source file must decorate its class with
 *     `@Injectable()` or `@Resolver()`.
 *  3. No M5 service / resolver may import its DI target via
 *     `import type` (PR #57 incident class).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M5_PROVIDERS = [
  'MnSkillService',
  'MnSkillResolver',
  'MnExportSnapshotService',
] as const;

const M5_FILES: Record<(typeof M5_PROVIDERS)[number], string> = {
  MnSkillService: 'manut-skill.service.ts',
  MnSkillResolver: 'manut-skill.resolver.ts',
  MnExportSnapshotService: 'manut-export-snapshot.service.ts',
};

test('manut.module.ts registers every M5 provider in the enabled branch', t => {
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

  const missing = M5_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M5 providers: ${missing.join(', ')}. ` +
      `Without that, the Skills UI ships silently broken (v1.5.4 scar).`
  );
});

test('every M5 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M5_PROVIDERS) {
    const file = M5_FILES[provider];
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

test('no M5 file imports its DI target via `import type`', t => {
  const offenses: string[] = [];
  for (const provider of M5_PROVIDERS) {
    const file = M5_FILES[provider];
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
      if (typeMatch && typeOnly.has(typeMatch[1])) {
        offenses.push(
          `${file}: constructor parameter type '${typeMatch[1]}' is type-only ` +
            `(NestJS DI will see Object — v1.12.0 scar)`
        );
      }
    }
  }
  t.deepEqual(offenses, [], offenses.join('\n'));
});

test('manut-skill.module.ts wraps the same M5 providers', t => {
  const source = readSource('manut-skill.module.ts');
  for (const provider of M5_PROVIDERS) {
    t.regex(
      source,
      new RegExp(`\\b${provider}\\b`),
      `manut-skill.module.ts should reference ${provider}`
    );
  }
});
