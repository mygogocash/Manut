# Codebase context

> **Forward roadmap:** `docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` is the sole
> authoritative architecture and migration plan. Current strangler SoR is
> Postgres/Prisma/Hyperdrive until Phase 8+ D1 gates
> (`docs/ADR-010-postgres-strangler-vs-d1-target.md`).

## Request flow

```text
Browser / Android / iOS
          |
          v
Expo Router app ---- packages/app-core
          |
          v
Cloudflare Worker (assets, headers, request IDs, gateway)
          |
          v
Strict business API ---- Postgres via Hyperdrive (strangler SoR)
          |              R2 / Queues / Durable Objects
          v
Cloudflare Container for Node-only document, payroll, and realtime work
```

The Worker is the public boundary but does not duplicate business authorization.
Every protected API operation continues to enforce permissions and ownership in
the server service layer. Target multi-tenant D1 SoR is scheduled in the master
plan; D1 is not transactional SoR in this tree yet.

## Frontend migration

- `apps/app/app/` contains only Expo Router route composition.
- `apps/app/src/` contains universal screens and platform adapters.
- `packages/app-core/` cannot import React, React Native, Expo Router, Next.js,
  DOM globals, analytics, or a concrete storage implementation.
- `apps/web/` remains the route-parity oracle while routes move in five batches:
  foundation/auth, employee/HR, operations/legal/projects, CRM/revenue, then
  admin/content/integrations.
- A route leaves the legacy app only after browser E2E and native render checks.

## API layout

API modules follow `controller` → `service` → `repository` → Prisma. Inputs are
validated with Zod, routes declare broad permission gates, and services enforce
record ownership or approval-chain rules. Literal Express routes must be
registered before `/:id` routes.

Permanent deletion is intentionally strict: including-deleted lookup first,
`404` for missing rows, `409` for active rows, and purge only for soft-deleted
rows. Webhook signatures authenticate captured raw bytes before parsing.

## Data and migrations

The replacement starts with one generated clean baseline whose migration SQL is
identified by SHA-256 in `baseline-manifest.json`. No source migration history
or company-bearing seed is imported. Future schema changes require a new
migration plus `setup.sql` and `assert.sql`; checks reject baseline edits or
removals and exercise deploy, replay, idempotency, and schema convergence.

## Environment boundaries

- Browser/native bundles receive only public endpoint and anon identifiers.
- Service-role, direct database, OAuth, signing, and provider keys stay on the
  API, Worker secrets, or CI server setup path.
- E2E resets only `manut-intranet-e2e`, creates random runtime personas, and
  deletes them after the suite.
- No inherited provider account, domain, project, bucket, or credential is an
  allowed default.
