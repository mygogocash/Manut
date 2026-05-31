// SWC-based ESM loader hooks for the ava test runner. See
// swc-esm-register.mjs for why this exists.
//
// `load`  transpiles `.ts`/`.tsx` with SWC, emitting decorator metadata
//         (`legacyDecorator: true, decoratorMetadata: true`) — the same
//         settings production uses — so NestJS @nestjs/graphql can resolve
//         bare `@Field()` decorators. esbuild (the previous `tsx/esm`
//         transpiler) does NOT emit this metadata, which crashed ~180 specs
//         with UndefinedTypeError.
//
// `resolve` reproduces the TypeScript module resolution that Node's default
//         resolver lacks and that `tsx` previously provided for the suite:
//           1. `./foo.js`  -> `./foo.ts` / `./foo.tsx`  (NodeNext-style
//              specifiers that point at the emitted name)
//           2. `./foo`     -> `./foo.ts` / `./foo.tsx`  (extensionless)
//           3. `./dir`     -> `./dir/index.ts` / `index.tsx`  (directory)
//           4. bare pkg failing ERR_MODULE_NOT_FOUND from a `.ts` parent
//              -> retried via `import.meta.resolve`
//         Anything that resolves natively (JSON with import attributes,
//         `.ts`/`.tsx` already on disk, node: builtins, installed packages)
//         is delegated unchanged.
//
// Output GraphQL types are unchanged; this only affects how TS is compiled
// and resolved for the test runner. `@swc/core` is already a hoisted
// monorepo dependency — no new package is added.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { transform } from '@swc/core';

const TS_EXTENSION = /\.tsx?$/;
const RELATIVE = /^\.{1,2}\//;
const BARE = /^[^./]/;

function hrefIfExists(specifier, parentURL) {
  try {
    const candidate = new URL(specifier, parentURL);
    return existsSync(fileURLToPath(candidate)) ? candidate.href : undefined;
  } catch {
    return undefined;
  }
}

function resolveRelativeTs(specifier, parentURL) {
  // 1. `./foo.js` -> `./foo.ts` / `./foo.tsx` (NodeNext emitted-name style)
  const jsMatch = specifier.match(/^(.*)\.jsx?$/);
  if (jsMatch) {
    for (const ext of ['.ts', '.tsx']) {
      const href = hrefIfExists(jsMatch[1] + ext, parentURL);
      if (href) return href;
    }
  }

  // 2. `./foo.ts` / `./foo.tsx` already explicit and on disk
  if (TS_EXTENSION.test(specifier)) {
    return hrefIfExists(specifier, parentURL);
  }

  // 3. extensionless -> `.ts`/`.tsx`, then 4. directory -> index
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const href = hrefIfExists(specifier + suffix, parentURL);
    if (href) return href;
  }

  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  const { parentURL } = context;

  if (RELATIVE.test(specifier) && parentURL) {
    const href = resolveRelativeTs(specifier, parentURL);
    if (href) {
      return { url: href, format: 'module', shortCircuit: true };
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Node's default resolver in a loader chain can fail to walk
    // node_modules from a `.ts` parent URL (ERR_MODULE_NOT_FOUND) even
    // though the package is installed; `import.meta.resolve` handles it.
    if (
      error?.code === 'ERR_MODULE_NOT_FOUND' &&
      BARE.test(specifier) &&
      parentURL
    ) {
      try {
        return {
          url: import.meta.resolve(specifier, parentURL),
          shortCircuit: true,
        };
      } catch {
        // fall through to original error
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:')) {
    return nextLoad(url, context);
  }

  let path;
  try {
    path = fileURLToPath(url);
  } catch {
    return nextLoad(url, context);
  }

  if (!TS_EXTENSION.test(path)) {
    return nextLoad(url, context);
  }

  const source = await readFile(path, 'utf8');
  const isTsx = path.endsWith('.tsx');

  const { code } = await transform(source, {
    filename: path,
    sourceMaps: 'inline',
    isModule: true,
    jsc: {
      target: 'esnext',
      parser: {
        syntax: 'typescript',
        tsx: isTsx,
        decorators: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
        react: {
          runtime: 'automatic',
        },
      },
      keepClassNames: true,
      // Preserve `import x from '...' with { type: 'json' }` attributes;
      // without this SWC strips them and Node throws
      // ERR_IMPORT_ATTRIBUTE_MISSING on JSON imports (e.g. env.ts importing
      // ../package.json).
      experimental: {
        keepImportAttributes: true,
      },
    },
  });

  return {
    format: 'module',
    source: code,
    shortCircuit: true,
  };
}
