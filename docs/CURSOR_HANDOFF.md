# Cursor handoff: Web-first Manut migration

Last updated: 2026-07-17

This is the canonical continuation plan for the clean-room replacement of
Manut with a web-first universal Expo application and Cloudflare-first
platform. It records what is actually implemented, what was verified, what is
still incomplete, and which operations require fresh Manut-owned authority.

The migration is **not merge-ready**. Do not interpret an individual green
package build as completion of the full plan.

## Start here in Cursor

Open this exact workspace:

```text
/Users/kunanonjarat/Developer/manut-intranet-full-hardening
```

Do not continue in the original audited-source checkout. Its path and Git
worktrees are intentionally outside this committed handoff.

Before editing, read `AGENTS.md`, `CLAUDE.md`, this file, and the linked
control documents at the end of this file.

Use the approved runtime for every command:

```bash
source /Users/kunanonjarat/.nvm/nvm.sh
nvm use 24.18.0
node --version
pnpm --version
```

Expected versions:

```text
Node v24.18.0
pnpm 11.13.1
```

## Current Git and operational state

| Item                        | Current state                                                 |
| --------------------------- | ------------------------------------------------------------- |
| Working tree                | `/Users/kunanonjarat/Developer/manut-intranet-full-hardening` |
| Branch                      | `claude/intranet-full-hardening`                              |
| Current `HEAD`              | `eb797d30b538a60b5f4ff154863a6591ed2ad62f`                    |
| Intended replacement parent | Same Manut SHA above                                          |
| Audited source snapshot     | `371349fd43fd7c7c7717054beec97bfb023885ca`                    |
| Archive branch              | `archive/affine-2026-07-16` -> `eb797d30`                     |
| Archive tag                 | `affine-before-intranet-2026-07-16` -> `eb797d30`             |
| Configured remote           | Only `manut`, pointing at `mygogocash/Manut`                  |
| Replacement commit          | Not created yet                                               |
| Push or pull request        | Not performed                                                 |
| Production mutation         | None; `manut.xyz` remains untouched                           |

The working tree currently represents an expected full tree replacement:
approximately 11,061 tracked legacy files are deleted and 27 replacement
top-level paths are untracked. Do not use `git reset --hard`, `git checkout --`,
or another command that would discard this work.

### Linked-worktree warning

This destination is a linked Git worktree. Its common Git directory is the
source checkout's `.git` directory, so `git branch` and broad all-ref scanners
can see source-development branches and objects. That does not put those
objects into the Manut pull request: only the replacement branch, archive
branch, and archive tag are intended for publication.

- Do not delete or rewrite the other local branches; several are checked out
  by other user worktrees.
- Do not push with `--mirror` or `--all`.
- Push only the named replacement branch and the two archive refs after remote
  authority is restored.
- For clean-room PR evidence, scan `eb797d30..HEAD`, not every local ref in the
  shared object store.

## Non-negotiable boundaries

1. Import no source `.git` data or source commit ancestry. The replacement
   commit must remain a direct descendant of the Manut parent.
2. Do not reuse source-organization-linked branding, data, migrations, seeds,
   assets, provider identifiers, credentials, accounts, projects, or OAuth
   applications.
3. Treat uncertain ownership as prohibited. Provision a fresh Manut resource
   or stop and record the blocker.
4. Do not deploy, change DNS, mutate a production database, or alter the
   currently running `manut.xyz` service in this branch.
5. PostgreSQL remains authoritative. D1 may never become the business system
   of record.
6. Web is the first delivery target, but every change must preserve web, iOS,
   and Android compilation from the same Expo project.
7. Keep `apps/web` only as a temporary parity reference. Remove it and its
   web-only dependencies only after every approved route has behavioral parity
   and browser E2E coverage in Expo.
8. Never commit provider credentials, E2E storage state, signing material,
   `.env`, `.dev.vars`, Expo state, Wrangler state, generated bundles, or test
   artifacts.

## Target architecture

```text
Expo Router app (web, iOS, Android)
  |-- packages/app-core: API, DTO, auth, RBAC, redirects, domain hooks
  |-- packages/ui: universal tokens and React Native components
  |-- .web/.native adapters for platform-only behavior
  |
Cloudflare Worker (Hono)
  |-- Expo SPA Static Assets
  |-- cookie or bearer authentication enforcement
  |-- rate limiting and security headers
  |-- R2 upload/download intents
  |-- Durable Object WebSockets
  |-- Queues and Workflows
  |
Existing strict Express API during transition
  |-- later hosted behind the Worker in a Cloudflare Container
  |-- qpdf/Office processing may remain containerized
  |
PostgreSQL through Hyperdrive (authoritative)
R2 (files)
D1 (optional non-authoritative edge metadata only)
```

