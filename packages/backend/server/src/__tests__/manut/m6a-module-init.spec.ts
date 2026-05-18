/**
 * M6a module-init static smoke. Mirrors `m5-module-init.spec.ts`:
 * rather than booting the NestJS DI container against a real Postgres,
 * this checks the source files for the three traps that have crashed
 * production on past Manut module flips:
 *
 *  1. Every M6a provider registered in `manut.module.ts` `providers[]`
 *     must appear in the enabled branch (the v1.5.4 half-feature scar).
 *  2. Every M6a provider source file must decorate its class with
 *     `@Injectable()` or `@Resolver()` (the v1.12.0 DI scar).
 *  3. No M6a service / resolver may import its DI target via
 *     `import type` (PR #57 incident class).
 *
 * Also asserts that the standalone `ManutPluginModule` wrapper
 * references the same provider set, so a future operator who opts in
 * via the standalone module gets the same wiring as the umbrella.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const M6A_PROVIDERS = [
  'ManutPluginSupervisorService',
  'ManutPluginHostRpcService',
  'ManutPluginInstallerService',
  'ManutPluginRuntimeService',
  'ManutPluginResolver',
] as const;

const M6A_FILES: Record<(typeof M6A_PROVIDERS)[number], string> = {
  ManutPluginSupervisorService:
    'plugin-runtime/manut-plugin-supervisor.service.ts',
  ManutPluginHostRpcService: 'plugin-runtime/manut-plugin-host-rpc.service.ts',
  ManutPluginInstallerService:
    'plugin-runtime/manut-plugin-installer.service.ts',
  ManutPluginRuntimeService: 'plugin-runtime/manut-plugin-runtime.service.ts',
  ManutPluginResolver: 'plugin-runtime/manut-plugin.resolver.ts',
};

test('manut.module.ts registers every M6a provider in the enabled branch', t => {
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

  const missing = M6A_PROVIDERS.filter(p => !known.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M6a providers: ${missing.join(', ')}. ` +
      `Without that, the plugin runtime ships silently broken (v1.5.4 scar).`
  );
});

test('manut.module.ts registers ManutPluginRoutesController in controllers[]', t => {
  const source = readSource('manut.module.ts');
  t.regex(
    source,
    /controllers\s*:\s*\[[^\]]*ManutPluginRoutesController/,
    'plugin-scoped routes mount must be registered in controllers[]'
  );
});

test('every M6a provider is decorated with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];
  for (const provider of M6A_PROVIDERS) {
    const file = M6A_FILES[provider];
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

test('no M6a file imports its DI target via `import type`', t => {
  // The DI targets we want to guarantee are runtime imports inside
  // each M6a class constructor. PrismaClient is the most common, but
  // the runtime service also depends on three other Manut services
  // — all must be runtime imports.
  const DI_TARGETS = new Set([
    'PrismaClient',
    'ManutPluginHostRpcService',
    'ManutPluginInstallerService',
    'ManutPluginSupervisorService',
    'ManutPluginRuntimeService',
  ]);

  const offenses: string[] = [];
  for (const provider of M6A_PROVIDERS) {
    const file = M6A_FILES[provider];
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

test('plugin-runtime/manut-plugin.module.ts wraps the same M6a providers', t => {
  const source = readSource('plugin-runtime/manut-plugin.module.ts');
  for (const provider of M6A_PROVIDERS) {
    t.regex(
      source,
      new RegExp(`\\b${provider}\\b`),
      `manut-plugin.module.ts should reference ${provider}`
    );
  }
});

test('schema.prisma defines MnPlugin, MnPluginConfig, MnPluginStatus', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnPlugin\b/m, 'MnPlugin model missing');
  t.regex(schema, /^model MnPluginConfig\b/m, 'MnPluginConfig model missing');
  t.regex(schema, /^enum MnPluginStatus\b/m, 'MnPluginStatus enum missing');
});
