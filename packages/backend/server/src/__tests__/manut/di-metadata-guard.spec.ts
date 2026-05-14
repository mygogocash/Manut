/**
 * Static-analysis guard against the two NestJS DI metadata traps that
 * crashed production on the v1.12.0 ENABLE_MANUT_MODULE flip:
 *
 * 1. Class injected via constructor parameter imported as `import type`
 *    -> `design:paramtypes` reflects `Object` -> UnknownDependenciesException
 *    (PR #57 incident — MnAgentRegistryService + PrismaClient).
 *
 * 2. Class registered in `providers[]` array but missing `@Injectable()`
 *    decoration -> TS skips emitting `design:paramtypes` metadata ->
 *    constructor parameter resolves to `undefined` at runtime -> first
 *    method call crashes
 *    (PR #58 incident — SuperflowFeatureRegistrar + ServerService).
 *
 * Runtime testing modules don't catch these reliably because they
 * mock dependencies away. Static checks on the source files are
 * cheap, deterministic, and run on every PR.
 *
 * See CLAUDE.md §5 traps for the full incident write-up.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

function listManutSources(): string[] {
  return readdirSync(manutDir).filter(
    f =>
      (f.endsWith('.service.ts') ||
        f.endsWith('.resolver.ts') ||
        f.endsWith('.module.ts') ||
        f.endsWith('.cron.ts') ||
        f.endsWith('.job.ts')) &&
      !f.endsWith('.spec.ts') &&
      !f.endsWith('.d.ts')
  );
}

/**
 * Extract class names appearing as constructor parameter types.
 *   constructor(private readonly db: PrismaClient, public x: Foo) -> ['PrismaClient', 'Foo']
 */
function extractConstructorParamTypes(source: string): string[] {
  const out: string[] = [];
  const ctorMatch = source.match(/constructor\s*\(([\s\S]*?)\)\s*\{/);
  if (!ctorMatch) return out;
  const body = ctorMatch[1];
  for (const param of body.split(',')) {
    const typeMatch = param.match(/:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (typeMatch) {
      out.push(typeMatch[1]);
    }
  }
  return out;
}

/**
 * Extract every imported identifier flagged as type-only - anything
 * from a `import type {...}` declaration OR with an inline `type`
 * specifier like `import { type Foo, Bar }`.
 */
function extractTypeOnlyImports(source: string): Set<string> {
  const out = new Set<string>();

  const wholeTypeMatches = source.matchAll(
    /import\s+type\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g
  );
  for (const m of wholeTypeMatches) {
    for (const id of m[1].split(',')) {
      const trimmed = id.trim().split(/\s+as\s+/)[0];
      if (trimmed) out.add(trimmed);
    }
  }

  const inlineMatches = source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g
  );
  for (const m of inlineMatches) {
    for (const id of m[1].split(',')) {
      const trimmed = id.trim();
      if (trimmed.startsWith('type ')) {
        const name = trimmed
          .slice(5)
          .trim()
          .split(/\s+as\s+/)[0];
        if (name) out.add(name);
      }
    }
  }

  return out;
}

/**
 * Trap #1: PR #57 — every constructor parameter type must be a runtime
 * import, not `import type`. Otherwise NestJS DI sees `Object` and
 * throws UnknownDependenciesException at module init.
 */
test('no constructor parameter type is imported via `import type`', t => {
  const offenses: string[] = [];

  for (const file of listManutSources()) {
    const source = readSource(file);
    if (!source.includes('constructor(')) continue;

    const typeOnly = extractTypeOnlyImports(source);
    if (typeOnly.size === 0) continue;

    const ctorTypes = extractConstructorParamTypes(source);
    for (const typeName of ctorTypes) {
      if (typeOnly.has(typeName)) {
        offenses.push(
          `${file}: constructor parameter type '${typeName}' is imported as 'import type' - NestJS DI will see 'Object' at runtime`
        );
      }
    }
  }

  t.deepEqual(
    offenses,
    [],
    `Found type-only imports used as DI targets:\n${offenses.join('\n')}\n\n` +
      `Fix: change to a runtime import:\n` +
      `  WRONG: import type { PrismaClient } from '@prisma/client';\n` +
      `  RIGHT: import { PrismaClient } from '@prisma/client';\n` +
      `Keep 'import type' for pure-type usages (row types, return types).`
  );
});

/**
 * Trap #2: PR #58 — every class registered in `providers[]` in
 * `manut.module.ts` must be decorated with `@Injectable()` (or
 * `@Resolver()` which also emits the design:paramtypes metadata).
 * Without that decoration, constructor parameters silently resolve
 * to `undefined` and crash on first method call.
 */
test('every provider in manut.module.ts has @Injectable() or @Resolver()', t => {
  const moduleSource = readSource('manut.module.ts');

  const providers = new Set<string>();
  const providerArrayMatches = moduleSource.matchAll(
    /providers\s*:\s*\[([^\]]+)\]/g
  );
  for (const m of providerArrayMatches) {
    for (const id of m[1].split(',')) {
      const trimmed = id.trim();
      if (!trimmed || trimmed.startsWith('...') || trimmed.includes('{'))
        continue;
      providers.add(trimmed);
    }
  }

  t.true(providers.size > 0, 'sanity: discovered at least one provider');

  const offenses: string[] = [];

  for (const providerName of providers) {
    const importRe = new RegExp(
      `import\\s*\\{[^}]*\\b${providerName}\\b[^}]*\\}\\s*from\\s*['"]\\.\\/([^'"]+)['"]`
    );
    const importMatch = moduleSource.match(importRe);

    let definingFile: string;
    let definingSource: string;

    if (importMatch) {
      definingFile = importMatch[1].endsWith('.ts')
        ? importMatch[1]
        : `${importMatch[1]}.ts`;
      try {
        definingSource = readSource(definingFile);
      } catch {
        definingFile = 'manut.module.ts';
        definingSource = moduleSource;
      }
    } else {
      definingFile = 'manut.module.ts';
      definingSource = moduleSource;
    }

    const classDeclRe = new RegExp(
      `(@[A-Za-z_$][A-Za-z0-9_$]*\\([^)]*\\)\\s*)?class\\s+${providerName}\\b`,
      's'
    );
    const declMatch = definingSource.match(classDeclRe);

    if (!declMatch || declMatch.index === undefined) {
      offenses.push(`${providerName}: class declaration not found`);
      continue;
    }

    const decoratorWindow = definingSource.slice(
      Math.max(0, declMatch.index - 200),
      declMatch.index + 50
    );

    const hasInjectable =
      /@Injectable\s*\(/.test(decoratorWindow) ||
      /@Resolver\s*\(/.test(decoratorWindow);

    if (!hasInjectable) {
      offenses.push(
        `${definingFile}: class '${providerName}' is in providers[] but has no @Injectable() / @Resolver() decoration`
      );
    }
  }

  t.deepEqual(
    offenses,
    [],
    `Found undecorated providers (will crash with undefined constructor params at runtime):\n${offenses.join('\n')}\n\n` +
      `Fix: add @Injectable() above the class declaration. Required so TypeScript emits the design:paramtypes metadata NestJS DI needs.`
  );
});
