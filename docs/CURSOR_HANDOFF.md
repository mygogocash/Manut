# Cursor handoff: Web-first Manut migration

> **Historical / continuation evidence.** The sole forward-looking architecture
> and migration roadmap is
> [`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](./EXPO_CLOUDFLARE_MASTER_PLAN.md).
> If this handoff conflicts with that file, the master plan wins. SoR dual-track:
> [`ADR-010`](./ADR-010-postgres-strangler-vs-d1-target.md). Dependency freeze:
> [`DEPENDENCY_FREEZE.md`](./DEPENDENCY_FREEZE.md).

Last updated: 2026-07-19

This file records what is actually implemented, what was verified, what is
still incomplete, and which operations require fresh Manut-owned authority. It
is **not** a second roadmap.

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
| Current `HEAD`              | `4457eff77363451b42339b783d485298629a736e`                    |
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

| Workstream                           | State                                                                           | Evidence and remaining condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline backup and archive refs      | **Remote + local complete**                                                     | Bare mirror verified; local and remote `archive/affine-2026-07-16` + `affine-before-intranet-2026-07-16` peel to `eb797d30`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Clean-room tree boundary             | **Replacement PR open**                                                         | Commits `7d8b17a2` + `640c505a` (+ follow-ups) on `claude/intranet-full-hardening`; PR `#208` opened against `main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| GitHub detachment/private/protection | **Detached; visibility/protection truth updated (P0-E3)**                       | `fork=false`; About/topics Manut. **2026-07-19 `gh`:** **public** (`private=false`), org plan **free**, `main` protection **404**, rulesets `[]`. CodeQL managed `Analyze (ruby)` still fails (no Ruby sources); red merges to `main` proven (e.g. PR #219 with failed `Validate`). Ops checklist: `docs/ops/CI_PROTECTION_TRUTH.md` — drop Ruby; protect `main` (public Free now, or Pro then private). Docs only — settings not flipped from git.                                                                                                                                                                                                              |
| Source-organization removal          | **Phase A sweep complete locally**                                              | Credentials, branding, proprietary AI/marketing modules, identity-bearing migrations, and seeds were removed or replaced. HMAC provenance scan and comment sweep passed 2026-07-17.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| API strictness and hardening         | **Implemented locally**                                                         | Strict TypeScript, webhook bytes, purge lifecycle, lifecycle-safe auth/RBAC, atomic Leave state changes, live-socket revalidation, Performance scoping, and profile projection are implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Universal Expo foundation            | **Implemented**                                                                 | Expo SDK 57, shared API/session runtime, app-core/UI packages, auth transports, app shell, Expo Doctor, and three-platform exports pass. This is a foundation, not full route parity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Approved web route parity            | **Foundations landed; deepen + E2E remain**                                     | Inventory: **88 foundation**, **0 pending**, **16 removed** (plus Expo-only `/files`). Waves 2–4 Expo route foundations are in tree; `/messages` DO shared-room + bus→DO bridge (socket.io fallback); survey question replace/publish landed (announce/analytics still deferred); Expo E2E cutover remain.                                                                                                                                                                                                                                                                                                                                                            |
| Cloudflare edge layer                | **Locally implemented + Hyperdrive deepen (messages/deals/survey/HR/projects)** | Worker auth, SPA assets, R2, DO realtime, Queues/DLQ, rate limits, Workflows/Container stubs; Hyperdrive dual-path for messages (incl. `attachmentIds`), deals (list/create/pipeline/get/put; hard-delete proxied), survey lifecycle (schedule/close/archive/responses/analytics; announce still proxied), projects (list/detail/task create), expenses (`pendingForMe`/submit/approvals/FX + self CRUD), leave (self + approve/reject/cancel), cash-advance (self + approve/reject/disburse/clear; signed receipt GET proxied), visa/payroll/benefits/learning catalogs. Fresh Hyperdrive id / deploy not provisioned. See `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`. |
| Clean PostgreSQL baseline            | **Implemented**                                                                 | One sanitized baseline plus hash manifest, setup/assert scripts, and migration harness exist. Local Docker replay is blocked; CI PostgreSQL 16 lane is ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dependency upgrades                  | **Mostly implemented**                                                          | Requested upgrades, compatibility pins, Expo, and Cloudflare packages are present. Legacy Next/Tailwind/Vite/jsdom bridge packages remain until parity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CI decomposition                     | **Implemented locally**                                                         | Nine prerequisite jobs plus final `Validate`, pinned actions, read-only contents/PR metadata, and no `pull_request_target`. Not run on GitHub yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Authenticated E2E                    | **Harness implemented; live run blocked**                                       | Dedicated-project guard, runtime personas, reset/seed/cleanup, serialized Playwright, and failure-only artifacts exist. Five environment secrets and a fresh E2E project are missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Native internal builds               | **Blocked externally**                                                          | JavaScript exports pass. Android internal APK and iOS simulator EAS builds require a fresh Manut Expo organization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Credential revocation proof          | **Blocked externally**                                                          | Provider-side revocation and negative authentication evidence require authorized Manut-owned accounts. A local Cursor worker also requires credential rotation after command-line exposure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Final acceptance and merge           | **Not started**                                                                 | Requires parity, complete local gates, replacement commit, remote resources, green PR, approval, and verified repository settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

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
  pending/approved requests (with confirm). Month team calendar, team/HR
  approve/reject inbox, and read-only `/leave/holidays`, `/leave/approval`,
  and `/leave/policies` foundation slices are linked when permitted. Policy
  CRUD/import and richer calendar filters remain pending. The main `/leave`
  leaf admits only `leave:read`/`leave:hr-read` users because the page
  requires the balances endpoint.
- My Portal is a hub with profile header, leave-balance widgets, and
  permission-gated deep links (not full legacy tab parity).
- Performance provides read-only appraisal list/detail via app-core; cycle
  admin, review submit, and goal writes remain pending. API actor scoping is
  already hardened.
- Dashboard loads `GET /dashboard/stats` for permission-gated KPIs, pending
  actions, and simple expense/project/department chart series; wall/compose
  remain pending.
- Settings loads the authenticated profile, privacy controls, password
  navigation, local device preferences, Google Workspace connect/disconnect
  (`integrations:use`), and read-only admin system settings (`admin:manage`;
  secret-like keys omitted). PUT save and Gmail/Drive product screens remain,
  so the route stays `foundation`.
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
- `platform-boundaries.ts` / `hyperdrive.ts`: typed, fail-closed Cron,
  Workflow, Container, and Hyperdrive integration points (Postgres only via
  `HYPERDRIVE_DATABASE.connectionString` when the boundary is on);
- `messages/*`: dual-path `/api/messages` on Hono — Hyperdrive+Prisma for
  channels (list/get/create/update/delete), DMs, users, unread-count, read,
  typing, hide, message list/send/delete, and `attachmentIds` link on send
  (FileUpload `linkedTo=message`, excluding module-controlled purposes) with
  list enrichment when `ENABLE_HYPERDRIVE_BOUNDARY=true` + binding present;
  explicit Express proxy when the boundary is off; DO fan-out stays on the
  edge write path (Socket.IO unchanged as client fallback);
- `deals/*`: dual-path `/api/deals` — Hyperdrive+Prisma for `GET /` list
  (own-scope unless `crm:team-read`), `POST /` create, `/pipeline`, and
  `GET/PUT /:id`; client projection strips notes/owner email; **still
  proxied:** `DELETE /:id` (Deal has no soft-delete; Express hard-deletes —
  do not hard-delete on Hyperdrive until a soft-delete contract exists);
- `survey-engine/*` + `survey/*` + `survey-forms/*`: dual-path for both
  `/api/survey` and `/api/survey-forms` — Hyperdrive+Prisma for list (scope
  available/mine/all + archived manager gate), get-by-id, create, `PUT
/:id/questions`, `POST /:id/publish` (no announce body), `POST
/:id/responses`, `GET /:id/my-response`, schedule, close/reopen,
  archive/unarchive, GET responses (emails stripped), analytics,
  announcement/notification settings; mirrors Express
  `survey:manage` / `survey:manage-wave` + owner/audience rules; strips
  creator email and targeting arrays on the edge projection; **still
  proxied:** announce-on-publish and `POST /:id/announce` (wall/news/
  companyDate side-effects), PUT/DELETE form metadata;
- `projects/*`: dual-path `/api/projects` — Hyperdrive+Prisma for `GET /`
  list (owner/member scope; `projects:read-all` / team `*-crm:read-all`
  widen), `GET /:id` detail with kanban columns + top-level tasks
  (emails/budget/comments stripped), and `POST /:id/tasks` create
  (`title`/`status`/`priority` P0–P2); **still proxied:** dashboard,
  import/reorder, members, milestones, task update/delete, other CRM hubs;
- `expenses/*`: dual-path `/api/expenses/reports` — self-scoped `GET` list +
  `POST` create (office category HR-gated) + self-owned `GET /reports/:id` +
  self line `POST/PUT/DELETE …/expenses` on `draft|rejected` (receipts when
  `TRUSTED_STORAGE_ORIGINS` + FileUpload provenance allow) + `pendingForMe`
  / submit / approvals / date-as-of FX totals on Hyperdrive; **still
  proxied:** raw `/expenses` items, meta, paths that still need Express-only
  storage signing;
- `leave/*`: dual-path self-scoped `GET /api/leave/requests` + self
  `POST /requests` (balance check, overlap, auto-approve consume, approval-
  chain snapshot with manager fallback; emails/analytics deferred) +
  `PUT …/approve|reject|cancel` with Express-mirrored self/manager/HR/WFH/
  delegate/chain rules; HR on-behalf create (`employeeId` ≠ caller) stays
  proxied; **still proxied:** balances, types catalog, richer team/HR
  filters beyond the approve path;
- `cash-advance/*`: dual-path self-scoped `GET /api/cash-advance` (`scope`
  mine/default) + `POST` create without receipt URLs + `POST /:id/submit`
  (approval-chain snapshot; email notify deferred) +
  `POST /:id/approve|reject|disburse|clear` with `assertCanActOnStep` and
  registered disbursement-proof provenance when `TRUSTED_STORAGE_ORIGINS`
  is set; **still proxied:** signed receipt GET and disbursement-proof GET
  (Supabase JWT signing is not Worker-safe; R2 `aws4fetch` covers transfer
  intents only);
- `visa/*` + `visa-kb/*` + `visa-checklist/*`: dual-path employee
  self-scoped `GET /api/visa` (HR `visa:hr-read` / `visa:manage` lists
  stay proxied), plus catalog `GET /api/visa-kb` and
  `GET /api/visa-checklist/templates` (`visa:manage`); **still proxied:**
  detail/download/timeline, KB writes / for-record, checklist writes /
  per-record items;
- `payroll/*`: dual-path self-scoped `GET /api/payroll/runs` (runs that
  include a payslip for the caller; strips notes/emails/currencyTotals) +
  `GET /api/payroll/my-payslips` (strict self-scope; projects
  `hasDocument` and strips `documentUrl`/allowances/deductions/FX bases);
  manager (`payroll:create|approve|hr-admin`) company-wide lists stay
  proxied; **still proxied:** payslip download/export (Supabase sign +
  Node qpdf DOB protect), create/approve, approval-chain;
- `benefits/*` + `learning/*`: dual-path catalog reads — `GET /api/benefits`
  and `GET /api/learning/modules`; enrollments/completions/manage stay
  proxied;
- `rbac.ts`: shared Hyperdrive permission loader (roles + module grants);
- `wrangler.jsonc`: unique resource naming contracts for local, development,
  preview, E2E, staging, and production environments. `hyperdrive: []` stays
  empty until a Manut-owned Hyperdrive config id is supplied.

No D1 binding is used for business data. Local streaming fallback is restricted
to loopback; remote environments use signed R2 operations.

**Hyperdrive enable steps (names only; no live provisioning in this branch):**

1. Create a Manut-owned Hyperdrive config against the authoritative Postgres.
2. Set wrangler `hyperdrive: [{ "binding": "HYPERDRIVE_DATABASE", "id": "<id>" }]`
   (optional `localConnectionString` /
   `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_DATABASE` for local).
3. Set var `ENABLE_HYPERDRIVE_BOUNDARY=true` per environment.
4. Keep `API_ORIGIN` configured for Express fallback routes and auth JWKS.

Latest local evidence (2026-07-18 parallel Hyperdrive + Expo deepen reconcile):

- 20 Worker test files and 155 tests passed (messages attachments, projects
  dual-path, survey lifecycle, leave/CA approvals, expenses pending/submit/
  approvals/FX, plus prior HR/messages/deals/survey coverage);
- Expo deepen: expenses/CA pending inboxes, survey manage (announce/schedule/
  analytics/archive), deals pipeline kanban + notes, project board task
  create/reorder/edit/delete + members read (emails stripped);
- `TRUSTED_STORAGE_ORIGINS` wrangler var / `.env.example` documented (empty =
  managed receipt writes still proxy to Express);
- Deploy workflows remain `deploy.yml.disabled` / `deploy-staging.yml.disabled`;
- No Hyperdrive id or Cloudflare deploy was performed.

No Cloudflare resource was provisioned or deployed because the locally visible
Cloudflare accounts were not proven to be fresh Manut-owned accounts.

**Remaining Cloudflare gaps (next modules):**

- Deals hard-delete stays Express (no soft-delete lifecycle); analytics fan-out
  on deal stage changes stays Express;
- Survey announce (wall/news/companyDate) and survey-forms PUT/DELETE metadata
  stay proxied;
- Projects dashboard/import/reorder/members/milestones/task update-delete and
  other CRM hubs stay proxied;
- Leave balances/types catalog; CA signed receipt / disbursement-proof GET
  (JWT signing not Worker-safe);
- Payroll signed download / Node PDF-export (keep proxied until storage +
  qpdf story is edge-safe);
- Provision fresh Manut Hyperdrive / R2 / Queue / DO / Worker envs (Phase E) —
  see `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`;
- Workflow authorization contract + Container API hosting remain stubs;
- Authenticated Expo E2E against a provisioned edge origin.

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

**PR #208 CI triage (run `29593883641` / CodeQL `29593881188`, 2026-07-17):**

| Check                   | Cause                                                                                            | Owner / fix                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| CodeQL `Analyze (ruby)` | Default setup runs Ruby; tree has no Ruby sources → “could not process any code written in Ruby” | Repo/org Code scanning default setup: drop Ruby (keep `javascript-typescript` only). Not fixable in app code.                  |
| Authenticated E2E       | `e2e` environment secrets empty (`E2E_SUPABASE_URL` … all blank)                                 | Provision dedicated `manut-intranet-e2e` + five approved secrets on the `e2e` environment. Do not weaken the fail-closed gate. |
| `Validate`              | Aggregator only — failed because `dependency-review`, `static-unit`, and `e2e` failed            | Clears when those three are green. Not independent product noise.                                                              |
| Dependency review (OSV) | Lockfile hits (e.g. `@hono/node-server`, `@xmldom/xmldom`, `minimatch`, `xlsx`, …)               | Patch/bump reviewed deps; do not disable OSV.                                                                                  |
| Static and unit         | Lint `import/no-unresolved` on `@/features/settings/preferences-storage` (`.web`/`.native` pair) | Fixed in `apps/app/eslint.config.mjs` ignore list (same pattern as `@/platform/*`).                                            |

JS/TS CodeQL, Secret scan, Web/Worker/Native builds, and Migration safety already passed on that run.

**External ops checklist (cannot complete from this worktree alone — 2026-07-18):**

| Item                                   | Owner         | Status / next action                                                                            |
| -------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| E2E secrets + dedicated project        | Ops           | **Verified empty** (`GET …/environments/e2e/secrets` → `total_count: 0`). Still blocked: five `E2E_*` on `e2e` env + `manut-intranet-e2e`. Do not soft-skip the gate. |
| CodeQL Ruby language                   | Repo settings | **Still failing on `main`** (run `29646398325` — `Analyze (ruby)` only). Drop Ruby from default Code scanning setup (JS/TS already passes). |
| OSV / dependency-review bumps          | Eng           | **Patchable cleared (#217).** Residual `quill@2.0.3` (GHSA-v3m3-f69x-jf25 / Dependabot #149) formally accepted — no upstream patch; compensating `sanitizeRichHtml`; scoped to `apps/web`. Documented in `docs/CREDENTIAL_BOUNDARY.md`. **Do not soft-skip OSV.** |

| CodeQL Ruby language                   | Repo settings | **Still failing on `main`** (run `29668738507` — `Analyze (ruby)` only; annotation: no Ruby source). Drop Ruby from managed Code scanning (JS/TS already passes). See `docs/ops/CI_PROTECTION_TRUTH.md`. |
| OSV / dependency-review bumps          | Eng           | **Eng slice (2026-07-18):** pnpm overrides for `@xmldom/xmldom@<0.8.13` → `0.8.13`, `@hono/node-server@<1.19.13` → `1.19.14`, `minimatch@>=5 <5.1.8` → `5.1.9`; `eas-cli` → `21.0.2`. Residual: `quill@2.0.3` XSS (low, no upstream patch; `apps/web` `react-quill-new` only). Keep OSV fail-closed. |
| Static-unit platform ignore            | Eng           | Preferences-storage `.web`/`.native` ignore landed; re-check CI if new unresolved pairs appear. |
| GitHub Free / branch protection        | Org           | **2026-07-19:** plan still `free`; repo **public**; `main` unprotected (404) / rulesets `[]`. Red merges proven. Protect now on public Free, or Pro then private — checklist in `docs/ops/CI_PROTECTION_TRUTH.md`. |
| Phase E Cloudflare / Expo / Hyperdrive | Ops           | Fresh Manut-owned resources only; checklist in `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`. No deploy from eng branches. |
| Credential revocation proof            | Ops           | Negative auth evidence + rotate any exposed worker secrets out-of-band.                         |

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
   **Status 2026-07-18:** Performance appraisals (read-only), My Portal hub,
   leave history pagination, directory org chart, dashboard KPIs/pending
   actions + chart series, Settings preferences + Google OAuth, and leave
   holidays/approval read-only subroutes are in Expo as `foundation` slices.
   Leave calendar + team/HR approve/reject + `/leave/policies` foundation
   landed 2026-07-18. Admin system settings read-only (`admin:manage`) landed
   on `/settings`. Wall/compose remains (strip until productized). Playwright
   employee/leave projects now target Expo `:8081` (auth setup + selectors +
   credentialed CORS for cookie sessions). Hosted run still blocked until the
   five `E2E_*` secrets and dedicated E2E project exist — do not soft-skip.
2. HR/people and approvals: HRMS, travel, visa, expenses, cash advance,
   payroll, benefits, attendance, learning, career, applications, office,
   employees, roles, and related approval screens.
   **Status 2026-07-18 (reconcile):** Wave 2 HR spine foundation complete —
   Travel (+ `/travel/approval` steps), Expenses (+ `/expenses/[reportId]`
   - `/expenses/approval`), admin Employees/Roles, `/hrms` (+
     `/hrms/grants/[employeeId]`), `/visa` (+ checklist-templates +
     knowledge-base), `/cash-advance` (+ approval), `/payroll` (+
     `/payroll/approval`), `/benefits`, `/learning`, `/office`, `/careers`,
     `/applications`. Leave calendar/team approve + `/leave/policies` landed.
     Still deferred (deepen, not missing routes): office book-self + manage;
     careers apply/manage; applications status writes; payroll
     create/approve/payslip export; benefits enroll/manage; learning
     manage/complete; HRMS pool/import/offboarding; visa CRUD/90-day;
     cash-advance native R2 picker + signed proof GET; expense detail lines +
     R2 receipts; wall/compose.
   3. Operations: Sales/CRM, investor-approved modules, projects, helpdesk,
      accounting/revenue, content, communications, reporting, and administration.
      **Status 2026-07-18 (reconcile):** Wave 3 route foundations complete for
      migrate targets — `/it-helpdesk`, `/projects` list/detail/dashboard,
      `/accounting`, `/revenue`, `/sales`, `/partners` (+ detail), investor
      modules (`/investors`, `/investor-updates`, `/dataroom`), OTHER CRM hubs
      (`/it-crm`, `/it-crm/dashboard`, `/product-crm`, `/legal-crm`,
      `/accounting-crm`, `/qa-crm`, `/qa-crm/[projectId]`, `/voucher-crm`,
      `/hr-crm`, `/investor-crm`, `/sales-revenue`, `/deals`), content/comms
      (`/blog-management`, `/docs`, `/legal` + announcements/shared,
      `/pr-management`), admin (`/admin`, `/admin/form-config`), IT ops
      (`/it-operations` + access/billing), `/policies`, `/certificates`, and
      survey list/detail/respond/new shells (`/survey`, `/survey-forms`).
      **Survey deepen (2026-07-18):** draft create on `/survey/new` +
      `/survey-forms/new` (manage-gated POST), `/survey/[id]/respond`
      answer submit, and manage-gated question list editors + publish on
      `/survey/[id]` (`survey:manage`) and `/survey-forms/[id]`
      (`survey:manage-wave`) via `PUT …/questions` + `POST …/publish`
      (app-core Zod; no announce payload). Disposition stays `foundation`
      until Expo E2E. Still deferred: announce/schedule/analytics/archive,
      full drag-reorder parity with web, survey-forms respond submit,
      targeting UI.
      **Projects CRM deepen (2026-07-18):** `/projects/[projectId]` now reads
      kanban columns + tasks from `GET /projects/:id` (emails/budget stripped in
      app-core) and creates tasks via `POST /projects/:id/tasks` with
      `createProjectTaskInputSchema` + `projects:update` / team-CRM
      `*:update`/`*:manage` client gate. Disposition stays `foundation`.
      **Deals create deepen (2026-07-18):** `/deals` list stays foundation; one
      write lands via app-core `createDeal` + `createDealInputSchema` →
      `POST /api/deals`, Expo form gated by `deals:create`/`deals:manage`, list
      query invalidated on success (notes/email/partner still stripped). Deferred:
      pipeline kanban, stage drag, notes editor, delete.
      **CRM deepen pattern for other hubs** (`/it-crm`, `/product-crm`,
      `/legal-crm`, `/qa-crm`, …): (1) extend the existing detail/list DTO to
      project board columns + task cards without emails/budget/member PII;
      (2) add one write (`createTask` / status patch) with Zod in
      `packages/app-core` mirroring the API validation; (3) permission-gate the
      Expo form; (4) unit + screen tests; (5) leave disposition `foundation`
      until Expo E2E. Do not deepen every CRM hub in one slice.
      Still deepen (not missing routes): journals/invoices/bank/approve-post,
      revenue detail tabs, reporting, helpdesk writes/comments/GitHub, project
      drag-reorder / task edit-delete / members, deals pipeline/kanban/notes,
      survey announce / schedule / analytics / archive, other CRM
      board/tasks/import/create.

3. Files, realtime messaging, integrations, document processing, and only
   newly approved Manut AI features through Workers AI/AI Gateway.
   **Status 2026-07-18 (parallel Hyperdrive + Expo deepen reconcile):**
   `/messages` Expo sends via REST and receives live
   `message.created`/`message.deleted` preferring the edge Durable Object
   shared room `channel:{channelId}` (membership via Hyperdrive+Prisma when
   `ENABLE_HYPERDRIVE_BOUNDARY` is on, else Express
   `GET /api/messages/channels/:id` before WS upgrade). Worker
   `/api/messages` dual-path covers channels/DMs/users/unread/read/typing/hide,
   message list/send/delete, and `attachmentIds` link + list enrichment on
   Hyperdrive (DO fan-out on writes). `/api/deals` dual-path: list + create +
   pipeline + get-by-id + put on Hyperdrive (`crm:team-read` owner scope;
   notes/email stripped); hard-delete still proxies (no soft-delete rules).
   `/api/survey` + `/api/survey-forms` dual-path: list, detail, create,
   questions replace, publish (no announce), respond, my-response, schedule,
   close/reopen, archive/unarchive, responses list, analytics, settings;
   announce-on-publish / `POST /:id/announce` still proxy. `/api/projects`
   dual-path: list, detail (kanban + tasks), task create; reorder/members/
   milestones/task update-delete still proxy. Portable `trusted-storage`
   helper + FileUpload lookup: managed URLs require `TRUSTED_STORAGE_ORIGINS`
   - bucket allowlist + purpose/ownership registry. HR deepen: expenses
     `pendingForMe`/submit/approvals/FX + self CRUD; cash-advance
     approve/reject/disburse/clear (+ receipts when safe); leave
     approve/reject/cancel; payroll my-payslips; benefits/learning/visa
     catalogs. Expo deepen (disposition stays `foundation`): expenses/CA
     pending inboxes, survey manage UX, deals pipeline kanban + notes, project
     board writes. Express `messageBus` still fans to the DO when
     `EDGE_REALTIME_ORIGIN` + `EDGE_REALTIME_BRIDGE_SECRET` (must match Worker
     `EDGE_SIGNING_KEY`) are set; socket.io `/messages` remains the client
     fallback when unset. Fail closed: missing `REALTIME_ROOMS` / `API_ORIGIN`
     / bridge secret / Hyperdrive binding (when flagged on) rejects the
     edge-native path. Phase E ops checklist:
     `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`.
     **Next CF module candidates:** deals soft-delete contract, survey announce
     side-effects, projects reorder/members/milestones, leave balances/types,
     CA signed receipt GET, payroll PDF export.

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

Deploy-readiness (code-ready vs ops-blocked, binding names, cutover order,
local dry-run evidence): **`docs/PRODUCTION_DEPLOY.md`**. Deploy workflows
remain `.disabled`; do not enable them from this branch.

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

- **CI / protection (P0-E3, 2026-07-19):** repo is **public** and **unprotected**
  on GitHub Free; CodeQL Ruby fails; failed-`Validate` PRs have merged. Full
  evidence + ops checklist: `docs/ops/CI_PROTECTION_TRUTH.md`. Private +
  required checks still needs Pro/Team; public Free can enable protection now
  if owners accept public visibility.
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

- `docs/PRODUCTION_DEPLOY.md`: production deploy readiness matrix, env/binding
  names, cutover order, and mechanical re-enable notes (deploy remains disabled).
- `docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`: Phase E Hyperdrive / realtime / E2E / retirement checklist (deploy remains disabled).
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

### Cloudflare Hyperdrive + Expo deepen status (2026-07-18 reconcile)

Parallel slices landed on `claude/intranet-full-hardening` (ops checklist:
`docs/CLOUDFLARE_MIGRATION_CHECKLIST.md`; deploy remains disabled; no
Hyperdrive ids invented). Disposition stays **88 foundation / 0 pending /
16 removed**.

**Edge Hyperdrive (dual-path when `ENABLE_HYPERDRIVE_BOUNDARY=true`):**

| Module                | On Hyperdrive                                                                                                             | Still Express-proxied                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Messages              | channels/DMs/users/unread/read/typing/hide, list/send/delete, `attachmentIds` link + list enrichment                      | — (Socket.IO client fallback unchanged)                                            |
| Deals                 | list, create, pipeline, get, put                                                                                          | `DELETE /:id` (no soft-delete contract)                                            |
| Survey / survey-forms | list/detail/create/questions/publish/respond/my-response, schedule, close/reopen, archive, responses, analytics, settings | announce-on-publish / `POST /:id/announce`; survey-forms PUT/DELETE metadata       |
| Projects              | list, detail (kanban + tasks), task create                                                                                | dashboard, import/reorder, members, milestones, task update/delete, other CRM hubs |
| Expenses              | self CRUD + lines (+ receipts when trusted), `pendingForMe`, submit, approvals, FX                                        | raw items / meta / Express-only signing paths                                      |
| Leave                 | self list/create + approve/reject/cancel                                                                                  | balances, types catalog, richer team/HR filters                                    |
| Cash-advance          | self list/create/submit/update (+ receipts when trusted) + approve/reject/disburse/clear                                  | signed receipt GET, disbursement-proof GET                                         |

**Expo / app-core deepen (foundation disposition):** expenses + cash-advance
pending inboxes; survey detail manage (announce/schedule/analytics/archive);
survey-forms respond submit; deals pipeline kanban + stage moves + notes;
project board task create/reorder/edit/delete + members read (emails
stripped). Member write UI and pointer drag deferred.

### Parallel: p2-projection-strips

Client projection hardening (Hyperdrive serializers; deploy unchanged):

- **Visa self-list:** strips `documentUrl` / storage URLs; returns
  `hasDocument` + document name/category only; strips employee `email`
  (HR company-wide lists stay Express-proxied and may keep email).
  app-core `visaEmployeeSchema.email` is optional; list exposes
  `hasDocument` / `documentCount`.
- **Expense line POST/PUT:** responses return `hasReceipt` only (no
  echoed `receiptUrl`). Input may still send `receiptUrl`.
- **Payroll:** existing `hasDocument` / no-`documentUrl` locks retained.
- **Leave:** self-list keeps `reason` (owner-only Hyperdrive path; Expo
  leave list needs it). Team/HR widened queries remain proxied.

### Parallel: cicd-cloudflare-workers

GitHub Actions Workers + Assets CI/CD (staging first; production gated):

- Enabled `.github/workflows/deploy-staging.yml` (push `main`/`staging` +
  `workflow_dispatch`) and `deploy.yml` (`workflow_dispatch` + Environment
  `production`). Removed `.disabled` stubs.
- Fail closed without `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` and
  required Expo public Environment vars. No Hyperdrive ids or fake
  `DATABASE_URL` in CI. `hyperdrive: []` unchanged in wrangler.
- Docs: `docs/CICD_CLOUDFLARE.md`; updated `PRODUCTION_DEPLOY.md`, checklist,
  AGENTS/CLAUDE/README. **Ops: disable Cloudflare Pages auto-deploy.**
- Does not authorize DNS / `manut.xyz` cutover. Green deploy needs ops to
  fill GitHub Environments + provision R2/Queues/Worker secrets.

### Reconcile: workers-build-token-recovery (2026-07-18)

This current deployment contract supersedes the historical parallel notes
above where they conflict:

- Cloudflare Workers Builds is the sole production deploy owner for `main`;
  GitHub Actions owns preview and staging only. Native non-production Workers
  Builds must be disabled after the token-recovery preview validation.
- The build command is `pnpm run build:cloudflare`. Production deploy is
  `cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env production && npx wrangler deploy --env production`.
  Token-recovery preview validation is
  `cd apps/edge && node scripts/ensure-cloudflare-resources.mjs --env preview && npx wrangler deploy --env preview`
  to the isolated Worker `manut-preview`.
- If the selected build token was deleted or rolled, use **Create new token**
  in the Builds selector, name it `Manut Workers Builds - YYYY-MM-DD`, and
  narrow the generated token via **Edit** (never **Roll**) to the standard
  Workers Builds permissions plus Queues Edit, account GoGoCash, and zone
  `manut.xyz`. Retry preview before production and never copy its value into
  GitHub or the repository. Durable Object migrations
  require the full isolated `manut-preview` deploy documented in
  `docs/CICD_CLOUDFLARE.md`; preview must never target production `manut`.
- GitHub deploy-token setup covers `preview` and `staging` only. Production
  runtime Worker secrets remain separately managed in Cloudflare.
- Cloudflare Pages auto-deploy stays off. Token recovery or a green deploy
  does not authorize DNS/custom-domain mutation or claim traffic cutover.

Live recovery evidence from 2026-07-18:

- Worker `manut` selects active Builds-managed token
  `Manut Workers Builds - 2026-07-18`, narrowed in place to the eight documented
  permissions, account GoGoCash, and zone `manut.xyz`. An abandoned token was
  revoked immediately and the unused custom duplicate was deleted.
- Native non-production Workers Builds is disabled; production branch remains
  `main`, and no production build retry, deployment, or DNS change was made.
- Preview build `aee01346-8404-4e4c-935c-54f7d7e5b6f6` proved replacement-token
  authentication plus Queue/R2 access, then failed with Cloudflare `10211`
  because the old version-upload command could not apply the Durable Object
  migration. The isolated full-deploy validation reached `manut-preview` and
  failed closed only on missing `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- GitHub Environment `preview` now uses
  `EXPO_PUBLIC_API_URL=https://manut-preview.bettergogocash.workers.dev`, but
  still lacks the separate deploy token and R2 S3 pair. A new preview-only
  `EDGE_SIGNING_KEY` was generated directly into the Environment without
  printing or retaining it. The workflow accepts these names through an
  ephemeral `--secrets-file`; do not copy the Workers Builds token into GitHub.

### Parallel: phase1-leftovers

Phase 1 leftovers close-out (2026-07-18):

- **Already on main (verified):** leave month calendar + team/HR approve/reject,
  `/leave/policies` read-only catalog, `/settings` admin system settings
  (`admin:manage`, secret-like keys stripped), dashboard KPIs with wall/compose
  remaining stripped.
- **This slice:** Playwright `employee`/`leave` cutover to Expo `:8081` (auth
  setup + Expo selectors + leave dialog `role=dialog` a11y); API credentialed
  CORS for allowlisted origins so Expo cookie sessions can reach `:3001`.
  CORS hardening: normalize trailing slashes, reject `*`, exact-origin allow
  checks, disallowed Origin uses `cb(null, false)` (no 500 / no Origin echo).
- **Deferred / blocked:** policy CRUD/import; wall/compose productization;
  hosted authenticated E2E until the five `E2E_*` secrets + dedicated project
  exist (gate stays fail-closed — no soft-skip).

### Parallel: ops-ci-osv-overrides

- **Eng slice (2026-07-18):** Cleared patchable Dependabot/OSV hits via
  `pnpm-workspace.yaml` overrides (`@xmldom/xmldom`, `@hono/node-server`,
  `minimatch@5`) and `eas-cli` `21.0.2`. Residual low: `quill@2.0.3` (no
  upstream patch; temporary `apps/web` rich-text only).
- **Ops evidence re-checked:** `e2e` env secrets `total_count: 0`; org plan
  `free`; CodeQL `Analyze (ruby)` still fails on `main` (run `29646398325`).
  Phase E / E2E secrets / GitHub Pro / CodeQL Ruby remain ops-owned.

### Parallel: p0-e4-api-origin-guard

- **Eng slice (2026-07-19):** Worker↔Express topology safety (P0-E4-T3 +
  fail-closed config). `apps/edge/src/api-proxy.ts` rejects self-proxy
  `API_ORIGIN` (`API_ORIGIN_SELF_PROXY`) and repeated `x-manut-proxy-hop`
  (`API_PROXY_HOP_LOOP`) before `fetch`; tests in
  `apps/edge/tests/api-proxy-topology.test.ts`. Preview/production wrangler
  `API_ORIGIN` cleared to `""` (no Worker self-host). Draft ADRs:
  `docs/ADR-002-worker-express-api-boundary.md`,
  `docs/ADR-003-auth-trust-model.md`.
- **Ops still owns:** distinct Express `API_ORIGIN` host per env; app-session
  JWKS values; pause/fail-close production Workers Builds (P0-E4-T7) — not
  flipped from git; DNS cutover for `app.manut.xyz` remains unauthorized.
- **Suggested next P0 slice after merge:** P0-E4-T4 hosted `/api` base-path
  contract + docs alignment, or P0-E4-T7 ops pause evidence; T5 Worker→Express
  hermetic integration when a local Express origin exists.

### Parallel: p0-ops-topology-checklists

- **Docs-only (2026-07-19):** Ops pack
  `docs/ops/p0-topology-checklists.md` — distinct `API_ORIGIN` per env,
  application-session `AUTH_JWKS_*`, isolate `manut-preview` from production
  `manut`, first-admin bootstrap prerequisites (clean seed has roles, no
  users). ADR-002/003 marked **Accepted**; CICD / PRODUCTION_DEPLOY /
  `.env.example` no longer imply Access JWKS for Worker `AUTH_*`.
- **Live probes (status codes only):** `manut` workers.dev `/health` **200**,
  `/api/health` **401**; `manut-preview` workers.dev `/health` **404**;
  `preview.manut.xyz/health` **200** (isolation defect until preview Worker
  serves and custom domain is not on prod); `app.manut.xyz` DNS fail.
- **Not claimed:** Express origin provisioning, JWKS values, preview redeploy,
  DNS cutover, or first-admin identity creation.

### Parallel: p0-quill-osv-disposition

- **Docs-only (2026-07-19):** Formal disposition for residual Dependabot/OSV
  after #217. Verified `quill` npm latest is still `2.0.3` with no
  `first_patched_version` (Dependabot alert #149 / GHSA-v3m3-f69x-jf25 /
  CVE-2025-15056). Accepted residual + fail-closed OSV rationale in
  `docs/CREDENTIAL_BOUNDARY.md`; `react-quill-new` noted in
  `docs/DEPENDENCY_UPGRADE_SCOPE.md`. No `osv-scanner` ignore / soft-skip.
- **Not claimed:** upstream Quill patch, Dependabot alert dismissal as a CI
  green path, or retirement of `apps/web` rich-text.

### Parallel: p0-e4-t7-builds-pause

- **Docs-only (2026-07-19):** Read-only Cloudflare Builds verification for
  Worker `manut` (account `187ab61ed9dbc6e616cb23e6b95aa8f1`, script
  `4d091451cca54519bfeb5c2eb4ccd7e1`). Production trigger **enabled**
  (`Deploy default branch`, `branch_includes: main`); non-production
  `previews_enabled: false`. Documented exact pause / re-enable steps in
  `docs/CICD_CLOUDFLARE.md` + verdict row in `docs/PRODUCTION_DEPLOY.md`.
  Fail-closed marker:
  `docs/ops/markers/p0-e4-t7-workers-builds-pause.md`
  (`status: required_not_paused`, `approval: not_granted`).
- **Not claimed:** dashboard Disconnect, trigger delete, deploy-command
  change, or token roll — no production Builds mutation from this worktree.

### Parallel: p0-e3-ci-protection-truth

- **Docs-only (2026-07-19):** Recorded live `gh` evidence for CI/protection
  truth — public repo, Free org, no `main` protection/rulesets, CodeQL
  `Analyze (ruby)` failing with “not any written in Ruby”, and red merges
  (PRs #217–#219 merged with failed `Validate`). Checklist: drop Ruby from
  code scanning; enable branch protection / rulesets (public Free now, or
  Pro then private). See `docs/ops/CI_PROTECTION_TRUTH.md`.
- **Not claimed:** org plan upgrade, visibility change, CodeQL language
  edit, or branch-protection enablement — none flipped from this worktree.

### Parallel: p1-ledger-freeze-prep

- **Eng slice (2026-07-19):** P1 prep only. ESOP bookmark shim:
  `resolveCompatibilityRedirect` + Expo `/hrms/esop/[employeeId]` →
  `/hrms/grants/[employeeId]` (tests green). `/expenses-v1` left as
  **pending-product-approval** in `PENDING_COMPATIBILITY_REDIRECTS` /
  JSON `pendingRegistryDecisions` (no auto-redirect). Sixteen
  `remove-as-provenance` notes marked PENDING P1-E2-T1 (status still
  `removed`). Draft `docs/ADR-009-ingest-telemetry-proxy.md` for `/ingest/*`
  retain-vs-remove (no Worker proxy shipped).
- **Owner still owns:** expenses-v1 redirect-or-remove sign-off; removal
  `removed-approved` evidence; ADR-009 accept A/B.

### Parallel: p4-parity-wave1-deepen

- **Eng slice (2026-07-19):** One vertical deepen on `/cash-advance` finance
  path (approve inbox was already present). app-core `disburseCashAdvance` +
  `clearCashAdvance` (Zod proof URL; response strips `disbursementProofUrl`)
  and Expo `CashAdvanceFinanceInbox` gated by `cash-advance:approve`.
  Disposition stays `foundation` until Expo E2E. Deferred: native R2 picker,
  signed proof GET.
- **Not broadened:** expense receipts, leave, CRM hubs, or Hyperdrive ops.

### Parallel: p0-e4-t4-api-base-path

- **Eng slice (2026-07-19):** Hosted `/api` base-path contract (P0-E4-T4).
  `normalizeApiBaseUrl` in `@manut/app-core` + Expo `getApiBaseUrl` via
  `Platform.OS`: web defaults to same-origin `/api`; absolute Worker origins
  append `/api` when omitted; native requires HTTPS (http loopback allowed).
  App-core endpoint paths remain relative beneath that base. Docs/bootstrap
  `.env.example` / CICD / PRODUCTION now document `…/api` values.
- **Tests:** `packages/app-core/tests/api-base-url.test.ts`,
  `apps/app/__tests__/api-config.test.ts`, cloudflare-builds bootstrap assert.
- **Not done:** ops GitHub Environment var rewrite (host-only still works via
  runtime normalize); DNS; hermetic Worker→Express (P0-E4-T5).

### Parallel: master-p0-plan-authority

- **Docs-only (2026-07-19):** Phase 0.1 plan authority. Copied
  `docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` (v1.4) as sole forward roadmap.
  Accepted `docs/ADR-010-postgres-strangler-vs-d1-target.md` (Postgres/Prisma/
  Hyperdrive strangler SoR until Phase 8+ D1-per-tenant gates; D1 not
  transactional SoR yet). Temporary `docs/DEPENDENCY_FREEZE.md`. Dual-track
  updates in `CLAUDE.md` / `AGENTS.md` / `CONTEXT.md` / README; historical
  banners on migration/ops docs pointing at the master plan.
- **Not claimed:** secrets, DNS, Cloudflare prod mutations, SoR flip, or
  lifting the dependency freeze.
