/**
 * M10 module-init static smoke. Mirrors `m9-module-init.spec.ts`:
 * static source scans for the three traps that have crashed production
 * on past Manut module flips:
 *
 *  1. Every M10 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M10 provider source file must decorate its class with
 *     `@Injectable()` or `@Resolver()` (v1.12.0 DI scar).
 *  3. No M10 service / resolver imports its DI target via
 *     `import type` (PR #57 incident class).
 *
 * Also asserts the schema.prisma additions (model + enum + back-refs)
 * and the v1.7.0 / v1.10.2 `@Field` UndefinedTypeError guard on the
 * DTO file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M10_PROVIDERS = [
  'MnWorkProductService',
  'MnWorkProductResolver',
] as const;

const M10_FILES: Record<(typeof M10_PROVIDERS)[number], string> = {
  MnWorkProductService: 'manut-work-product.service.ts',
  MnWorkProductResolver: 'manut-work-product.resolver.ts',
};

test('manut.module.ts registers every M10 provider in the enabled branch', t => {
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

  const missing = M10_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M10 providers: ${missing.join(', ')}. ` +
      `Without that, work products ship silently broken (v1.5.4 scar).`
  );
});

test('every M10 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M10_PROVIDERS) {
    const file = M10_FILES[provider];
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

test('no M10 file imports its DI target via `import type`', t => {
  const DI_TARGETS = new Set([
    'PrismaClient',
    'AccessController',
    'MnWorkProductService',
  ]);

  const offenses: string[] = [];
  for (const provider of M10_PROVIDERS) {
    const file = M10_FILES[provider];
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

test('schema.prisma adds MnWorkProduct model and MnWorkProductKind enum', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnWorkProduct \{/m, 'MnWorkProduct model missing');
  t.regex(
    schema,
    /^enum MnWorkProductKind \{/m,
    'MnWorkProductKind enum missing'
  );
  for (const kind of [
    'DOC',
    'FILE',
    'URL',
    'PR',
    'DEPLOYMENT',
    'CSV',
    'SCREENSHOT',
  ]) {
    t.regex(schema, new RegExp(`\\b${kind}\\b`), `${kind} kind missing`);
  }
});

test('schema.prisma adds back-refs from MnTask.workProducts and MnAgent.workProducts', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  // MnTask.workProducts — Cascade on task delete
  t.regex(
    schema,
    /workProducts\s+MnWorkProduct\[\]/,
    'workProducts back-ref missing'
  );
  // MnAgent.workProducts uses a named relation so the producedByAgentId
  // FK can be unambiguous if another back-ref appears later.
  t.regex(
    schema,
    /workProducts[^\n]*@relation\("MnWorkProductProducedBy"\)/,
    'MnAgent.workProducts named-relation back-ref missing'
  );
});

test('every nullable @Field in DTO has explicit () => Type form (v1.7.0/v1.10.2 scar)', t => {
  let dto = readSource('manut-work-product.dto.ts');
  // Strip JSDoc / line comments so a warning example inside a docstring
  // doesn't trip the foot-gun check.
  dto = dto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const offenses: string[] = [];
  for (const m of dto.matchAll(/@Field\s*\(\s*\{[^}]*nullable[^}]*\}\s*\)/g)) {
    offenses.push(
      `manut-work-product.dto.ts: nullable @Field without explicit type arrow at offset ${m.index}: ${m[0]}`
    );
  }
  t.deepEqual(
    offenses,
    [],
    'shipping nullable @Field without () => Type crashes the server on startup'
  );
});
