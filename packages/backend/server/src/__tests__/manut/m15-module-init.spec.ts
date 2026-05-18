/**
 * M15 module-init static smoke. Same pattern as m11-module-init.spec.ts:
 * scans source files for the three traps that have crashed production
 * on past Manut module flips:
 *
 *  1. Every M15 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M15 provider source file must decorate its class with
 *     `@Injectable()` / `@Resolver()` (v1.12.0 DI scar).
 *  3. No M15 service / resolver imports its DI target via
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

const M15_PROVIDERS = ['MnOrgChangeService', 'MnOrgChangeResolver'] as const;

const M15_FILES: Record<(typeof M15_PROVIDERS)[number], string> = {
  MnOrgChangeService: 'manut-org-change.service.ts',
  MnOrgChangeResolver: 'manut-org-change.resolver.ts',
};

test('manut.module.ts registers every M15 provider in the enabled branch', t => {
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

  const missing = M15_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M15 providers: ${missing.join(', ')}. ` +
      `Without that, the self-organization surface ships silently broken (v1.5.4 scar).`
  );
});

test('every M15 provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M15_PROVIDERS) {
    const file = M15_FILES[provider];
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

test('no M15 file imports its DI target via `import type`', t => {
  // PrismaClient + MnOrgChangeService + AccessController are the DI
  // targets we want runtime-imported on the M15 surface.
  const DI_TARGETS = new Set([
    'PrismaClient',
    'MnOrgChangeService',
    'AccessController',
  ]);

  const offenses: string[] = [];
  for (const provider of M15_PROVIDERS) {
    const file = M15_FILES[provider];
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

test('schema.prisma defines MnOrgChange model + MnOrgChangeType + MnOrgChangeStatus enums', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnOrgChange \{/m);
  t.regex(schema, /^enum MnOrgChangeType \{/m);
  t.regex(schema, /^enum MnOrgChangeStatus \{/m);
  // All six MnOrgChangeType members.
  for (const kind of [
    'ROLE_ADJUSTMENT',
    'DELEGATION_CHANGE',
    'NEW_ROUTINE',
    'AGENT_HIRE_PROPOSAL',
    'REPORTING_CHANGE',
    'CAPABILITY_GRANT',
  ]) {
    t.regex(
      schema,
      new RegExp(`\\b${kind}\\b`),
      `MnOrgChangeType missing ${kind}`
    );
  }
});

test('schema.prisma sets SetNull on proposedByAgentId + decidedByUserId', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  // The relation lines on MnOrgChange must use SetNull so audit
  // history survives proposer / decider deletion (CLAUDE.md §6).
  t.regex(
    schema,
    /proposedByAgent[\s\S]*?MnOrgChangeProposedByAgent[\s\S]*?onDelete: SetNull/
  );
  t.regex(
    schema,
    /decidedByUser[\s\S]*?MnOrgChangeDecidedByUser[\s\S]*?onDelete: SetNull/
  );
});
