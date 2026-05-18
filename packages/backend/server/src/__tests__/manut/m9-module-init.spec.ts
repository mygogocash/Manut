/**
 * M9 module-init static smoke. Mirrors `m8-module-init.spec.ts`:
 * static source scans for the three traps that have crashed production
 * on past Manut module flips:
 *
 *  1. Every M9 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M9 provider source file must decorate its class with
 *     `@Injectable()` (v1.12.0 DI scar).
 *  3. No M9 service imports its DI target via `import type`
 *     (PR #57 incident class).
 *
 * Also asserts the schema.prisma additions (model + enum) are present.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M9_PROVIDERS = ['MnAgentMemoryService', 'MnAgentMemoryResolver'] as const;

const M9_FILES: Record<(typeof M9_PROVIDERS)[number], string> = {
  MnAgentMemoryService: 'manut-memory.service.ts',
  MnAgentMemoryResolver: 'manut-memory.resolver.ts',
};

test('manut.module.ts registers every M9 provider in the enabled branch', t => {
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

  const missing = M9_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M9 providers: ${missing.join(', ')}. ` +
      `Without that, memory recall ships silently broken (v1.5.4 scar).`
  );
});

test('every M9 provider is decorated with @Injectable() or @Resolver()', t => {
  // The resolver is decorated with @Resolver(...) — that already triggers
  // metadata emission. The service must have @Injectable().
  const offenses: string[] = [];
  for (const provider of M9_PROVIDERS) {
    const file = M9_FILES[provider];
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
    const hasInjectable = /@Injectable\s*\(/.test(window);
    const hasResolver = /@Resolver\s*\(/.test(window);
    if (!hasInjectable && !hasResolver) {
      offenses.push(
        `${file}: ${provider} is missing @Injectable() / @Resolver() (v1.12.0 DI scar)`
      );
    }
  }
  t.deepEqual(offenses, [], offenses.join('\n'));
});

test('no M9 file imports its DI target via `import type`', t => {
  const DI_TARGETS = new Set([
    'PrismaClient',
    'AccessController',
    'MnAgentMemoryService',
  ]);

  const offenses: string[] = [];
  for (const provider of M9_PROVIDERS) {
    const file = M9_FILES[provider];
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

test('schema.prisma adds MnAgentMemory model and MnMemoryKind enum', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnAgentMemory \{/m, 'MnAgentMemory model missing');
  t.regex(schema, /^enum MnMemoryKind \{/m, 'MnMemoryKind enum missing');
  t.regex(schema, /FACT\b/, 'FACT kind missing');
  t.regex(schema, /DECISION\b/, 'DECISION kind missing');
  t.regex(schema, /OBSERVATION\b/, 'OBSERVATION kind missing');
  t.regex(schema, /PLAYBOOK\b/, 'PLAYBOOK kind missing');
});

test('schema.prisma adds back-refs from MnAgent.memories and MnTask.memories', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /memories\s+MnAgentMemory\[\]/);
});

test('every nullable @Field in DTO has explicit () => Type form (v1.7.0/v1.10.2 scar)', t => {
  let dto = readSource('manut-memory.dto.ts');
  // Strip JSDoc / line comments so the warning example inside a docstring
  // doesn't trip the foot-gun check.
  dto = dto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const offenses: string[] = [];
  for (const m of dto.matchAll(/@Field\s*\(\s*\{[^}]*nullable[^}]*\}\s*\)/g)) {
    offenses.push(
      `manut-memory.dto.ts: nullable @Field without explicit type arrow at offset ${m.index}: ${m[0]}`
    );
  }
  t.deepEqual(
    offenses,
    [],
    'shipping nullable @Field without () => Type crashes the server on startup'
  );
});

test('auto-router exports injectMemoryRecall pure helper', t => {
  const src = readFileSync(
    join(process.cwd(), 'src/plugins/copilot/auto-router.ts'),
    'utf8'
  );
  t.regex(src, /export\s+function\s+injectMemoryRecall\s*\(/);
  t.regex(src, /MEMORY_RECALL_INJECTION_CAP/);
});