## Whole-plan progress

| Workstream                           | State                                     | Evidence and remaining condition                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline backup and archive refs      | **Remote + local complete**               | Bare mirror verified; local and remote `archive/affine-2026-07-16` + `affine-before-intranet-2026-07-16` peel to `eb797d30`.                                                                                    |
| Clean-room tree boundary             | **Replacement PR open**                   | Commits `7d8b17a2` + `640c505a` (+ follow-ups) on `claude/intranet-full-hardening`; PR `#208` opened against `main`.                                                                                           |
| GitHub detachment/private/protection | **Mostly complete; protection blocked**   | `fork=false`, private, About cleared to Manut Intranet, topics reset. Classic branch protection / rulesets return 403 on GitHub Free org plan — needs Pro or public (keep private; upgrade plan).             |
| Source-organization removal          | **Phase A sweep complete locally**        | Credentials, branding, proprietary AI/marketing modules, identity-bearing migrations, and seeds were removed or replaced. HMAC provenance scan and comment sweep passed 2026-07-17.                           |
| API strictness and hardening         | **Implemented locally**                   | Strict TypeScript, webhook bytes, purge lifecycle, lifecycle-safe auth/RBAC, atomic Leave state changes, live-socket revalidation, Performance scoping, and profile projection are implemented.               |
| Universal Expo foundation            | **Implemented**                           | Expo SDK 57, shared API/session runtime, app-core/UI packages, auth transports, app shell, Expo Doctor, and three-platform exports pass. This is a foundation, not full route parity.                         |
| Approved web route parity            | **In progress (Phase 1 advanced)**        | Performance read-only appraisals, My Portal hub, leave history pagination, directory org chart, dashboard KPIs, and local settings preferences landed as foundation slices. Waves 2–4 and Expo E2E cutover remain. |
| Cloudflare edge layer                | **Locally implemented**                   | Worker auth, SPA assets, R2, Durable Objects, Queues, Workflows, Container/Hyperdrive boundaries, tests, and dry-run bundle exist. Fresh resources are not provisioned.                                       |
| Clean PostgreSQL baseline            | **Implemented**                           | One sanitized baseline plus hash manifest, setup/assert scripts, and migration harness exist. Local Docker replay is blocked; CI PostgreSQL 16 lane is ready.                                                 |
| Dependency upgrades                  | **Mostly implemented**                    | Requested upgrades, compatibility pins, Expo, and Cloudflare packages are present. Legacy Next/Tailwind/Vite/jsdom bridge packages remain until parity.                                                       |
| CI decomposition                     | **Implemented locally**                   | Nine prerequisite jobs plus final `Validate`, pinned actions, read-only contents/PR metadata, and no `pull_request_target`. Not run on GitHub yet.                                                            |
| Authenticated E2E                    | **Harness implemented; live run blocked** | Dedicated-project guard, runtime personas, reset/seed/cleanup, serialized Playwright, and failure-only artifacts exist. Five environment secrets and a fresh E2E project are missing.                         |
| Native internal builds               | **Blocked externally**                    | JavaScript exports pass. Android internal APK and iOS simulator EAS builds require a fresh Manut Expo organization.                                                                                           |
| Credential revocation proof          | **Blocked externally**                    | Provider-side revocation and negative authentication evidence require authorized Manut-owned accounts. A local Cursor worker also requires credential rotation after command-line exposure.                   |
| Final acceptance and merge           | **Not started**                           | Requires parity, complete local gates, replacement commit, remote resources, green PR, approval, and verified repository settings.                                                                            |

## Implemented work in detail

### 1. Repository and clean-room controls

- Full bare mirror:
  `/Users/kunanonjarat/Developer/backups/Manut-2026-07-17.git`.
- Mirror `git fsck --full --strict` passed and the mirror's `main` resolves to
  the intended parent.
- Archive branch and annotated tag resolve to the same parent.
- Source Git remote was removed from this worktree; only the Manut remote is
  configured.
- Deployment workflows are present only as `.disabled` files.
- Credential/provenance enforcement uses HMAC fingerprints rather than raw
  legacy identifiers in `scripts/check-credential-boundary.mjs`.
- The latest source scan passed across 1,611 files. Generated Expo web/iOS/
  Android, Worker, and legacy Next artifacts passed across 7,453 files.
- Redacted Gitleaks scans found no leak in the exact 1,611-file replacement
  tree or in Expo web/iOS/Android and Worker artifacts. A deliberately broad
  install-tree scan produced 19 reviewed findings: ten fake credential examples
  in ignored local `.agents` skill documentation, three generated Next build
  cache keys, and the generated preview-mode signing/encryption plus
  server-action encryption keys duplicated in the standalone Next output. None
  is an inherited/provider credential; never copy their values into Git.
