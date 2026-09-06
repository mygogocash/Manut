# Intranet — codebase overview

Prepared for the GCP → AWS migration assessment.

| | |
|---|---|
| Repository | `new-tbh-intranet` (private, GitHub) |
| Baseline commit | `0479db8d` on `main` (production) |
| `dev` vs `main` | 1 commit ahead — the branches are in sync; no unreleased module work |
| Date of this snapshot | 2026-08-26 |
| Product name | **Intranet** (workspace packages are still named `@nexora/*` — a monorepo implementation detail, never user-visible) |

---

## 1. What the system is

A single-tenant internal business platform for Manut: HR/HRMS,
payroll, leave, attendance, visa/immigration, accounting (Thai statutory,
including a fixed-asset register), expenses, travel, cash advance, five separate
CRMs (Sales, Sales Revenue, IT, Legal, Product/QA/Voucher boards), investor
relations and fundraising, IT operations and helpdesk, performance appraisals,
an internal document/knowledge base, real-time messaging, and an AI assistant
("ARIA").

It is one deployable web app plus one deployable API. There are **no**
microservices, no message queues, no background worker fleet — scheduled work is
HTTP endpoints invoked by a cron scheduler.

---

## 2. Repository layout

```
apps/
  api/            Express 5 + TypeScript backend      (port 3001)
  web/            Next.js 16 App Router + React 19    (port 3000)
packages/
  database/       Prisma schema, 258 migrations, seeds
  types/          Shared TS types
  utils/          Shared helpers
  ui/             Shared shadcn components
  okf/            Internal dev-docs knowledge format
  eslint-config/  Shared lint config
docker/           Dockerfile.api, Dockerfile.web, docker-compose.yml
docs/             PRDs, specs, ops runbooks (human-curated)
e2e/              Playwright specs
.github/workflows/ deploy.yml, deploy-staging.yml, pr-checks.yml, okf-checks.yml
```

Monorepo tooling: **Turborepo 2.10 + pnpm 10.33** (workspace protocol, frozen
lockfile in CI). Node **22** everywhere (`node:22-alpine` in both images).

### Size

| Area | Files | Lines |
|---|---:|---:|
| `apps/api/src` | 895 | 200,277 |
| `apps/web/src` | 879 | 268,064 |
| `packages/database` | 9 | 8,085 |
| `packages/okf` | 10 | 1,116 |
| `packages/utils` + `types` + `ui` | 7 | 355 |
| SQL migrations (258 files) | 258 | 14,087 |
| **Total TS/TSX** | **~1,800** | **~478,000** |

Automated tests: **282** test files (Vitest for api + web, Playwright for e2e).

---

## 3. Runtime stack

### Backend — `apps/api`

- **Express 5**, TypeScript, executed **directly by `tsx`** at runtime — there is
  no compile step (`"build": "echo 'API uses tsx for runtime, no build needed'"`).
  The production container runs `./node_modules/.bin/tsx src/main.ts`. Anything
  that builds the image must keep `tsx` and the TS sources present.
- **Prisma 6.19.3** ORM against PostgreSQL. The generated client is
  **gitignored** — CI runs `pnpm db:generate` before type-check.
- Middleware chain (`apps/api/src/app.ts`): `helmet` (CSP disabled) →
  `compression` (bypassed for `POST /api/aria/chat`, which streams) → `cors`
  (env-driven allowlist, `credentials: false`) → `cookie-parser` → two
  `express-rate-limit` buckets → request logger.
- `app.set("trust proxy", 1)` — one proxy hop is assumed. **This is a
  load-balancer-shaped assumption; see [07-aws-target-mapping.md](07-aws-target-mapping.md).**
- Auth: Supabase Auth issues the JWT; Express middleware resolves the Prisma
  user + roles + permissions per request. Permission codes are `module:action`
  (`crm:read`). The System Admin role (`isSystem && name === "Admin"`) bypasses
  every permission gate in `auth.service.resolvePermissions`.
- Session transport: **httpOnly cookies** `nexora_access_token` /
  `nexora_refresh_token` set by the API. The browser never holds a Supabase
  session — `apps/web` has **zero** `@supabase/*` imports.
- Logging: `winston` to stdout.
- Real-time: **Socket.IO 4.8** on the same HTTP server, namespace `/messages`,
  path `/socket.io/`.
