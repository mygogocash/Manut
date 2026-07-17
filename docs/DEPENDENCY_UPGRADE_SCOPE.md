# Dependency upgrade and replacement scope

This document records the current direct-dependency state of the replacement checkout against the approved upgrade plan. It distinguishes implemented changes from compatibility holds, legacy bridge dependencies, missing target packages, and Phase 2 mobile packages.

## Audit basis

- Direct manifests inspected: root plus every `apps/*` and `packages/*` `package.json`.
- Lockfile check: `pnpm install --frozen-lockfile` passed under the approved runtime.
- Package manager: `pnpm@11.13.1`.
- Required runtime: Node `>=24.18.0`.
- Local audit runtime: Node `v24.18.0` with pnpm `11.13.1`.
- “Present” below means the requested direct version or Expo-compatible range is in a manifest and represented by the current lockfile. It does not imply that every full-repository gate is green.

## State legend

- **upgraded**: requested target version is present.
- **compatibility pin**: deliberately held at the approved ecosystem-compatible version.
- **removed**: no direct manifest retains the package.
- **deferred legacy bridge**: retained only while the legacy web application remains the parity reference; remove after every approved route has equivalent Expo behavior and browser E2E.
- **present, use deferred**: installed for the approved target but intentionally
  not imported until its credential or runtime boundary exists.
- **Phase 2 deferred**: intentionally absent until its mobile feature is implemented.

## Upgrade now

### Runtime and data

| Package                  |     Planned change | Current direct version | State    |
| ------------------------ | -----------------: | ---------------------: | -------- |
| `@prisma/client`         |     6.19.3 → 7.8.0 |                  7.8.0 | upgraded |
| `prisma`                 |     6.19.3 → 7.8.0 |                  7.8.0 | upgraded |
| `zod`                    |    3.25.76 → 4.4.3 |                  4.4.3 | upgraded |
| `@supabase/supabase-js`  |  2.104.1 → 2.110.7 |                2.110.7 | upgraded |
| `cookie`                 |      1.1.1 → 2.0.1 |                  2.0.1 | upgraded |
| `date-fns`               |      4.1.0 → 4.4.0 |                  4.4.0 | upgraded |
| `sanitize-html`          |    2.17.4 → 2.17.6 |                 2.17.6 | upgraded |
| `google-auth-library`    |    10.6.2 → 10.9.0 |                 10.9.0 | upgraded |
| `helmet`                 |      8.1.0 → 8.3.0 |                  8.3.0 | upgraded |
| `officeparser`           |      7.1.0 → 7.3.0 |                  7.3.0 | upgraded |
| `posthog-js`             | 1.372.10 → 1.402.3 |                1.402.3 | upgraded |
| `posthog-node`           |    5.33.4 → 5.44.0 |                 5.44.0 | upgraded |
| `react-hook-form`        |    7.73.1 → 7.81.0 |                 7.81.0 | upgraded |
| `@hookform/resolvers`    |      5.2.2 → 5.4.0 |                  5.4.0 | upgraded |
| `react-resizable-panels` |    4.10.0 → 4.12.2 |                 4.12.2 | upgraded |
| `recharts`               |      3.8.0 → 3.9.2 |                  3.9.2 | upgraded |
| `express-rate-limit`     |      7.5.1 → 8.5.2 |                  8.5.2 | upgraded |

### Types

| Package                            |     Planned change | Current direct version | State    |
| ---------------------------------- | -----------------: | ---------------------: | -------- |
| `@types/express-serve-static-core` |      5.1.1 → 5.1.2 |                  5.1.2 | upgraded |
| `@types/multer`                    |      2.1.0 → 2.2.0 |                  2.2.0 | upgraded |
| `@types/node`                      | 22.19.17 → 24.13.3 |                24.13.3 | upgraded |
| `@types/react`                     |  19.2.14 → 19.2.17 |                19.2.17 | upgraded |
| `@types/supertest`                 |      7.2.0 → 7.2.1 |                  7.2.1 | upgraded |

### Testing and build