- `.gitignore` excludes Playwright, Expo, Wrangler, generated bundles, SBOM,
  native signing files, service configuration files, and agent-local assets.

### 2. API correctness and security

Implemented in `apps/api`:

- The external DocuSign transport, OAuth/settings routes, webhook surface, and
  provider selector were removed. The in-house multi-signer and public signing
  workflow remains the supported legal-signature path.
- Every in-house signature is bound to an immutable FileUpload ID, storage
  bucket/path, SHA-256, size, MIME type, file name, document title, and kind.
  Restrictive upload/document foreign keys plus a database trigger prevent
  signed evidence or its parent document from being deleted or rebound.
- Service-role storage signing and deletion now require the configured storage
  origin and module-specific bucket. Shared-bucket consumers additionally
  prove FileUpload purpose, owner, and record linkage, preventing one module
  from proxy-signing or deleting another module's files. Supported external
  expense, visa, and 90-day links remain unsigned passthroughs.
- Cash advance, expense items, expense reports, leave, travel, visa, and user
  permanent-delete flows load including-deleted records and return:
  - `404` when absent;
  - `409` when still active;
  - success only for already soft-deleted records.
- Cash-advance disbursement and clearing use transactional compare-and-set
  transitions, so concurrent finance requests cannot replace committed proof
  URLs or timestamps. Each proof is revalidated and bound to a unique
  FileUpload ID in the same transaction; a restrictive foreign key prevents
  deletion after commit.
- Generic upload listing, signing, deletion, and message relinking exclude
  module-controlled payslip and cash-proof artifacts. Message attachment
  readback is restricted to uploads that remain owned and linked to that exact
  message, closing post-bind and concurrent provenance corruption paths.
- Company-wide payroll listing, arbitrary download/export, attachment,
  removal, and bulk deletion are manager-gated in both controller and service
  layers. Registered payslip replacement cleans up only the proven prior
  artifact and never deletes an unproven legacy URL.
- `/auth/me` preserves authenticated state for network, rate-limit, and
  non-auth HTTP failures; only `401/403` clears state.
- Active and non-deleted local lifecycle state is authoritative for cookie,
  bearer, login, refresh, recovery, magic-link, invitation, and user lookup
  paths. Logout still clears client cookies when local eligibility is gone.
- Long-lived messaging sockets reload lifecycle and current permissions before
  privileged inbound events and before every passive broadcast. Revoked users
  are removed from rooms and disconnected; narrower permission downgrades stop
  the affected action or admin/private delivery without trusting the handshake
  snapshot.
- Cold-start verification failures render retry UI without protected content.
- Return paths preserve query strings, reject cross-origin/authority/control
  character tricks, and use replace navigation after login.
- Leaf-route RBAC uses explicit override, exact match, then longest
  segment-boundary prefix. API authorization remains authoritative.
- Employee Performance access is represented in shared route policy.
- Performance lists are caller-scoped, and goal self/manager scores are
  writable only by their corresponding appraisal actor.
- Leave balance consumption, approval, cancellation, and restoration use
  atomic state transitions with decimal-safe half-day arithmetic and applicable
  LeaveType rules.
- Profile reads expose only public entity identity fields; full legal,
  accounting, address, and lifecycle fields cannot cross the auth boundary.
- Attendance/month parsing, indexing, JWT, storage, crypto, revenue, payroll
  JSON null handling, user creation, and nullable LeaveType paths were made
  strict-safe.
- `strict: false` was removed from API TypeScript configuration.
- A narrow test assertion helper replaces blanket non-null assertions.
- Inherited direct Anthropic/Gemini SDK paths and prohibited AI/marketing
  product modules were removed from the active tree.

Latest broad local evidence before external provisioning (Phase A re-verified 2026-07-17):

- `pnpm security:credentials`: 1,611 replacement-tree files clean; post-export
  artifact scan across Expo web/iOS/Android, Worker, and legacy Next output
  passed 7,441 files.
- `pnpm install --frozen-lockfile`, `db:generate`, `migration:check`, root
  `type-check` (14/14), `lint` (11/11, zero warnings), and `test` (11/11) passed.
- Legacy web production build (79 pages), Expo web/iOS/Android exports,
  `bundle:check`, `expo-doctor` (20/20), edge type-check/test/dry-run build,
  `pnpm run sbom`, `format:check`, and `git diff --check` passed.
