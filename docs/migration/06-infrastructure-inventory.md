# Infrastructure inventory — what is running on GCP today

Everything below is read out of the repository at commit `0479db8d`. Items marked
**[confirm live]** exist outside the repo (created by hand in a console) and must
be enumerated against the live projects before cutover — the repo cannot tell you
their current state.

---

## 1. Google Cloud

| | |
|---|---|
| Project (prod + staging share it) | `tbh-nexora` |
| Region | `asia-southeast1` (Singapore) |
| Artifact Registry repository | `nexora` in `asia-southeast1-docker.pkg.dev/tbh-nexora/nexora` |
| Images | `api`, `web`, `api-staging`, `web-staging` — each tagged `:<git-sha>` and `:latest` |
| CI → GCP auth | **Workload Identity Federation**, no service-account JSON key. `secrets.WIF_PROVIDER` + `secrets.GCP_SERVICE_ACCOUNT` |
| Deploy SA roles required | `roles/run.admin`, `roles/cloudscheduler.admin`, plus Artifact Registry write |

### Cloud Run services

| Service | Port | Memory | CPU | Instances | Ingress |
|---|---|---|---|---|---|
| `nexora-api` | 3001 | 512Mi | 1 | 0 → 10 | `--allow-unauthenticated`, CPU boost |
| `nexora-web` | 3000 | 512Mi | 1 | 0 → 10 | `--allow-unauthenticated`, CPU boost |
| `nexora-api-staging` | 3001 | — | — | — | same pattern |
| `nexora-web-staging` | 3000 | — | — | — | same pattern |

- `min-instances=0` — both services scale to zero. Cold starts are accepted
  today. The API image runs TypeScript through `tsx`, so its cold start is
  noticeably worse than a compiled server's.
- No VPC connector, no Cloud SQL, no Memorystore, no Pub/Sub, no GCS bucket in
  use. `GCS_BUCKET` / `GCP_PROJECT_ID` appear in `.env.example` but **no code
  imports `@google-cloud/*` or references `storage.googleapis.com`** — they are
  vestigial.

### Custom domains **[confirm live]**

`PORTAL_URL` is hardcoded to `https://manut.xyz` in
`deploy.yml`, and staging's CORS allowlist names
`https://staging.manut.xyz`, so both are live Cloud Run
domain mappings. `docs/GCP_DEPLOYMENT.md` documents the mapping procedure with
placeholder domains only — the actual mapping records are not in the repo.

`CLAUDE.md` also refers to a live design system at `manut.xyz`, which
is a **Firebase Hosting** domain. Confirm whether that site is still served and
whether it is in scope.

### Cloud Scheduler

The API exposes **20 distinct cron endpoints** (21 route registrations — one is a
legacy alias). All are `POST /api/cron/*`, authenticated by the header
`X-Cron-Secret: ${CRON_SECRET}` (`verifyCronSecret` in
`apps/api/src/modules/cron/cron.controller.ts`), all idempotent, all take an
empty `{}` body.

**Only 4 jobs are provisioned by CI.** `deploy.yml` runs one idempotent
describe-then-create-or-update step per job after each successful API deploy,
gated on `vars.SKIP_SCHEDULER_PROVISION != 'true'`:

| Job name | Endpoint | Schedule (Asia/Bangkok) |
|---|---|---|
| `aria-purge-pii-daily` | `/aria-purge-pii` | `30 2 * * *` |
| `aria-knowledge-sync-daily` | `/aria-knowledge-sync` | `0 3 * * *` |
| `storage-snapshot-daily` | `/sync-storage-snapshot` | `30 4 * * *` |
| `expense-monthly-reminders` | `/expense-monthly-reminders` | `0 9 22 * *` |

The remaining **16 endpoints were scheduled by hand, or not at all** **[confirm
live]**. `docs/ops/cloud-scheduler-cron-jobs.md` is the closest thing to an
inventory and lists recommended cadences for 13 of them; three more
(`/accounting-status`, `/it-billing-reminders`, `/marketing-drift-check`) are
documented only in `CLAUDE.md` and are missing from that table — so the ops doc
itself has drifted.

