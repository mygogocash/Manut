# Manut Intranet

Manut Intranet is a private employee operations platform. This repository is
web-first today and intentionally uses an Expo universal application so the
same screens, domain services, authentication decisions, and route policies can
ship to Android and iOS later without a second frontend rewrite.

## Architecture

| Layer               | Current responsibility                                          | Direction                                                               |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/app`          | Expo Router universal web/native shell                          | Primary frontend                                                        |
| `packages/app-core` | Platform-neutral auth, API, and RBAC contracts                  | Shared by web, Android, and iOS                                         |
| `packages/ui`       | Universal React Native tokens and components                    | Shared by web, Android, and iOS                                         |
| `apps/edge`         | Cloudflare Worker, static assets, security headers, API gateway | Public request boundary                                                 |
| `apps/api`          | Strict TypeScript business API                                  | Runs behind the gateway; Node-only work moves to a Cloudflare Container |
| `apps/web`          | Existing Next.js parity reference                               | Retired route-by-route after Expo acceptance                            |
| `packages/database` | Prisma schema and immutable migration baseline                  | Postgres through Cloudflare Hyperdrive                                  |

Cloudflare R2 is the file-storage target. Durable Objects own reconnectable
state, Queues/Workflows own asynchronous jobs, and D1 may hold edge-local
coordination data only; Postgres remains the authoritative business database.

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:generate
pnpm dev
```

Useful focused commands:

```bash
pnpm dev:app          # Expo universal app
pnpm dev:api          # business API
pnpm dev:edge         # Cloudflare gateway
pnpm --filter @manut/app export:web
pnpm --filter @manut/app export:ios
pnpm --filter @manut/app export:android
```

## Verification

Every pull request must pass generated database types, strict API and root
TypeScript, zero-warning lint, unit tests, web bundle limits, migration safety,
credential/Gitleaks scans, and authenticated Playwright tests against the
dedicated E2E project.

Continue implementation from the canonical
[Cursor handoff](docs/CURSOR_HANDOFF.md). See also the
[credential boundary](docs/CREDENTIAL_BOUNDARY.md),
[repository migration](docs/REPOSITORY_MIGRATION.md),
[authentication and RBAC](docs/AUTH_RBAC.md), and
[dependency upgrade scope](docs/DEPENDENCY_UPGRADE_SCOPE.md).

## Deployment boundary

No application deployment is active in this migration. The disabled workflow
stubs are documentation only. This repository does not change domains,
databases, the running `manut.xyz` service, or production infrastructure.
Cloudflare enablement and any mobile-store release require separate reviewed
cutovers with newly issued Manut credentials.