- Expo SDK patch alignment applied (`expo@~57.0.7`, `expo-constants@~57.0.6`,
  `expo-router@~57.0.7`) to satisfy Expo Doctor without weakening other pins.
- API: 120 files and 1,090 tests passed, including legal-signing artifact,
  storage-provenance, lifecycle, IDOR, and cash-advance transition regressions.
- API strict type-check and zero-warning lint passed.
- Legacy parity web: 28 test files and 204 tests passed.
- Expo/app-core/UI/edge totals were 11 suites / 37 tests, 9 files / 56 tests,
  2 files / 4 tests, and 7 files / 31 tests respectively.
- Legacy web production build generated all 79 pages. Every reported route was
  below the 650 KiB ceiling; the largest observed route was 607 KiB. `/legal`
  was 453 KiB and public `/sign/[token]` was 194 KiB first-load JavaScript.
- Independent final code and security reviews both returned `APPROVE` after
  the upload cleanup, payroll, cash-proof binding, and message-relinking
  regressions were added; no actionable finding remains in this local tree.

### 3. Universal Expo application

Primary locations:

- `apps/app/app`: Expo Router route tree.
- `apps/app/src`: screens, providers, shell, and platform adapters.
- `packages/app-core`: platform-neutral API/auth/RBAC/redirect code, strict
  profile, Directory, and Leave DTO schemas, and abort-aware domain operations.
- `packages/ui`: React Native-only tokens and reusable Button, Card, TextField,
  SwitchField, StatusMessage, and LoadingState primitives consumed by the Expo
  app.

Configured identity:

- slug: `manut-intranet`;
- scheme: `manut-intranet`;
- iOS bundle ID: `xyz.manut.intranet`;
- Android application ID: `xyz.manut.intranet`.

Implemented auth behavior:

- web uses secure HTTP-only API cookies;
- native uses Supabase PKCE sessions in SecureStore and bearer API requests;
- native callback completion stores the Supabase session before `/auth/me`;
- bearer credentials are never sent to absolute or off-origin API paths;
- sign-in, forgot password, magic link, callback, reset password, password
  change, retry, logout, and session-verification UI exist;
- return-path parsing rejects encoded controls, backslashes, authority tricks,
  and path traversal while retaining safe query strings and browser hashes.

Current Expo routes:

```text
/
/sign-in
/forgot-password
/magic-link
/auth/callback
/reset-password
/change-password
/dashboard
/directory
/leave
/my-portal
/performance
/settings
```

Important parity distinction:

- Auth/recovery routes contain functional universal flows.
- Dashboard contains a real authenticated session summary and logout flow, but
  not source dashboard feature parity.
- Directory provides redaction-aware employee search, runtime department
  filters, pagination, retry, lifecycle-safe manager projection, abort-safe
  transitions, permission-tiered query caches, an employee detail sheet, and a
  read-only org-chart view. Full visual tree parity remains pending.
- Leave provides live exact-decimal balances, carried-balance semantics,
  applicable LeaveType choices, validation, retry, an accessible universal
  request dialog, paginated self-scoped request history, and cancel for
  pending/approved requests (with confirm). Calendar, team/HR actions, and
  subroutes remain pending. Its route admits only `leave:read`/`leave:hr-read`
  users because the current page requires the balances endpoint.
- My Portal is a hub with profile header, leave-balance widgets, and
  permission-gated deep links (not full legacy tab parity).
- Performance provides read-only appraisal list/detail via app-core; cycle
  admin, review submit, and goal writes remain pending. API actor scoping is
  already hardened.
- Dashboard loads `GET /dashboard/stats` for permission-gated KPIs and pending
  actions; charts/wall/compose remain pending.
- Settings loads the authenticated profile, privacy controls, password
  navigation, and local device preferences. Integrations OAuth and admin
  system settings remain pending, so the route stays `foundation`.
- Accepted auth transitions bind React Query state to the current principal and
  authorization fingerprint before protected descendants render. Transient
  verification preserves the existing principal cache; identity or permission
  changes clear it synchronously.
- Therefore all 13 routes remain recorded as `foundation`, not complete parity.

Latest Expo evidence:

- `@manut/app-core`: 9 test files and 56 tests passed; type-check and lint
  passed.
- `@manut/app`: 11 suites and 37 tests passed; auth cache, Directory, Leave,
  Settings, and universal transition regressions are represented.
- `@manut/ui`: lint/type-check passed; 2 test files and 4 tests passed,
  including the 3:1 control-boundary contrast invariant.
- Expo Doctor passed 20/20 checks. A root tooling peer pin makes the app and
  `packages/ui` resolve the same physical React Native 0.86.0 installation.