| Package               |  Planned change | Current direct version | State    |
| --------------------- | --------------: | ---------------------: | -------- |
| `@playwright/test`    | 1.59.1 → 1.61.1 |                 1.61.1 | upgraded |
| `vitest`              |  4.1.5 → 4.1.10 |                 4.1.10 | upgraded |
| `@vitest/coverage-v8` |  4.1.5 → 4.1.10 |                 4.1.10 | upgraded |
| `prettier`            |   3.8.3 → 3.9.5 |                  3.9.5 | upgraded |
| `tsx`                 | 4.21.0 → 4.23.1 |                 4.23.1 | upgraded |
| `turbo`               | 2.9.16 → 2.10.5 |                 2.10.5 | upgraded |
| `eslint-plugin-turbo` |  2.9.6 → 2.10.5 |                 2.10.5 | upgraded |

### Lint tooling

| Package                             |   Planned change | Current direct version | State    |
| ----------------------------------- | ---------------: | ---------------------: | -------- |
| `@typescript-eslint/eslint-plugin`  |  8.59.0 → 8.64.0 |                 8.64.0 | upgraded |
| `@typescript-eslint/parser`         |  8.59.0 → 8.64.0 |                 8.64.0 | upgraded |
| `typescript-eslint`                 |  8.59.0 → 8.64.0 |                 8.64.0 | upgraded |
| `eslint-config-prettier`            |   9.1.2 → 10.1.8 |                 10.1.8 | upgraded |
| `eslint-import-resolver-typescript` |    4.4.4 → 4.4.5 |                  4.4.5 | upgraded |
| `eslint-plugin-react-hooks`         |    5.2.0 → 7.1.1 |                  7.1.1 | upgraded |
| `eslint-plugin-simple-import-sort`  |  12.1.1 → 13.0.0 |                 13.0.0 | upgraded |
| `eslint-plugin-zod`                 |    1.4.0 → 4.8.0 |                  4.8.0 | upgraded |
| `globals`                           | 15.15.0 → 17.7.0 |                 17.7.0 | upgraded |

### Toolchain

| Tool |    Planned change |                        Current declaration | State                         |
| ---- | ----------------: | -----------------------------------------: | ----------------------------- |
| Node |  22 → 24.18.0 LTS | `engines.node >=24.18.0`, `.nvmrc 24.18.0` | upgraded and locally verified |
| pnpm | 10.33.0 → 11.13.1 |              `packageManager pnpm@11.13.1` | upgraded                      |

## Compatibility pins

| Package      | Approved pin | Current direct version | State                                                |
| ------------ | -----------: | ---------------------: | ---------------------------------------------------- |
| `react`      |       19.2.3 |                 19.2.3 | compatibility pin                                    |
| `react-dom`  |       19.2.3 |                 19.2.3 | compatibility pin                                    |
| `typescript` |        6.0.3 |                  6.0.3 | compatibility pin; TypeScript 7 remains out of scope |
| `eslint`     |       9.39.4 |                 9.39.4 | compatibility pin; ESLint 10 remains out of scope    |
| `@eslint/js` |       9.39.4 |                 9.39.4 | compatibility pin in lockstep with ESLint            |

`pnpm peers check` currently reports one metadata mismatch:
`@expo/require-utils@55.0.6` declares TypeScript 5 while the approved Expo SDK
57 template line uses TypeScript 6.0.3. The repository does not override that
transitive package. Expo Doctor plus web, iOS, and Android exports are the
compatibility gates for this documented upstream peer-range lag.

## Remove instead of upgrading

### Legacy Next and web-only shell

All packages in this group remain **deferred legacy bridge** dependencies. They are confined to the legacy web parity surface and must be removed with `apps/web` after the route inventory is accepted and browser E2E proves each approved replacement.

| Package                         | Current direct version | State                  |
| ------------------------------- | ---------------------: | ---------------------- |
| `next`                          |                15.5.18 | deferred legacy bridge |
| `@next/eslint-plugin-next`      |                ^15.4.5 | deferred legacy bridge |
| `eslint-config-next`            |                ^15.4.5 | deferred legacy bridge |
| `@base-ui/react`                |                 ^1.4.1 | deferred legacy bridge |
| `radix-ui`                      |                 ^1.4.3 | deferred legacy bridge |
| `@radix-ui/react-avatar`        |                 ^1.1.0 | deferred legacy bridge |
| `@radix-ui/react-dialog`        |                 ^1.1.0 | deferred legacy bridge |
| `@radix-ui/react-dropdown-menu` |                 ^2.1.0 | deferred legacy bridge |
| `@radix-ui/react-label`         |                 ^2.1.0 | deferred legacy bridge |
| `@radix-ui/react-scroll-area`   |                 ^1.2.0 | deferred legacy bridge |
| `@radix-ui/react-select`        |                 ^2.1.0 | deferred legacy bridge |
| `@radix-ui/react-separator`     |                 ^1.1.0 | deferred legacy bridge |
| `@radix-ui/react-slot`          |                 ^1.1.0 | deferred legacy bridge |
| `@radix-ui/react-tabs`          |                 ^1.1.0 | deferred legacy bridge |
| `@radix-ui/react-tooltip`       |                 ^1.1.0 | deferred legacy bridge |
| `shadcn`                        |                 ^4.4.0 | deferred legacy bridge |
| `lucide-react`                  |               ^0.475.0 | deferred legacy bridge |
| `react-day-picker`              |                ^9.14.0 | deferred legacy bridge |