- Native runtime dependency: **`qpdf`** CLI (installed via `apk add qpdf` in
  `Dockerfile.api`), used by `payroll/payslip-crypto.ts` to password-protect
  payslip PDFs. It writes to `os.tmpdir()` and cleans up. Any replacement base
  image must still carry `qpdf` and `openssl`.
- Other notable libs: `pdf-lib`, `docx`, `xlsx` (SheetJS CDN tarball, **not**
  the npm `xlsx` package), `jszip`, `officeparser`, `officecrypto-tool`,
  `multer` (in-memory multipart), `@google/genai` (Gemini), `posthog-node`.

Layering convention per module:
`<module>.controller.ts` (routes) → `<module>.service.ts` (logic) →
`<module>.repository.ts` (Prisma) + `<module>.validation.ts` (Zod).

**99 API modules** under `apps/api/src/modules/`, registering **1,350 HTTP
routes** (501 GET, 446 POST, 232 PUT, 159 DELETE, 12 PATCH).

### Frontend — `apps/web`

- **Next.js 16.3.1** App Router, **React 19.2**, `output: "standalone"`,
  `outputFileTracingRoot` pinned to the monorepo root.
- **112 pages**, essentially all under the `(dashboard)` route group (53
  top-level sections) plus the unauthenticated `sign-in`, `forgot-password`,
  `reset-password`, `magic-link`, `change-password` and `sign` routes.
- Tailwind v4, shadcn + Radix + base-ui primitives, `react-hook-form` +
  `zodResolver`, `sonner` toasts, `recharts`, `@dnd-kit` for kanban boards.
- All API access flows through `src/services/<module>.service.ts` using the
  shared `api` helper — components never `fetch` directly.
- **The browser talks only to the web origin.** `next.config.ts` rewrites
  `/api/:path*` → `${API_URL}/api/:path*` server-side, and `/ingest/*` →
  PostHog US Cloud (an ad-blocker-evasion proxy). The one exception is the
  WebSocket: `NEXT_PUBLIC_SOCKET_URL` defaults to the same `API_URL` and is
  inlined into the client bundle at build time, so **the browser connects
  directly to the API host for Socket.IO** and the API therefore needs its own
  publicly reachable HTTPS endpoint.
- `NEXT_PUBLIC_*` values are inlined at `next build`, so they travel as Docker
  `--build-arg`, never as runtime env vars. Getting this wrong silently ships a
  build with the value missing (Docker drops a `--build-arg` with no matching
  `ARG` without erroring).

### Shared packages

`@nexora/database` (Prisma client + schema + seeds), `@nexora/types`,
`@nexora/utils`, `@nexora/ui`, `@nexora/okf`, `@nexora/eslint-config`. All are
`workspace:*` and are built (`tsc`) inside both Dockerfiles before the app build.

---

## 4. Database

PostgreSQL, hosted on **Supabase**. Full detail in
[02-data-dictionary.md](02-data-dictionary.md) and
[03-schema.sql](03-schema.sql); the numbers:

| | |
|---|---:|
| Tables | **274** |
| Columns | **3,228** |
| Foreign keys | 444 |
| Secondary indexes | 590 (132 unique) |
| Prisma models | 274 (all with an explicit `@@map`) |
| Prisma enums | **0** — every status/type column is a plain string |
| Migrations | 258 |
| Tables with `deleted_at` soft delete | 25 |
| Composite primary keys | 10 (all join tables) |
| Extensions required | `vector` (pgvector) |

Primary keys are **UUID on 184 tables** and **TEXT (Prisma `cuid()`) on 78**.
Both styles are load-bearing and mixed within single foreign-key graphs — do not
try to normalise them during a migration.

`users` is referenced by **202** other tables; `entities` (the legal-entity
dimension for the Thailand/India/Vietnam/Indonesia multi-entity model) by 35.

Money is `DECIMAL`; `LeaveBalance` is `Decimal(4,1)` and
`BalanceTransaction.amount` is `Decimal(6,1)`.

### Two things that a schema dump alone will not tell you

1. **pgvector is required.** `aria_knowledge_articles.embedding vector(768)` and
   its `ivfflat` cosine index exist only in raw migration SQL
   (`20260509000000_aria_knowledge_embeddings`) and are absent from the Prisma
   schema — ARIA reads the column through `$queryRaw`. A target Postgres without
   the `vector` extension will boot, serve traffic, and silently degrade ARIA
   retrieval to keyword overlap.
