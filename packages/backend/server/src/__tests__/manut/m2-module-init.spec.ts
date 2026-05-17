/**
 * Static-analysis smoke test for the M2 goal hierarchy module. Mirrors
 * `m1-agent-module-init.spec.ts`: static-checks the source files for
 * the two DI traps that crashed prod on the v1.12.0 module flip:
 *
 *   1. A class registered in `manut.module.ts` `providers[]` that is
 *      missing `@Injectable()` / `@Resolver()` — TypeScript skips
 *      emitting `design:paramtypes`, NestJS DI silently injects
 *      `undefined`, and the first method call crashes with
 *      `TypeError: Cannot read properties of undefined ...`.
 *
 *   2. A DI target class imported via `import type {...}` from the
 *      module file (or any service / resolver file). The runtime
 *      `design:paramtypes` metadata reflects `Object`, NestJS DI
 *      throws `UnknownDependenciesException` on module init.
 *
 * Also asserts every nullable @Field on the M2 DTOs uses the explicit
 * `() => Type` form (the v1.7.0 / v1.10.2 UndefinedTypeError scar).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const NEW_GOAL_PROVIDERS = [
  'MnGoalService',
  'MnGoalContextService',
  'MnGoalResolver',
] as const;

test('manut.module.ts registers every M2 goal provider', t => {
  const source = readSource('manut.module.ts');
  const stripped = source.replace(/\/\/[^\n]*/g, '');

  const providerListMatches = [
    ...stripped.matchAll(/providers\s*:\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/const\s+providers[^=]*=\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/providers\.push\s*\(([^)]+)\)/g),
  ];
  const knownProviders = new Set<string>();
  for (const matched of providerListMatches) {
    for (const id of matched[1].split(',')) {
      const trimmed = id.trim().split(/\s/)[0];
      if (trimmed) knownProviders.add(trimmed);
    }
  }

  const missing = NEW_GOAL_PROVIDERS.filter(p => !knownProviders.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M2 goal providers: ${missing.join(', ')}.\n` +
      `Without these in the enabled-branch providers list the feature ships ` +
      `silently broken (v1.5.4 half-feature scar).`
  );
});

test('every M2 goal provider source file decorates its class with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];

  const fileMap: Record<(typeof NEW_GOAL_PROVIDERS)[number], string> = {
    MnGoalService: 'manut-goal.service.ts',
    MnGoalContextService: 'manut-goal-context.service.ts',
    MnGoalResolver: 'manut-goal.resolver.ts',
  };

  for (const providerName of NEW_GOAL_PROVIDERS) {
    const file = fileMap[providerName];
    let source: string;
    try {
      source = readSource(file);
    } catch {
      offenses.push(`${providerName}: source file ${file} not found`);
      continue;
    }

    const declRe = new RegExp(
      `(@[A-Za-z_$][A-Za-z0-9_$]*\\([^)]*\\)\\s*)?class\\s+${providerName}\\b`,
      's'
    );
    const declMatch = source.match(declRe);
    if (!declMatch || declMatch.index === undefined) {
      offenses.push(`${file}: class ${providerName} not found`);
      continue;
    }
    const window = source.slice(
      Math.max(0, declMatch.index - 200),
      declMatch.index + 50
    );
    if (!/@Injectable\s*\(/.test(window) && !/@Resolver\s*\(/.test(window)) {
      offenses.push(
        `${file}: ${providerName} found but not decorated with @Injectable() / @Resolver()`
      );
    }
  }

  t.deepEqual(
    offenses,
    [],
    `M2 goal providers must each have @Injectable() / @Resolver():\n${offenses.join('\n')}\n\n` +
      `Without the decorator, TypeScript skips emitting design:paramtypes metadata; ` +
      `NestJS DI then injects 'undefined' as the constructor parameter and the ` +
      `first method call crashes (v1.12.0 production scar).`
  );
});

test('no M2 goal file imports its DI target via `import type`', t => {
  const files = [
    'manut-goal.service.ts',
    'manut-goal-context.service.ts',
    'manut-goal.resolver.ts',
  ];

  const offenses: string[] = [];

  for (const file of files) {
    let src: string;
    try {
      src = readSource(file);
    } catch {
      offenses.push(`${file}: source file not found`);
      continue;
    }
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
          `${file}: constructor parameter type '${typeMatch[1]}' is imported via 'import type'`
        );
      }
    }
  }

  t.deepEqual(
    offenses,
    [],
    `DI target types must be RUNTIME imports (v1.12.0 production scar):\n${offenses.join('\n')}`
  );
});

test('every nullable @Field on M2 DTOs declares an explicit () => Type', t => {
  const rawSrc = readSource('manut-goal.dto.ts');
  const offenses: string[] = [];

  // Strip block comments and line comments first — JSDoc descriptions
  // often reference banned shapes like `@Field({ nullable: true })` as
  // explanation, and we don't want false positives from the prose.
  const src = rawSrc
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '));

  // Match every @Field(...) decorator. Two valid shapes:
  //   @Field(() => Type, { nullable: true })
  //   @Field({ nullable: true }) ← banned when type can't be inferred
  // Reject any @Field(...) that contains `nullable: true` without a `() =>` arrow.
  const fieldRe = /@Field\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRe.exec(src)) !== null) {
    const args = match[1];
    if (/nullable\s*:\s*true/.test(args) && !/=>/.test(args)) {
      const before = src.slice(0, match.index);
      const line = before.split('\n').length;
      offenses.push(
        `manut-goal.dto.ts:${line}: @Field({nullable:true}) without explicit () => Type`
      );
    }
  }

  t.deepEqual(
    offenses,
    [],
    `Every nullable @Field must declare its GraphQL type explicitly ` +
      `via () => Type (v1.7.0 / v1.10.2 UndefinedTypeError scar).\n` +
      offenses.join('\n')
  );
});
