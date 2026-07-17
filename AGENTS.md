# AGENTS.md — Manut development rules

`CLAUDE.md` is the binding repository guide. Keep this file and that guide in
sync when architecture or verification changes.

## Delivery boundary

- The product is Manut Intranet. Do not add inherited company names, domains,
  identifiers, sample people, credentials, assets, or provider resources.
- Web delivery comes first through `apps/app`, but every change must keep web,
  iOS, and Android compilation healthy from the same Expo Router project.
- `apps/web` is a temporary parity reference. Remove a legacy route or web-only
  dependency only after the universal route has browser E2E acceptance.
- Deployment workflows are intentionally disabled. No code change in this
  branch authorizes DNS, database, Cloudflare, mobile-store, or running-service
  changes.

## Architecture

- `apps/app`: universal Expo Router routes and platform adapters.
- `packages/app-core`: API, DTO, auth, RBAC, query, validation, and domain logic
  with no browser, Next.js, Node-only, or concrete storage dependency.
- `packages/ui`: universal components and tokens.
- `apps/edge`: Cloudflare Worker gateway, Static Assets, R2 intents, rate limits,
  Queues, Durable Objects, and fail-closed capability boundaries.
- `apps/api`: strict Express business API during progressive edge migration.
- `packages/database`: Prisma 7 and the clean PostgreSQL baseline.

PostgreSQL through Hyperdrive is authoritative. D1 is never the transactional
system of record. R2 objects are private unless explicitly public.

## Working loop

1. Map the existing route/module and its permission boundary.
2. Add or update a failing test for behavior changes.
3. Keep shared behavior in `app-core`; use `.web.tsx`/`.native.tsx` only for
   genuine platform differences.
4. Run the focused test, then the relevant gates below.
5. Do not claim deployment or provider revocation without live evidence.

## Required gates

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm type-check
pnpm lint
pnpm test
pnpm --filter @manut/app export:web
pnpm --filter @manut/app export:ios
pnpm --filter @manut/app export:android
pnpm --filter @manut/edge build
pnpm migration:check
pnpm security:credentials
git diff --check
```

Hosted authenticated E2E additionally requires the five approved `E2E_*`
secrets and the independent dedicated-project marker. Never bypass that guard.

## API and database conventions

- Validate inputs with Zod; controllers route, services authorize and apply
  business rules, repositories access Prisma.
- API authorization is authoritative. Client route guards improve navigation
  but never grant access.
- Register literal Express routes before `/:id`.
- Permanent deletion must load including-deleted state: missing `404`, active
  `409`, soft-deleted purge only.
- Authenticate webhook raw bytes before parsing or mutation.
- The clean baseline is immutable. Every new migration needs `setup.sql` and
  `assert.sql`, must apply through `prisma migrate deploy`, and replay safely.

## Security

- Never add secrets to Turbo global environment declarations or client bundles.
- Never commit Playwright storage state, Expo/EAS signing data, Wrangler local
  state, provider config, or environment files.
- Run the credential-boundary scanner after touching auth, fixtures, docs,
  imports, assets, generated output, or deployment configuration.
- GitHub Actions must be commit-SHA pinned, read-only by default, and must never
  use `pull_request_target`.