### Tailwind and PostCSS bridge

| Package                           | Current direct version | State                  |
| --------------------------------- | ---------------------: | ---------------------- |
| `tailwindcss`                     |                 ^4.1.0 | deferred legacy bridge |
| `tailwind-merge`                  |                 ^3.2.0 | deferred legacy bridge |
| `@tailwindcss/postcss`            |                 ^4.1.0 | deferred legacy bridge |
| `@tailwindcss/typography`         |                ^0.5.19 | deferred legacy bridge |
| `postcss`                         |                 ^8.5.0 | deferred legacy bridge |
| `eslint-plugin-tailwindcss`       |                ^3.18.3 | deferred legacy bridge |
| `eslint-plugin-readable-tailwind` |                 ^3.0.0 | deferred legacy bridge |
| `prettier-plugin-tailwindcss`     |                 ^0.7.0 | deferred legacy bridge |

### Retired test and configuration tooling

| Package                  | Current direct version | State                  |
| ------------------------ | ---------------------: | ---------------------- |
| `@eslint/eslintrc`       |                 absent | removed                |
| `@vitejs/plugin-react`   |                 ^6.0.1 | deferred legacy bridge |
| `jsdom`                  |                ^29.0.2 | deferred legacy bridge |
| `eslint-plugin-prettier` |                 absent | removed                |
| `dotenv-cli`             |                 absent | removed                |

### Duplicated or unsafe runtime packages

| Package  | Current direct version | State                                                  |
| -------- | ---------------------: | ------------------------------------------------------ |
| `dayjs`  |                 absent | removed in favor of `date-fns`                         |
| `crypto` |                 absent | removed; runtime code uses `node:crypto` or Web Crypto |

### Retired provider-specific clients

| Package             | Current direct version | State                                          |
| ------------------- | ---------------------: | ---------------------------------------------- |
| `@anthropic-ai/sdk` |                 absent | removed                                        |
| `@google/genai`     |                 absent | removed                                        |
| `@supabase/ssr`     |                 absent | removed in favor of universal session adapters |

## Add for the target stack

### Expo foundation

| Package                 | Planned version | Current direct version | State   |
| ----------------------- | --------------: | ---------------------: | ------- |
| `expo`                  |         ~57.0.6 |                ~57.0.6 | present |
| `expo-router`           |         ~57.0.6 |                ~57.0.6 | present |
| `react-native`          |          0.86.0 |                 0.86.0 | present |
| `react-native-web`      |         ~0.21.0 |                ~0.21.0 | present |
| `eslint-config-expo`    |          57.0.0 |                 57.0.0 | present |
| `eas-cli`               |          21.0.1 |                 21.0.1 | present |
| `@expo/vector-icons`    |          15.1.1 |                 15.1.1 | present |
| `@tanstack/react-query` |         5.101.2 |                5.101.2 | present |

### Universal platform

| Package                | Planned version | Current direct version | State   |
| ---------------------- | --------------: | ---------------------: | ------- |
| `expo-secure-store`    |         ~57.0.1 |                ~57.0.1 | present |
| `expo-linking`         |         ~57.0.3 |                ~57.0.3 | present |
| `expo-constants`       |         ~57.0.5 |                ~57.0.5 | present |
| `expo-font`            |         ~57.0.1 |                ~57.0.1 | present |
| `expo-splash-screen`   |         ~57.0.4 |                ~57.0.4 | present |
| `expo-status-bar`      |         ~57.0.1 |                ~57.0.1 | present |
| `expo-image`           |         ~57.0.1 |                ~57.0.1 | present |
| `expo-file-system`     |         ~57.0.1 |                ~57.0.1 | present |
| `expo-document-picker` |         ~57.0.1 |                ~57.0.1 | present |
| `expo-web-browser`     |         ~57.0.1 |                ~57.0.1 | present |
| `expo-system-ui`       |         ~57.0.1 |                ~57.0.1 | present |