| Endpoint | Recommended cadence | Owner | Provisioned |
|---|---|---|---|
| `/sync-storage-snapshot` | 04:30 daily | Workspace Usage | **auto** |
| `/aria-knowledge-sync` | 03:00 daily | ARIA | **auto** |
| `/aria-purge-pii` | 02:30 daily | ARIA | **auto** |
| `/expense-monthly-reminders` | 09:00 on the 22nd | Expenses / HR | **auto** |
| `/leave-escalation` | daily | Leave / HR | manual |
| `/stale-leads-digest` | daily | Sales CRM | manual |
| `/legal-expiry-digest` | daily | Legal | manual |
| `/sync-telemetry` | ~04:00 | Telemetry / PostHog | manual |
| `/crm-email-sync` | every 10 min | Sales CRM | manual |
| `/visa-expiry-reminders` | ~08:00 | Visa / HR | manual |
| `/ninety-day-reminders` | ~08:00 | Immigration (TM.47) | manual |
| `/attendance-missed-checks` | hourly | Attendance / HR | manual |
| `/attendance-manager-alerts` | ~10:00 daily | Attendance / HR | manual |
| `/aria-daily-brief` | hourly (filters subscribers by local hour) | ARIA | manual |
| `/ow-snapshot-refresh` | a few times/day, TBC | Marketing / OneWave | manual |
| `/fx-sync` | ~07:00 — no-op until `BOT_API_CLIENT_ID` is set | Expenses / FX | manual |
| `/crm-deadline-reminders` (alias `/it-crm-deadline-reminders`) | 08:00 daily — schedule exactly ONE of the two | All CRMs | manual |
| `/accounting-status` | 08:00 daily | Accounting | manual |
| `/it-billing-reminders` | 08:00 daily | IT Operations | manual |
| `/marketing-drift-check` | 09:00 daily | Marketing analytics | manual — **exists and is PAUSED** in `tbh-nexora`/`asia-southeast1`; it was created before the endpoint reached `main` |

Before cutover, run and archive:

```bash
gcloud scheduler jobs list --project=tbh-nexora --location=asia-southeast1 \
  --format="table(name,schedule,timeZone,state,httpTarget.uri)"
```

That list, not this table, is the migration source of truth.

---

## 2. Supabase — three products behind one vendor

This is the single biggest decision in the migration, because "Supabase" is doing
three unrelated jobs and each has a different exit cost. Note that Supabase runs
on AWS already: the connection strings are `*.pooler.supabase.com` in an
`aws-*-ap-southeast-*` region, so **the database is not currently on GCP at all.**

### 2a. PostgreSQL — the primary datastore

- Prisma connects through two URLs: `DATABASE_URL` (shared pooler, port **6543**,
  `?pgbouncer=true` — transaction mode) and `DIRECT_URL` (port **5432**, session
  mode). Migrations run against `DIRECT_URL`; the app runs against
  `DATABASE_URL`. Any replacement must preserve that split — PgBouncer
  transaction mode cannot run DDL or prepared statements.
- Region: `.env.example` (a dev project) shows `aws-1-ap-southeast-2`;
  `CLAUDE.md` states `aws-1-ap-southeast-1` for prod. **[confirm live]** — read
  the actual prod `DATABASE_URL` secret.
- Extension required: **`vector`** (pgvector).
- Known operational note: GitHub Actions runners are usually in the US, and
  transient `P1001` failures during pooler restarts are expected on the
  migration step.

### 2b. Supabase Auth — identity

The dependency surface is **small and entirely server-side** — 9 call sites in
`apps/api`, zero in `apps/web`:

| Call | Used for |
|---|---|
| `auth.signInWithPassword` | password login |
| `auth.signInWithOtp` | magic-link login |
| `auth.resetPasswordForEmail` | password reset |
| `auth.refreshSession` | refresh-token rotation |
| `auth.getUser` | JWT → user resolution |
| `auth.admin.createUser` | user provisioning |
| `auth.admin.updateUserById` | password / email / metadata changes |
| `auth.admin.deleteUser` | deprovisioning |
| `auth.admin.listUsers` | admin reconciliation |

`users.id` in the application database is the **same UUID** as the Supabase
`auth.users.id`, but there is no foreign key between them — the link is
convention. `public.users` also holds its own `sessions` table with hashed
tokens. Because the browser only ever sees the API's own httpOnly cookies, the
identity provider is swappable without touching a single line of frontend code.

### 2c. Supabase Storage — file storage

Six buckets, created at API boot by `ensureStorageBuckets()`
(`apps/api/src/infrastructure/storage/supabase-storage.ts`):

| Bucket | Visibility | Max file | Allowed types |
|---|---|---|---|
| `article` | public | 10 MB | jpeg, png, webp |
| `avatars` | public | 2 MB | jpeg, png, webp |
| `blog` | public | 10 MB | jpeg, png, webp |
| `uploads` | public | 50 MB | images + short video clips; SVG and HTML deliberately excluded (stored-XSS vector on a public CDN path) |
| `receipts` | private | 10 MB | images + pdf |
| `documents` | private | 50 MB | pdf, office, csv, text, **html + zip** (allowed only here, because downloads are served from short-lived signed URLs on the storage origin, not the app origin) |