2. **Row-Level Security exists but is not a tenancy model.** `0000_init` names
   94 tables, each getting exactly one policy, `service_role_full_access`, gated
   on `public.is_service_role()`, plus a blanket revoke of `anon` and
   `authenticated` (including default privileges for future tables). The Express
   API is the sole database client and does all authorisation in application
   code. Two drifts: **three of those 94 tables no longer exist**
   (`survey_definitions`, `survey_waves`, `upload_jobs`), so the live count is
   **91**; and the 183 tables added after `0000_init` have no policy at all.
   Those are still unreachable by `anon`/`authenticated` because of the revokes,
   so it is a defence-in-depth gap, not an exposure.

Both are captured in [04-schema-addendum.sql](04-schema-addendum.sql), which
must be applied after `03-schema.sql`.

---

## 5. Build, test, deploy pipeline

### Local

```bash
pnpm dev:api        # Express on :3001
pnpm dev:web        # Next.js on :3000
pnpm db:generate    # regenerate Prisma client
pnpm db:migrate     # create + apply a dev migration
pnpm db:push        # push schema without a migration (dev/staging only)
pnpm db:seed
pnpm type-check && pnpm lint && pnpm test
```

### CI gates (`pr-checks.yml`) — all four block merge

1. `type-check` — `tsc --noEmit` across the monorepo
2. `lint` — `eslint` (api) + `next lint` (web); warnings allowed, errors block
3. `test` — `vitest run` (api + web)
4. `brand-drift` — grep gate against forbidden brand strings

`okf-checks.yml` additionally validates the `packages/okf` doc bundle.

### Deploy

| Branch | Workflow | Targets | Schema sync |
|---|---|---|---|
| `main` | `deploy.yml` | Cloud Run `nexora-api`, `nexora-web` | `prisma migrate deploy` against `DIRECT_URL`, **before** the Docker build — a failure aborts the deploy |
| `dev` | `deploy-staging.yml` | Cloud Run `nexora-api-staging`, `nexora-web-staging` (separate Supabase project via `STAGING_*` secrets) | `pnpm db:push:staging` |

Two consequences of that difference that keep biting:

- **Data-migration SQL inside a migration file never runs on staging.** A
  column that depends on a backfill stays empty there. So does anything created
  only by raw SQL — the two GIN indexes carry an explicit comment saying
  `db push` will not create them.
- Release process: `dev` → `main` must be a **merge commit, never a squash**
  (`docs/RELEASE_PROCESS.md`). Squashing discards ancestry and the next release
  re-proposes every commit since the last true merge.

Both workflows use `dorny/paths-filter` to skip the Docker build when only
`docs/**` or `**/*.md` changed.

---

## 6. Where the migration-relevant complexity actually sits

Ranked by how much of the migration effort they represent, not by lines of code:

1. **Supabase is three products, not one** — Postgres, Auth, and Storage. Each
   has a different exit cost. See
   [06-infrastructure-inventory.md](06-infrastructure-inventory.md) §2.
2. **21 cron endpoints**, only 4 of which are provisioned by CI. The rest were
   created by hand in Cloud Scheduler and are not fully inventoried in the repo.
3. **Socket.IO has no shared adapter.** `messages.bus.ts` is an in-process
   `Map`-backed emitter, so real-time fan-out only ever reached clients on the
   same instance. Cloud Run already runs up to 10 instances, so this is a
   pre-existing limitation being carried, not one the migration creates — but
   any AWS design has to make a deliberate choice about it.
4. **`tsx`-at-runtime API.** No build artefact to promote; the image *is* the
   source tree. Cold start and image size are both larger than a compiled
   equivalent, and there is no `dist/` to hand to a Lambda-style runtime.
5. **A second GCP asset outside this repo**: the marketing analytics upstream
   (`bnii-analytics-api`, "the Rahul API") is itself a Cloud Run service at
   `https://bnii-analytics-api-epgxydm2fa-as.a.run.app`, hardcoded as a fallback
   default in `marketing-analytics.service.ts` and `marketing/bnii-partners.ts`.
   It has its own repo and its own migration decision.