### React Native matrix

| Package                                  | Planned version | Current direct version | State   |
| ---------------------------------------- | --------------: | ---------------------: | ------- |
| `react-native-gesture-handler`           |         ~2.32.0 |                ~2.32.0 | present |
| `react-native-reanimated`                |           4.5.0 |                  4.5.0 | present |
| `react-native-worklets`                  |          0.10.0 |                 0.10.0 | present |
| `react-native-safe-area-context`         |          ~5.7.0 |                 ~5.7.0 | present |
| `react-native-screens`                   |          4.25.2 |                 4.25.2 | present |
| `@react-native-community/datetimepicker` |           9.1.0 |                  9.1.0 | present |

### Expo testing

| Package                         | Planned version | Current direct version | State   |
| ------------------------------- | --------------: | ---------------------: | ------- |
| `jest-expo`                     |         ~57.0.2 |                ~57.0.2 | present |
| `@testing-library/react-native` |          14.0.1 |                 14.0.1 | present |
| `test-renderer`                 |           1.2.0 |                  1.2.0 | present |

### Cloudflare and PostgreSQL

| Package                           | Planned version | Current direct version | State                                                 |
| --------------------------------- | --------------: | ---------------------: | ----------------------------------------------------- |
| `hono`                            |         4.12.30 |                4.12.30 | present                                               |
| `@hono/zod-validator`             |           0.9.0 |                  0.9.0 | present; validates edge route inputs                  |
| `wrangler`                        |         4.111.0 |                4.111.0 | present                                               |
| `@cloudflare/workers-types`       |    5.20260716.1 |           5.20260716.1 | present                                               |
| `@cloudflare/vitest-pool-workers` |          0.18.5 |                 0.18.5 | present                                               |
| `@cloudflare/containers`          |           0.3.7 |                  0.3.7 | present; fail-closed clean-room processing boundary   |
| `@prisma/adapter-pg`              |           7.8.0 |                  7.8.0 | present                                               |
| `pg`                              |          8.22.0 |                 8.22.0 | present                                               |
| `@types/pg`                       |          8.20.0 |                 8.20.0 | present                                               |
| `aws4fetch`                       |          1.0.20 |                 1.0.20 | present; active short-lived R2 SigV4 signing boundary |
| `jose`                            |           6.2.3 |                  6.2.3 | present; verifies Supabase bearer JWTs against JWKS   |

All named Cloudflare packages are represented at the approved exact versions.
`apps/edge/src/r2-presign.ts` actively uses `aws4fetch` to issue short-lived
SigV4 URLs. Only newly provisioned Manut-owned R2 account and access-key
credentials may enter that server-side boundary; the secret key is never
serialized to clients or artifacts.

### Mobile Phase 2

| Package              | Planned version | Current direct version | State            |
| -------------------- | --------------: | ---------------------: | ---------------- |
| `expo-notifications` |         ~57.0.5 |                 absent | Phase 2 deferred |
| `expo-device`        |         ~57.0.1 |                 absent | Phase 2 deferred |
| `expo-sqlite`        |         ~57.0.1 |                 absent | Phase 2 deferred |

## Acceptance gaps recorded by this audit

1. The universal app currently has route foundations, not complete route parity; therefore the Next, Tailwind, Vite, and jsdom bridge dependencies cannot yet be removed safely.
2. Node 24.18 and pnpm 11.13.1 are locally available and the frozen install
   passed; the full post-integration acceptance suite still needs one final run.
3. `packages/ui` is now a React Native-only universal component/token package
   consumed by `apps/app`; keep browser and Node-only dependencies out as it
   expands.
4. `socket.io` and `socket.io-client` remain in the API/web bridge and must be
   retired only after Durable Object WebSocket parity and E2E.
5. Phase 2 mobile packages remain intentionally absent and must not be added
   idle to the web-first bundle.
6. The single Expo `@expo/require-utils` TypeScript peer-range mismatch above
   remains an explicit ecosystem hold; it is not resolved by downgrading the
   approved TypeScript 6 toolchain.