Downloads from private buckets go through a per-resource
`GET /<resource>/:id/download` route that re-checks ownership and mints a
**5-minute signed URL**. Raw `fileUrl` values are never linked from the client.
`next.config.ts` allows `**.supabase.co` as a remote image host — that pattern
has to change with the storage host.

A daily cron (`/sync-storage-snapshot`) records per-bucket byte counts into
`storage_snapshots` for the admin Workspace Usage tab.

---

## 3. Secrets and configuration

Configuration reaches Cloud Run entirely through `--set-env-vars` from GitHub
Actions secrets. **There is no secret manager in the loop** — no Secret Manager,
no runtime secret fetch, no rotation automation. Secrets are visible in the
Cloud Run service revision.

### GitHub Actions secrets consumed by `deploy.yml` (38)

Infrastructure: `WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`.

Database: `DATABASE_URL`, `DIRECT_URL`.

Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

AI: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (declared but the current ARIA
implementation does not use it).

Email: `EMAIL_SERVICE_URL`, `EMAIL_SERVICE_API_KEY`.

App: `CRON_SECRET`, `WORKFLOW_EMAIL_TOKEN_SECRET`, `NEXT_PUBLIC_APP_URL`,
`LEAVE_NOTIFICATION_EXCLUDE`, `INTEGRATIONS_TOKEN_KEY` (32-byte hex; encrypts
stored Google OAuth tokens at rest in the DB).

Google Workspace: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_SHEETS_SA_KEY`, `OW_TRACTION_SHEET_ID`,
`OW_TRACTION_SHEET_RANGE`.

Analytics: `POSTHOG_API_KEY`, `POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY`,
`POSTHOG_PROJECT_ID`, `NEXT_PUBLIC_POSTHOG_KEY`.

Marketing analytics upstream: `MARKETING_ANALYTICS_API_URL`,
`MARKETING_ANALYTICS_PARTNER_IDS`, `MARKETING_ANALYTICS_BACKFILL_FROM`.

FX: `BOT_API_CLIENT_ID`, `BOT_API_BASE_URL`, `BOT_FX_CURRENCIES`,
`BOT_FX_UNITS`, `FX_FALLBACK_ENABLED`, `FX_FALLBACK_BASE_URL`,
`FX_FALLBACK_API_KEY`.

Ops: `VALIDATOR_MONITOR_GITHUB_TOKEN` (fine-grained PAT, Contents:Read on
`kunanon-ui/bnry-validator-monitor`).

### GitHub Actions **variables** (3) — feature gates, not secrets

| Variable | Effect |
|---|---|
| `ACCOUNTING_FIXED_ASSETS` | fail-closed gate on the Fixed Asset Register. Unset ⇒ empty ⇒ module hidden. Travels as a runtime env var for the API **and** a `--build-arg` for the web image |
| `MARKETING_ANALYTICS_ENABLED` | same pattern for the marketing-analytics module |
| `SKIP_SCHEDULER_PROVISION` | set to `true` to short-circuit Cloud Scheduler provisioning |

The ship-dark flag pattern needs **three** edits to work, and Docker silently
drops a `--build-arg` with no matching `ARG`: (1) `docker/Dockerfile.web` `ARG` +
`ENV`, (2) the web build step's `--build-arg`, (3) the API deploy step's
`--set-env-vars`. Migration scripts that regenerate the pipeline must carry all
three.

### Staging-only secrets (7)

`STAGING_DATABASE_URL`, `STAGING_DIRECT_URL`,
`STAGING_NEXT_PUBLIC_SUPABASE_URL`, `STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_NEXT_PUBLIC_APP_URL`,
`STAGING_WORKFLOW_EMAIL_TOKEN_SECRET`. Staging hardcodes both feature gates to
`true`.

### Referenced in code but NOT set by the prod deploy (30)

These fall back to code defaults in production. Worth reviewing during the
migration rather than blindly re-creating:

- **DocuSign — entirely unwired in prod.** All nine `DOCUSIGN_*` vars are
  declared in `turbo.json` `globalEnv` and read by code, but none is set by
  `deploy.yml`. The integration is dormant.
- `CORS_ALLOWED_ORIGINS` and `ALLOWED_ORIGINS` are unset, so the API's CORS
  allowlist resolves from `PORTAL_URL`
  (`https://manut.xyz`). Socket.IO reads the same chain.
- `NEXT_PUBLIC_SOCKET_URL` is unset, so the web build falls back to the
  `API_URL` build arg — the browser opens the WebSocket straight at the Cloud
  Run API hostname.