- Web, iOS, and Android JavaScript exports passed. The current entries are
  1,678 KiB web raw / 405 KiB gzip, approximately 3.7 MB iOS Hermes bytecode,
  and 4 MB Android Hermes bytecode. The enforced web limit is gzip transfer
  size, not raw size.

### 4. Cloudflare edge implementation

Primary files are under `apps/edge/src`:

- `auth.ts`: JWKS/JWT authentication and cookie/bearer normalization;
- `index.ts`: Hono routing, SPA/API boundary, and security middleware;
- `r2-presign.ts`, `upload-intent.ts`, `uploads.ts`: short-lived SigV4 upload
  and download URLs, finalize checks, and private object policy;
- `realtime-room.ts`, `room-protocol.ts`: hibernating Durable Object
  WebSockets, principal-scoped rooms, reconnect, and throttling;
- `queue.ts`: idempotent processing and privacy-safe DLQ messages;
- `platform-boundaries.ts`: typed, fail-closed Cron, Workflow, Container, and
  Hyperdrive integration points;
- `wrangler.jsonc`: unique resource naming contracts for local, development,
  preview, E2E, staging, and production environments.

No D1 binding is used for business data. Local streaming fallback is restricted
to loopback; remote environments use signed R2 operations.

Latest local evidence:

- 7 Worker test files and 31 tests passed;
- strict type-check and zero-warning lint passed;
- the current Wrangler dry run passed with the Expo SPA attached (787.13 KiB
  upload / 137.40 KiB gzip) and no deployment;
- local and preview Wrangler dry runs passed;
- SPA root, deep-link fallback, and `/health` smoke requests returned `200`.

No Cloudflare resource was provisioned or deployed because the locally visible
Cloudflare accounts were not proven to be fresh Manut-owned accounts.

### 5. Database and migration safety

The 198 inherited migrations were removed. The clean baseline is:

```text
packages/database/prisma/migrations/20260717000000_manut_baseline/
```

It contains `migration.sql`, `setup.sql`, and `assert.sql`. Its manifest hash is:

```text
0bc5e890e43aee9185d5daaa47a1706e8345ed7a3e8128a5350e6a58ef82774e
```

`pnpm db:generate` and `pnpm migration:check` passed under Node 24. The local
PostgreSQL replay could not run because Docker failed while creating a
temporary mount with a filesystem I/O error. Do not use or modify an unrelated
local PostgreSQL container as a workaround. The CI job runs a dedicated
PostgreSQL 16 service, applies the migration harness, then runs `db push` twice.

The current migration set is one immutable clean baseline plus five new,
idempotent migrations: DocuSign removal, signature-batch isolation, current
batch tracking, immutable legal-signature artifact binding, and cash-advance
proof binding. Prisma generation and schema validation pass, and the static
migration-safety gate reports `1 clean baseline, 5 new`.

Future migration rules:

1. Never modify or remove a manifest baseline file.
2. Prisma schema changes require a new migration.
3. Each migration requires `setup.sql` and `assert.sql`.
4. Apply through `prisma migrate deploy`.
5. Replay directly once to prove idempotency.
6. Run current-schema `db push` twice to prove staging convergence.

### 6. Dependencies and toolchain

The detailed package-by-package matrix is in
`docs/DEPENDENCY_UPGRADE_SCOPE.md`.

Implemented high-level state:

- Node `24.18.0` and pnpm `11.13.1` declarations;
- Prisma/client `7.8.0` and Zod `4.4.3`;
- Expo SDK `~57.0.6`, Router, React Native `0.86.0`, React/DOM `19.2.3`;
- TypeScript `6.0.3`, ESLint `9.39.4`, and `@eslint/js` `9.39.4` compatibility
  pins;
- requested runtime, types, test, build, and lint upgrades;
- Hono, Wrangler, Cloudflare types/testing/containers, Prisma PG adapter, `pg`,
  `aws4fetch`, and `jose` at the approved versions;
- Anthropic, Google GenAI, Supabase SSR, npm `crypto`, `dayjs`, dotenv-cli,
  legacy ESLint config, and Prettier lint-plugin removals.
- CycloneDX 1.6 SBOM generation passed with 2,254 components; the generated
  `bom.cdx.json` remains ignored.

The live manifest audit found 38/38 requested upgrades, 39/39 target-stack
additions, and 5/5 compatibility pins present. Eight of the 36 planned removals
are complete; the other 28 remain in the legacy bridge described below.

Intentionally retained until Expo parity:

- Next.js and Next lint packages;
- Radix/Base UI/shadcn/lucide/react-day-picker;
- Tailwind/PostCSS and their lint/format plugins;
- Vite React plugin and jsdom used by the parity test surface.

