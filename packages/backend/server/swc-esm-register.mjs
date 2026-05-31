// Registers the SWC ESM loader hooks (see swc-esm-loader.mjs) for the ava
// test runner. Passed to Node via `--import` from ava.config.js.
//
// Why this exists: the ava runner previously ran `--import tsx/esm`. tsx
// transpiles via esbuild, which does NOT emit `emitDecoratorMetadata`
// (`design:type`). NestJS @nestjs/graphql needs that runtime metadata to
// resolve bare `@Field()` decorators, so ~180 e2e/spec files crashed at
// module load with `UndefinedTypeError` (AdminWorkspace.id, UserType.name,
// ...). Production is unaffected — it builds via SWC/rspack, which emits
// decorator metadata. This loader transpiles TS with SWC instead, emitting
// the metadata NestJS needs. `@swc/core` is already a hoisted monorepo
// dependency — no new package is added.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./swc-esm-loader.mjs', pathToFileURL('./'));
