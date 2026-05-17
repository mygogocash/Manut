/**
 * Static-analysis smoke test for the M3 approval module. Mirrors the
 * existing `m1-agent-module-init.spec.ts` pattern: it static-checks
 * the source files for the same two traps that crashed production on
 * the v1.12.0 module flip:
 *
 *   1. A class registered in `manut.module.ts` `providers[]` that is
 *      missing `@Injectable()` / `@Resolver()` decoration. TypeScript
 *      skips emitting `design:paramtypes`, NestJS silently injects
 *      `undefined`, and the first method call crashes.
 *
 *   2. A DI target class imported via `import type {...}`. The
 *      runtime `design:paramtypes` metadata reflects `Object`, NestJS
 *      DI throws `UnknownDependenciesException` on module init.
 *
 * Both traps are also enforced for ALL Manut files by
 * `di-metadata-guard.spec.ts`; this spec adds an M3-specific positive
 * assertion that every approval provider really does appear in the
 * `manut.module.ts` enabled-branch providers list, so a future
 * refactor that accidentally drops one fails the build instead of
 * shipping a silent half-feature (the v1.5.4 consolidation scar).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import test from 'ava';

const manutDir = join(process.cwd(), 'src/plugins/manut');

function readSource(file: string): string {
  return readFileSync(join(manutDir, file), 'utf8');
}

const NEW_APPROVAL_PROVIDERS = [
  'MnApprovalGateService',
  'MnApprovalService',
  'MnApprovalCommentService',
  'MnApprovalResolver',
  'MnApprovalStaleCron',
  'MnApprovalEventBus',
] as const;

test('manut.module.ts registers every M3 approval provider', t => {
  const source = readSource('manut.module.ts');
  const providerArrays = [...source.matchAll(/providers\s*:\s*\[([^\]]+)\]/g)];
  t.true(providerArrays.length >= 1, 'sanity: providers block exists');

  // Strip `// ...` line comments BEFORE we split on commas — comment
  // bodies routinely contain commas, which otherwise smear the
  // provider name onto the comment text and cause false negatives.
  // (Same defensive split as `m1-agent-module-init.spec.ts`.)
  const stripped = source.replace(/\/\/[^\n]*/g, '');

  const providerListMatches = [
    ...stripped.matchAll(/providers\s*:\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/const\s+providers[^=]*=\s*\[([^\]]+)\]/g),
    ...stripped.matchAll(/providers\.push\s*\(([^)]+)\)/g),
  ];
  const knownProviders = new Set<string>();
  for (const match of providerListMatches) {
    for (const id of match[1].split(',')) {
      const trimmed = id.trim().split(/\s/)[0];
      if (trimmed) knownProviders.add(trimmed);
    }
  }

  const missing = NEW_APPROVAL_PROVIDERS.filter(p => !knownProviders.has(p));
  t.deepEqual(
    missing,
    [],
    `manut.module.ts is missing M3 approval providers: ${missing.join(', ')}.\n` +
      `Add them to the enabled-branch providers list — without that, the ` +
      `feature ships silently broken (the v1.5.4 half-feature scar).`
  );
});

test('manut.module.ts registers the M3 SSE controller', t => {
  const source = readSource('manut.module.ts');
  // The controller is registered via `controllers: [MnApprovalsStreamController]`.
  t.regex(
    source,
    /controllers\s*:\s*\[\s*MnApprovalsStreamController\b/,
    'manut.module.ts should register MnApprovalsStreamController in the controllers[] array.'
  );
});

test('every M3 provider source file decorates its class with @Injectable() or @Resolver()', t => {
  const offenses: string[] = [];

  for (const providerName of NEW_APPROVAL_PROVIDERS) {
    // Map ClassName -> file naming convention used in this codebase.
    // Approval files live at:
    //   - manut-approval.service.ts        (MnApprovalService)
    //   - manut-approval.resolver.ts       (MnApprovalResolver)
    //   - manut-approval-comment.service.ts (MnApprovalCommentService)
    //   - manut-approval-gate.service.ts   (MnApprovalGateService)
    //   - manut-approval-stale.cron.ts     (MnApprovalStaleCron)
    //   - manut-approvals-stream.controller.ts (MnApprovalEventBus,
    //                                           MnApprovalsStreamController)
    const fileGuesses: string[] = [];
    if (providerName === 'MnApprovalService') {
      fileGuesses.push('manut-approval.service.ts');
    } else if (providerName === 'MnApprovalResolver') {
      fileGuesses.push('manut-approval.resolver.ts');
    } else if (providerName === 'MnApprovalCommentService') {
      fileGuesses.push('manut-approval-comment.service.ts');
    } else if (providerName === 'MnApprovalGateService') {
      fileGuesses.push('manut-approval-gate.service.ts');
    } else if (providerName === 'MnApprovalStaleCron') {
      fileGuesses.push('manut-approval-stale.cron.ts');
    } else if (providerName === 'MnApprovalEventBus') {
      fileGuesses.push('manut-approvals-stream.controller.ts');
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
    `M3 approval providers must each have @Injectable() / @Resolver():\n${offenses.join('\n')}\n\n` +
      `Without the decorator, TypeScript skips emitting design:paramtypes metadata; ` +
      `NestJS DI then injects 'undefined' as the constructor parameter and the ` +
      `first method call crashes (v1.12.0 production scar).`
  );
});

test('no M3 approval file imports its DI target via `import type`', t => {
  const sources = readdirSync(manutDir).filter(
    f =>
      f.startsWith('manut-approval') &&
      (f.endsWith('.service.ts') ||
        f.endsWith('.resolver.ts') ||
        f.endsWith('.cron.ts') ||
        f.endsWith('.controller.ts'))
  );
  t.true(sources.length >= 5, 'sanity: M3 approval files present');

  const offenses: string[] = [];

  for (const file of sources) {
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

test('manut-approval.module.ts exports a forRoot() with the same provider list', t => {
  const source = readSource('manut-approval.module.ts');
  t.regex(source, /forRoot\s*\(\s*\)/);
  for (const provider of NEW_APPROVAL_PROVIDERS) {
    t.regex(
      source,
      new RegExp(`\\b${provider}\\b`),
      `manut-approval.module.ts should reference ${provider}`
    );
  }
});

test('schema.prisma has the MnApproval + MnApprovalComment models and the two enums', t => {
  const schema = readFileSync(join(process.cwd(), 'schema.prisma'), 'utf8');
  t.regex(schema, /^model MnApproval\b/m, 'MnApproval model present');
  t.regex(
    schema,
    /^model MnApprovalComment\b/m,
    'MnApprovalComment model present'
  );
  t.regex(schema, /^enum MnApprovalType\b/m, 'MnApprovalType enum present');
  t.regex(schema, /^enum MnApprovalStatus\b/m, 'MnApprovalStatus enum present');
});