Intentionally deferred to mobile Phase 2:

- `expo-notifications`;
- `expo-device`;
- `expo-sqlite`.

Known compatibility note: an Expo transitive package still declares a
TypeScript 5 peer range while this approved Expo line uses TypeScript 6. Keep
the documented pin and use Expo Doctor plus all three exports as the gate.
The root `supports-color` 8.1.1 development pin is intentional: it unifies the
transitive React Native peer context across `apps/app` and `packages/ui`, so
pnpm resolves one physical native runtime and Expo Doctor remains 20/20.

Additional remaining dependency work:

- expand `packages/ui` route-by-route without adding browser or Node-only
  dependencies;
- retire `socket.io` and `socket.io-client` after Durable Object WebSocket
  traffic and browser/native E2E replace the legacy realtime transport;
- keep Express only for the temporary Container-hosted API boundary;
- pass only newly provisioned Manut-owned R2 credentials into the active
  `aws4fetch` signer in `apps/edge/src/r2-presign.ts`.

### 7. CI and E2E

`.github/workflows/pr-checks.yml` uses only `pull_request` against `main`, has
top-level read-only `contents: read` and `pull-requests: read` permissions,
pins every action by commit SHA, and does not use `pull_request_target`.

Nine prerequisite jobs plus the final aggregator:

1. `changes`
2. `secret-scan`
3. `dependency-review`
4. `static-unit`
5. `web-build`
6. `worker-build`
7. `native-readiness`
8. `migration-safety`
9. `e2e`
10. final `Validate`

The E2E job requires exactly these environment secrets:

```text
E2E_SUPABASE_URL
E2E_SUPABASE_ANON_KEY
E2E_SUPABASE_SERVICE_ROLE_KEY
E2E_DATABASE_URL
E2E_DIRECT_URL
```

They are injected only into the authenticated Playwright execution step, whose
server/setup subprocesses inherit them. Checkout, dependency installation,
Prisma generation, browser installation, and artifact upload do not receive
the E2E credentials.

The harness validates the dedicated-project marker before resetting `public`,
creates confirmed random-password admin and employee users server-side, seeds
minimal RBAC/leave data, serializes execution through one concurrency group,
uses one Chromium worker and one retry, fails on flaky tests, and deletes
runtime users afterward. Setup and cleanup do not capture traces or video.

Current E2E limitation: most admin/employee parity tests still start the legacy
Next web server, while `expo-web.spec.ts` exercises the new Expo surface. Move
each test to Expo as its route reaches behavioral parity. Do not remove the
legacy server from `playwright.config.ts` until no approved scenario depends on
it.

## Remaining implementation plan

Follow this order. Do not skip directly to external provisioning while local
parity or clean-room checks are incomplete.

### Phase A: finish the current local integration

1. Finish the remaining provenance/comment sweep.
2. Search staged source and documentation for prohibited names, company data,
   old employee prefixes, provider identifiers, old package scopes, and asset
   hashes. Do not paste raw credential candidates into logs or documentation.
3. Reconcile `docs/DEPENDENCY_UPGRADE_SCOPE.md` with the final manifests and
   active `aws4fetch` R2 signing implementation.
4. Expand the new `packages/ui` primitives as route slices are migrated; do not
   pull browser-only dependencies into it.
5. Run Prettier on touched files and `pnpm format:check` across the repository.
6. Run the full Node 24 gate listed below.
7. Fix failures without weakening strictness, zero-warning lint, secret rules,
   migration immutability, or bundle thresholds.

### Phase B: complete Expo web parity

Use `docs/ROUTE_DISPOSITION.json` as the source of truth. Every route remains
one of `migrate`, `replace`, or `remove-as-provenance`; no source route may
silently disappear.

Migration order:

1. Finish Phase 1 behavior: dashboard, directory, employee portal,
   Performance, Leave, and the remaining Settings preferences/integration
   slices. Preserve the accepted Settings profile/privacy slice.
   **Status 2026-07-17:** Performance appraisals (read-only), My Portal hub,
   leave history pagination, directory org chart, dashboard KPIs/pending
   actions, and local Settings preferences are in Expo as `foundation`
   slices. Integrations OAuth, leave subroutes, and full dashboard charts
   remain. Move Playwright employee/leave coverage from `:3000` to Expo
   `:8081` as authenticated secrets become available.
2. HR/people and approvals: HRMS, travel, visa, expenses, cash advance,
   payroll, benefits, attendance, learning, career, applications, office,
   employees, roles, and related approval screens.
   **Status 2026-07-17:** Wave 2 — Travel (self list/create/cancel + inbox
   approve/reject + URL attachments), Expenses (self list/detail + draft
   create/line/submit with optional receipt URL), and admin Employees/Roles
   (read-only) are `foundation`. R2 uploads, dedicated approval routes, FX,
   and `/hrms` ESOP/onboarding/attendance still pending.