- `TELEMETRY_ENABLED` / `NEXT_PUBLIC_TELEMETRY_ENABLED` are unset, but both
  trackers also enable on `NODE_ENV === "production"`, so **PostHog is live in
  prod**; the flags exist only to opt non-prod environments in.
- Also unset: `ACCOUNTING_GL_POSTING`, `ACCOUNTING_SETTLEMENT_V2`,
  `ARIA_PII_RETENTION_DAYS` (defaults to 30 days), `LOG_LEVEL`,
  `MAGIC_LINK_ALLOWED_ROLES`, `PUBLIC_API_URL`, `WEB_BASE_URL`, `SUPABASE_URL`
  (the `NEXT_PUBLIC_` variant is the one that is set), `TRAVEL_APPROVED_CC`,
  `VISA_REMINDER_CC`, `VISA_90DAY_REMINDER_CC`, `VALIDATOR_MONITOR_REPO`,
  `VALIDATOR_MONITOR_BRANCH`, `VALIDATOR_MONITOR_FILE`, `DOTENV_PATH`,
  `SEED_EMPLOYEE_PASSWORD`.

---

## 4. Third-party dependencies that outlive the cloud move

None of these are GCP resources, but every one is a hostname or credential that
has to keep working from the new network, and several will need allowlist or
redirect-URI changes.

| Dependency | What it does | Migration impact |
|---|---|---|
| **Supabase** | Postgres + Auth + Storage | see §2 — the main decision |
| **Google Gemini** (`@google/genai`) | ARIA chat, embeddings (`text-embedding-004`), receipt/invoice parsing, task generation, document extraction | API-key only; no GCP project coupling. Keeps working from AWS unchanged |
| **OneWave email service** (`EMAIL_SERVICE_URL`, default `https://dev.send.onewave.live`) | all transactional email, via **template IDs** | A missing template silently returns `TEMPLATE_NOT_FOUND` and the email never arrives. Templates are registered out-of-band on the email service, not in this repo |
| **PostHog US Cloud** | product analytics; proxied same-origin via `/ingest/*` rewrites | The rewrite lives in `next.config.ts` and moves with the app |
| **Google Workspace OAuth** | Gmail + Drive + Calendar integrations, per-user tokens encrypted with `INTEGRATIONS_TOKEN_KEY` | `GOOGLE_OAUTH_REDIRECT_URI` must be re-registered for the new API hostname, or every user's connect flow breaks |
| **Google Sheets** (service account) | OneWave traction sheet sync | SA key stays valid; nothing region-bound |
| **Bank of Thailand API** (`gateway.api.bot.or.th`) | FX rates for expenses; `open.er-api.com` / `v6.exchangerate-api.com` as fallback | `BOT_API_CLIENT_ID` may be IP-allowlisted **[confirm]** — a new egress IP would break `/fx-sync` |
| **`bnii-analytics-api`** ("the Rahul API") | upstream for marketing DAU/MAU + OneWave partner metrics | **This is itself a Cloud Run service** at `bnii-analytics-api-epgxydm2fa-as.a.run.app`, hardcoded as the default in two files. Separate repo, separate migration decision |
| **GitHub API** | Validator Monitor proxies `report.json` from a private repo | PAT only |
| **DocuSign** | e-signature | dormant in prod (§3) |
| **Anthropic API** | declared, unused by current ARIA | — |

---

## 5. Data-protection facts the migration has to answer for

The database holds employee PII and payroll data across four jurisdictions
(Thailand, India, Vietnam, Indonesia — the `entities` dimension). In `users`
alone: `date_of_birth`, `passport_number`, `nationality`, `thai_id`, `tax_id`,
`aadhaar_number`, `pan_card_number`, `salary`, `permit_number`, plus HR tables
for payslips, ESOP grants, visa records, benefits and appraisals.

Consequences for the target design:

- **Data residency.** The database is currently in an AWS Singapore region via
  Supabase. Indian Aadhaar/PAN data in particular has handling expectations that
  should be checked against wherever the new instance lands.
- **Storage privacy model.** `documents` and `receipts` are private buckets
  reached only through short-lived signed URLs. Whatever replaces Supabase
  Storage must reproduce that, not just "make the bucket private".
- **`aria_query_logs.user_message` is redacted on a schedule** by
  `/aria-purge-pii` (retention `ARIA_PII_RETENTION_DAYS`, default 30, replaced
  with a sentinel string). If that job is not re-created on the new scheduler,
  raw user prompts accumulate indefinitely.
- **Payslip PDFs are password-protected via the `qpdf` binary.** The runtime
  image must keep it.
