/**
 * M8 module-init static smoke. Mirrors `m7-module-init.spec.ts`:
 * static source scans for the three traps that have crashed production
 * on past Manut module flips:
 *
 *  1. Every M8 provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (v1.5.4 half-feature scar).
 *  2. Every M8 provider source file must decorate its class with
 *     `@Injectable()` (v1.12.0 DI scar).
 *  3. No M8 service imports its DI target via `import type`
 *     (PR #57 incident class).
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

const M8_PROVIDERS = [
  'MnE2bAdapter',
  'MnCursorCloudAdapter',
  'MnHttpWebhookAdapter',
  'MnProcessAdapter',
  'MnAdapterRegistryService',
] as const;

const M8_FILES: Record<(typeof M8_PROVIDERS)[number], string> = {
  MnE2bAdapter: 'adapters/manut-e2b-adapter.service.ts',
  MnCursorCloudAdapter: 'adapters/manut-cursor-cloud-adapter.service.ts',
  MnHttpWebhookAdapter: 'adapters/manut-http-webhook-adapter.service.ts',
  MnProcessAdapter: 'adapters/manut-process-adapter.service.ts',
  MnAdapterRegistryService: 'adapters/manut-adapter-registry.service.ts',
};

test('manut.module.ts registers every M8 provider in the enabled branch', t => {
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

  const missing = M8_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M8 providers: ${missing.join(', ')}. ` +
      `Without that, cloud / sandbox adapters ship silently broken (v1.5.4 scar).`
  );
});

test('every M8 provider is decorated with @Injectable()', t => {
  const offenses: string[] = [];
  for (const provider of M8_PROVIDERS) {
    const file = M8_FILES[provider];
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
    if (!/@Injectable\s*\(/.test(window)) {
      offenses.push(
        `${file}: ${provider} is missing @Injectable() (v1.12.0 DI scar)`
      );
    }
  }
  t.deepEqual(offenses, [], offenses.join('\n'));
});

test('no M8 file imports its DI target via `import type`', t => {
  // All four adapters + the registry have NestJS DI deps (the
  // registry's four adapter children). Each must be a runtime import
  // — never `import type` — so `design:paramtypes` metadata is
  // emitted (v1.12.0 scar).
  const DI_TARGETS = new Set([
    'MnE2bAdapter',
    'MnCursorCloudAdapter',
    'MnHttpWebhookAdapter',
    'MnProcessAdapter',
  ]);

  const offenses: string[] = [];
  for (const provider of M8_PROVIDERS) {
    const file = M8_FILES[provider];
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

test('schema.prisma adds the four new MnAgentAdapterType enum variants', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /E2B_SANDBOX/, 'E2B_SANDBOX enum value missing');
  t.regex(schema, /CURSOR_CLOUD/, 'CURSOR_CLOUD enum value missing');
  t.regex(schema, /HTTP_WEBHOOK/, 'HTTP_WEBHOOK enum value missing');
  t.regex(schema, /PROCESS_COMMAND/, 'PROCESS_COMMAND enum value missing');
});

test('migration file exists with ENUM ADD VALUE statements', t => {
  const migrationPath = join(
    process.cwd(),
    'migrations/20260518150000_add_mn_m8_adapter_types/migration.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');
  t.regex(
    sql,
    /ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'E2B_SANDBOX'/
  );
  t.regex(
    sql,
    /ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'CURSOR_CLOUD'/
  );
  t.regex(
    sql,
    /ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'HTTP_WEBHOOK'/
  );
  t.regex(
    sql,
    /ALTER TYPE "MnAgentAdapterType" ADD VALUE IF NOT EXISTS 'PROCESS_COMMAND'/
  );
});

test('every adapter has at least one SECRET_KEYS scrubber declaration', t => {
  // Static scan: each non-process adapter must reference scrubSecrets
  // at least once (so any future log line that adds plaintext config
  // is forced to think about the secret-scrub path).
  const requiresScrub = [
    'manut-e2b-adapter.service.ts',
    'manut-cursor-cloud-adapter.service.ts',
    'manut-http-webhook-adapter.service.ts',
    'manut-process-adapter.service.ts',
  ];

  const offenses: string[] = [];
  for (const file of requiresScrub) {
    const src = readSource(`adapters/${file}`);
    if (!/SECRET_KEYS/.test(src)) {
      offenses.push(`${file}: missing SECRET_KEYS declaration`);
    }
    if (!/scrubSecrets/.test(src)) {
      offenses.push(`${file}: never calls scrubSecrets`);
    }
  }
  t.deepEqual(offenses, [], offenses.join('\n'));
});