3. Operations: Sales/CRM, investor-approved modules, projects, helpdesk,
   accounting/revenue, content, communications, reporting, and administration.
   **Not started.**
4. Files, realtime messaging, integrations, document processing, and only
   newly approved Manut AI features through Workers AI/AI Gateway.
   **Not started.**

For each route slice:

1. Read the legacy page only as behavioral reference.
2. Move DTOs, Zod validation, API calls, React Query hooks, permissions, and
   actions into `packages/app-core` when reusable.
3. Build responsive React Native components in `packages/ui` or `apps/app`.
4. Add a narrow `.web.tsx`/`.native.tsx` adapter only for a genuine platform
   boundary such as dense tables, drag/drop, rich text, downloads, secure
   storage, or native dialogs.
5. Keep API authorization authoritative; route visibility is not an
   authorization control.
6. Add unit tests and Playwright behavior for the new Expo route.
7. Export web, iOS, and Android before moving to the next slice.
8. Update both route-disposition files. Keep `foundation` until behavior and
   browser acceptance are proven; introduce a clearly documented `parity`
   state only when CI validates its meaning and counts.

Do not copy source branding, sample records, company-specific text, binary
assets, migration SQL, or provider configuration while migrating behavior.

### Phase C: retire the legacy web bridge

Only after every approved route has Expo parity and browser E2E:

1. Remove `apps/web`.
2. Remove Next.js, Radix/Base UI/shadcn/lucide/react-day-picker,
   Tailwind/PostCSS, Vite React, and jsdom bridge dependencies.
3. Remove legacy web tasks from Turbo, Playwright, CI, Docker files, and docs.
4. Make Expo web the only browser server and artifact.
5. Re-run dependency review, OSV, SBOM, type-check, lint, tests, all exports,
   bundle limits, and artifact scans.

### Phase D: final local verification and replacement commit

Run sequentially where noted; do not run the Next build concurrently with root
type-check because both can update `.next` type output.

```bash
source /Users/kunanonjarat/.nvm/nvm.sh
nvm use 24.18.0

pnpm install --frozen-lockfile
pnpm db:generate
pnpm migration:check
pnpm type-check
pnpm lint
pnpm test

pnpm --filter @manut/web build
pnpm --filter @manut/app export:web
pnpm bundle:check

pnpm --dir apps/app exec expo-doctor
pnpm --filter @manut/app export:ios
pnpm --filter @manut/app export:android

pnpm --filter @manut/edge type-check
pnpm --filter @manut/edge test
pnpm --filter @manut/edge build

pnpm security:credentials \
  apps/app/dist \
  apps/app/dist-ios \
  apps/app/dist-android \
  apps/edge/dist \
  apps/web/.next

pnpm run sbom
pnpm format:check
git diff --check
```

The local migration harness additionally requires a healthy isolated Docker
daemon and must not reuse an unrelated database:

```bash
pnpm migration:harness
```

After every gate is green and the route parity acceptance is actually met:

```bash
git add -A
git diff --cached --check
pnpm security:credentials
gitleaks git --staged --redact --no-banner --config .gitleaks.toml .
git diff --cached --stat
git commit -m "feat(migration): replace Manut with universal intranet"
```

Verify the new commit is a descendant of the correct parent and scan only the
range that would enter the pull request:

```bash
git merge-base --is-ancestor eb797d30 HEAD
CREDENTIAL_SCAN_BASE_SHA=eb797d30 pnpm security:credentials
gitleaks git --redact --no-banner --config .gitleaks.toml \
  --log-opts="eb797d30..HEAD" .
git status --short
```

Do not commit `.agents`, generated Prisma clients, build exports, source maps,
Playwright storage state, test artifacts, SBOM output, or provider files.

### Phase E: fresh Manut environment provisioning

This phase requires verified Manut-owned authority and should not be attempted
from an inherited provider account.

1. Create fresh Cloudflare development, preview, E2E, staging, and production
   resources with unique Worker/R2/Queue/Workflow/Container/Hyperdrive
   bindings. Configure private bucket CORS and secrets per environment.
2. Create the dedicated `manut-intranet-e2e` Supabase project and add only the
   five approved E2E environment secrets.
3. Create or verify a fresh Manut Expo organization, connect the project, then
   produce one Android internal APK and one iOS simulator build. Do not submit
   to either store in this migration.
