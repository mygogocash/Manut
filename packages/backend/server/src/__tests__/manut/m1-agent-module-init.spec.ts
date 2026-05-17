/**
 * Static-analysis smoke test for the M1 agent identity module. Mirrors
 * the existing `di-metadata-guard.spec.ts` pattern: rather than booting
 * the full NestJS DI container against a real Postgres (which a unit
 * test can't reliably set up in this codebase — see the test patterns
 * in routine-pipeline.spec.ts), it static-checks the source files for
 * the exact two traps that crashed production on the v1.12.0 module
 * flip:
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
 * These two static checks are also enforced for ALL Manut files by
 * `di-metadata-guard.spec.ts`; this spec adds an M1-specific
 * positive assertion that the four new agent-identity providers
 * really do appear in the `manut.module.ts` providers list, so a
 * future refactor that accidentally drops one (the v1.5.4
 * consolidation scar) fails the build instead of shipping a silent
 * half-feature.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const NEW_AGENT_PROVIDERS = [
  'MnAgentService',
  'MnAgentResolver',
  'MnAgentApiKeyService',
  'MnAgentApiKeyResolver',
  'MnHeartbeatService',
] as const;

test('manut.module.ts registers every M1 agent identity provider', t => {
  const source = readSource('manut.module.ts');
  // Pull providers list from the ENABLED branch (the second
  // `providers: [...]` block in the file).
  const providerArrays = [...source.matchAll(/providers\s*:\s*\[([^\]]+)\]/g)];
  t.true(providerArrays.length >= 1, 'sanity: providers block exists');

  // Concatenate every providers block — the enabled branch builds the
  // array imperatively via `const providers: any[] = [...]` then
  // `providers.push(...)`, so we also need to scan that statement.
  // Strip `// ...` line comments BEFORE we split on commas — comment
  // bodies routinely contain commas, which otherwise smear the
  // provider name onto the comment text and cause false negatives.
  const stripped = source.replace(/\/\/[^\n]*/g, '');

  const providerListMatches = [
    ...stripped.matchAll(/providers\s*:\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/const\s+providers[^=]*=\s*\[([^\]]+)\]/g),
    // The enabled branch builds the list imperatively via
    // `providers.push(MnFoo, MnBar)` — pick those up too.
    ...stripped.matchAll(/providers\.push\s*\(([^)]+)\)/g),
  ];
  const knownProviders = new Set<string>();
  for (const match of providerListMatches) {
    for (const id of match[1].split(',')) {
      const trimmed = id.trim().split(/\s/)[0];
      if (trimmed) knownProviders.add(trimmed);
    }
  }

  const missing = NEW_AGENT_PROVIDERS.filter(p => !knownProviders.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M1 agent providers: ${missing.join(', ')}.\n` +
      `Add them to the enabled-branch providers list — without that, the ` +
      `feature ships silently broken (the v1.5.4 half-feature scar).`
  );
});

test('every M1 agent provider source file decorates its class with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];

  for (const providerName of NEW_AGENT_PROVIDERS) {
    // Map ClassName -> file naming convention used in this codebase.
    // Services end in `.service.ts`, resolvers in `.resolver.ts`,
    // and the file basename is the lowercased class name with
    // dashes inserted before each Mn-prefixed cap segment.
    const fileGuesses = [
      `manut-agent.${providerName.toLowerCase().includes('apikey') ? 'api-key' : providerName.toLowerCase().includes('heartbeat') ? 'heartbeat' : 'agent'}${
        providerName.endsWith('Service') ? '.service.ts' : '.resolver.ts'
      }`,
    ];
    // Heartbeat doesn't follow the manut-agent.* pattern; it lives at
    // manut-heartbeat.service.ts.
    if (providerName === 'MnHeartbeatService') {
      fileGuesses.length = 0;
      fileGuesses.push('manut-heartbeat.service.ts');
    } else if (providerName === 'MnAgentService') {
      fileGuesses.length = 0;
      fileGuesses.push('manut-agent.service.ts');
    } else if (providerName === 'MnAgentResolver') {
      fileGuesses.length = 0;
      fileGuesses.push('manut-agent.resolver.ts');
    } else if (providerName === 'MnAgentApiKeyService') {
      fileGuesses.length = 0;
      fileGuesses.push('manut-agent-api-key.service.ts');
    } else if (providerName === 'MnAgentApiKeyResolver') {
      fileGuesses.length = 0;
      fileGuesses.push('manut-agent-api-key.resolver.ts');
    }

    let found = false;
    for (const file of fileGuesses) {
      try {
        const source = readSource(file);
        const declRe = new RegExp(
          `(@[A-Za-z_$][A-Za-z0-9_$]*\\([^)]*\\)\\s*)?class\\s+${providerName}\\b`,
          's'
        );
        const declMatch = source.match(declRe);
        if (!declMatch || declMatch.index === undefined) continue;
        const window = source.slice(
          Math.max(0, declMatch.index - 200),
          declMatch.index + 50
        );
        if (/@Injectable\s*\(/.test(window) || /@Resolver\s*\(/.test(window)) {
          found = true;
          break;
        } else {
          offenses.push(
            `${file}: ${providerName} found but not decorated with @Injectable() / @Resolver()`
          );
        }
      } catch {
        /* file did not exist — try next guess */
      }
    }
    if (!found && offenses.length === 0) {
      offenses.push(
        `${providerName}: could not locate its source file in ${manutDir}`
      );
    }
  }

  t.deepEqual(
    offenses,
    [],
    `M1 agent identity providers must each have @Injectable() / @Resolver():\n${offenses.join('\n')}\n\n` +
      `Without the decorator, TypeScript skips emitting design:paramtypes metadata; ` +
      `NestJS DI then injects 'undefined' as the constructor parameter and the ` +
      `first method call crashes (v1.12.0 production scar).`
  );
});

test('no M1 agent identity file imports its DI target via `import type`', t => {
  const sources = readdirSync(manutDir).filter(
    f =>
      (f.startsWith('manut-agent') || f.startsWith('manut-heartbeat')) &&
      (f.endsWith('.service.ts') || f.endsWith('.resolver.ts'))
  );
  t.true(sources.length >= 5, 'sanity: M1 agent files present');

  const offenses: string[] = [];

  for (const file of sources) {
    const src = readSource(file);
    // Pull every `import type { Foo, Bar } from ...` identifier into
    // a set, then look for any of them appearing as a constructor
    // parameter type. Mirrors di-metadata-guard.spec.ts logic.
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

test('manut-agent.module.ts exports a forRoot() with the same provider list', t => {
  const source = readSource('manut-agent.module.ts');
  t.regex(source, /forRoot\s*\(\s*\)/);
  for (const provider of NEW_AGENT_PROVIDERS) {
    t.regex(
      source,
      new RegExp(`\\b${provider}\\b`),
      `manut-agent.module.ts should reference ${provider}`
    );
  }
});
