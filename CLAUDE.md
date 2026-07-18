# CLAUDE.md — binding Manut repository guide

## Non-negotiable boundaries

1. This is a clean-room Manut replacement. No inherited company branding,
   identities, assets, credentials, provider identifiers, seed data, or
   proprietary modules may enter the replacement tree.
2. `apps/app` is the primary frontend: one Expo Router route tree for web, iOS,
   and Android. Web acceptance is first; native store release is later.
3. PostgreSQL via Prisma 7 and Cloudflare Hyperdrive remains authoritative. D1
   is edge metadata only.
4. Workers deploy CI may run (staging auto / production gated) but must fail
 closed without Manut-owned GitHub Environment secrets. DNS cutover and
 Hyperdrive id invention remain unauthorized; keep `hyperdrive: []` until
 ops binds a real id. Do not use Cloudflare Pages as the SPA host.
5. API permission and ownership checks remain authoritative even when a route
   is guarded in the client.

## Repository map

```text
apps/app              universal Expo UI and Router routes
apps/edge             Hono Cloudflare Worker and Static Assets boundary
apps/api              strict Express business API/parity bridge
apps/web              temporary Next.js route-parity reference
packages/app-core     universal auth, RBAC, DTOs, schemas, queries, domain logic
packages/ui           universal components and design tokens
packages/database     Prisma 7 schema, generated client, clean migrations
e2e                   dedicated authenticated Playwright suite
scripts               migration, E2E, bundle, and credential safety gates
```

Shared packages must not import Next.js, Node-only modules, DOM globals, or a
concrete secure-storage implementation. Put unavoidable platform behavior in
small `.web.ts(x)` and `.native.ts(x)` adapters.

## Verification contract

The protected `Validate` check aggregates secret scanning, dependency review,
strict/static/unit checks, Expo web and native exports, Worker tests/build,
PostgreSQL 16 migration safety, and serialized authenticated Playwright E2E.
Local work should run focused checks first and then the repository gates listed
in `AGENTS.md`.

Strict TypeScript and zero-warning lint are required. Do not use `any`, blanket
non-null assertions, `ts-ignore`, conditional E2E skips, or test fixtures that
silence a real invariant. Generated Prisma output, build output, storage state,
and signing files are not source.

## Auth and route behavior

- Web uses secure HTTP-only cookies; native uses PKCE bearer sessions in
  SecureStore. Both resolve the same server-side user, roles, and permissions.
- Clear authenticated state only on `401/403`. Preserve warm state on network,
  rate-limit, and other HTTP failures; cold starts show retry without protected
  content.
- Redirect priority is password change, sanitized same-origin return path,
  employee portal, dashboard. Preserve query/hash and use replace semantics.
- Route permissions resolve explicit override, exact leaf, then longest
  segment-boundary prefix. Sidebar visibility is not authorization.

## Cloudflare behavior

- The Worker serves the Expo SPA with security headers and routes Cloudflare-
  native handlers before the quarantined API proxy.
- Missing auth, API origin, Hyperdrive, Container, Workflow, Queue, or storage
  capability must fail closed; never substitute a direct secret URL.
- Use R2 binding/server-owned keys for uploads, Durable Object hibernating
  WebSockets for realtime, Queues with idempotency/DLQ for short work, and
  Workflows for multi-step operations.
- No environment shares bindings or credentials with an inherited resource.

## Database and migrations

The replacement contains one clean baseline recorded in
`baseline-manifest.json`. It imports no source migration history or identity
seed. New migrations require `setup.sql`, `migration.sql`, and `assert.sql`, and
must pass deploy, direct replay, and double `db push` convergence on PostgreSQL 16. Never edit or remove a baseline migration.

## Pull requests

Use `claude/<slug>` branches and conventional commit titles. Keep security and
migration changes independently reviewable. A green local run is not evidence
of remote repository settings, provider ownership, credential revocation,
Cloudflare provisioning, EAS builds, or deployment; verify those surfaces
directly before reporting them complete.