4. Rotate/revoke inherited Supabase, Google/GCP, GitHub OIDC, Railway,
   analytics, AI/email, Expo/EAS, and Cloudflare credentials. The DocuSign
   integration is removed, but any previously issued DocuSign credentials must
   still be revoked out-of-band and proven invalid before merge; no revocation
   has been performed or claimed by this code change.
5. Revoke sessions and prove old credentials fail. Store only evidence links or
   HMAC fingerprints in the private cutover record, never raw values in Git.
6. Run authenticated E2E and artifact scans using only fresh resources.

### Phase F: GitHub repository cutover and pull request

After authenticated GitHub authority is restored:

1. Export current repository settings, environment/workflow names, and PR
   metadata before mutation.
2. Verify the offline mirror and archive refs again.
3. Close the obsolete Dependabot pull request.
4. Use GitHub's permanent leave-fork-network operation.
5. Verify `isFork=false`, then make the repository private.
6. Protect `main`: pull request required, one approval, conversation
   resolution, required `Validate`, no force-push, and no deletion.
7. Publish only:
   - `archive/affine-2026-07-16`;
   - `affine-before-intranet-2026-07-16`;
   - `claude/intranet-full-hardening`.
8. Open one replacement PR into `main` and do not merge until every required
   job is green and the PR is approved.
9. After merge, update the private repository description/topics and clear the
   obsolete homepage. Keep deployment disabled and `manut.xyz` unchanged.

## External blockers to preserve explicitly

- GitHub Free org plan cannot enable private-repo branch protection / rulesets
  (403); upgrade `mygogocash` to Pro (or GitHub Team) before requiring
  `Validate` on `main`.
- No fresh Manut Cloudflare account/resource authority is available locally.
- No fresh Manut Expo organization is available locally.
- The dedicated E2E Supabase project and secrets are not configured.
- Provider-side revocation and negative authentication evidence are absent.
- Phase C (`apps/web` retirement) and merge remain blocked until Expo route
  parity + browser E2E acceptance and Phase E evidence exist.
- A locally running Cursor worker was observed with a provider credential in
  its process arguments. Do not copy the value into logs or Git. Rotate it and
  restart the worker with a safer secret transport before relying on that
  environment for cutover evidence.
- Local Docker has a filesystem I/O failure that blocks the isolated migration
  replay; CI covers the intended PostgreSQL 16 execution path once the PR can
  run.

These are merge blockers, not reasons to weaken or bypass tests.

## Final acceptance checklist

- [ ] Full approved Expo web parity; no pending migration routes.
- [ ] Web, iOS, and Android exports pass from the same route tree.
- [ ] Main Expo route bundles are at or below 650 KiB gzip transfer size.
- [ ] Legacy Next.js bridge and its dependencies are removed after parity.
- [ ] Strict root/API type-check, zero-warning lint, and all tests pass.
- [ ] Expo Doctor and Worker dry-run pass.
- [ ] Clean migration baseline and every later migration pass PostgreSQL 16
      deployment, assertion, idempotent replay, and two `db push` runs.
- [ ] Gitleaks and HMAC provenance scans pass for the staged tree, PR range,
      ignored credential inventory, and generated artifacts.
- [ ] CycloneDX SBOM and dependency/OSV review have no unreviewed high or
      critical finding.
- [ ] Authenticated E2E passes against only `manut-intranet-e2e`.
- [ ] Fresh Manut Cloudflare, Supabase, and Expo ownership is proven.
- [ ] Inherited credentials are revoked and negative tests prove failure.
- [ ] Repository is private and `isFork=false`.
- [ ] Both archive refs resolve to `eb797d30` remotely.
- [ ] `main` protection requires approved green `Validate`.
- [ ] No active deployment workflow exists.
- [ ] `manut.xyz` remains unchanged.
- [ ] Replacement branch remains descended from the Manut parent and imports
      no source repository history.

## Control documents

- `docs/REPOSITORY_MIGRATION.md`: provenance, backup, deployment boundary, and
  rollback.
- `docs/ROUTE_DISPOSITION.md` and `.json`: all 103 source routes and current
  status.
- `docs/DEPENDENCY_UPGRADE_SCOPE.md`: complete package upgrade/add/remove/pin
  matrix.
- `docs/CREDENTIAL_BOUNDARY.md`: clean provider and credential rules.
- `docs/AUTH_RBAC.md`: shared cookie/bearer auth and permission behavior.
- `.github/workflows/pr-checks.yml`: executable CI acceptance contract.
- `scripts/check-credential-boundary.mjs`: HMAC provenance scanner.
- `scripts/check-migration-safety.mjs` and
  `scripts/run-migration-harness.mjs`: migration policy and replay.
