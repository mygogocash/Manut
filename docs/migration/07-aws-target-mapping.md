# GCP → AWS mapping, decisions and risks

This is an assessment, not a decision record. It states what each GCP dependency
maps to, which choices are genuinely open, and what will break quietly if it is
missed. Nothing here has been agreed.

---

## 0. The one framing fact

**The database is already on AWS.** Supabase runs on AWS, and the connection
strings are `*.pooler.supabase.com` in an `aws-*-ap-southeast-*` region. So the
production data plane is not moving clouds at all — it is only moving *vendor*,
and only if you decide it should.

What is actually on GCP: two Cloud Run services, one Artifact Registry
repository, Cloud Scheduler jobs, Workload Identity Federation for CI, and the
custom domain mappings. That is a compact surface. The large, risky parts of this
migration are the Supabase questions in §3 and the Socket.IO question in §5 —
not the containers.

---

## 1. Direct service mapping

| Today (GCP) | AWS equivalent | Notes |
|---|---|---|
| Cloud Run `nexora-api` | **ECS Fargate service** behind an **ALB** | needs WebSocket support; see §5 |
| Cloud Run `nexora-web` | **ECS Fargate service** behind the same ALB, or **CloudFront + Fargate origin** | Next.js `output: standalone`, `node server.js`; stateless |
| Artifact Registry `nexora` | **ECR** repository per image | same `:<sha>` + `:latest` tagging; add a lifecycle policy, which GCP does not have today |
| Cloud Scheduler (20 endpoints) | **EventBridge Scheduler** | cron + timezone + HTTP target with a custom header. Keeps the `X-Cron-Secret` protocol unchanged |
| Workload Identity Federation | **IAM role + GitHub OIDC provider** | same keyless model; `aws-actions/configure-aws-credentials` replaces `google-github-actions/auth` |
| `--set-env-vars` on the service | **Secrets Manager or SSM Parameter Store**, injected as ECS task-definition `secrets` | strictly better than today: values stop being visible in the service revision |
| Cloud Run domain mapping | **Route 53 + ACM certificate + ALB listener** | ACM cert must be in the ALB's region; a CloudFront distribution needs one in `us-east-1` |
| Cloud Run built-in HTTPS + autoscaling | ALB + ECS service autoscaling target-tracking | `min-instances=0` has no clean Fargate equivalent — see §4 |
| Cloud Logging (stdout capture) | **CloudWatch Logs** via the `awslogs` log driver | winston already writes JSON to stdout; no code change |
| `gcloud run deploy` retry loop for Artifact Registry propagation | not needed | the retry exists because Cloud Run's image lookup lags `docker push`; ECS does not have that race |

Nothing in the application code is GCP-coupled. There are **no** `@google-cloud/*`
imports and no metadata-server calls. The Google dependencies that remain
(Gemini, Workspace OAuth, Sheets) are public APIs authenticated by key or OAuth
client and work identically from AWS.

---

## 2. What has to change in the repository

Small, and confined to the pipeline:

1. `.github/workflows/deploy.yml` + `deploy-staging.yml` — swap the auth action,
   `docker push` target, deploy command, and the four scheduler-provisioning
   steps.
2. `docker/Dockerfile.api` / `Dockerfile.web` — unchanged in substance. Keep
   `qpdf` and `openssl` in both stages of the API image; keep the `@swc/helpers`
   workaround in the web image (Next 16 traces only the CJS build and the
   container dies at boot without it).
3. `apps/api/src/app.ts` — `app.set("trust proxy", 1)` assumes exactly one proxy
   hop. **ALB alone is still one hop, so `1` remains correct. ALB behind
   CloudFront is two**, and leaving it at `1` makes `req.ip` resolve to the
   CloudFront edge rather than the client, which silently mis-buckets both
   rate limiters (login is `max: 30 / 15 min`, everything else `max: 2000 / 15
   min`) and pollutes `sessions.ip_address`.
4. `next.config.ts` — the `**.supabase.co` `images.remotePatterns` entry only
   needs changing if storage moves.
5. `.env.example` — drop the vestigial `GCS_BUCKET` / `GCP_PROJECT_ID`.

Application code changes: **none required** for the compute move.

---

## 3. Decision 1 — how far to unbundle Supabase

Three independent products, three separate calls. They can be decided
separately, and staged.

### Option A — keep Supabase entirely

Zero data migration, zero auth migration, zero storage migration. The whole
project reduces to moving two containers and a scheduler. Lowest risk by a wide
margin.

Cost: a non-AWS vendor stays in the critical path, and the pooler/session-mode
URL split stays as-is.

### Option B — move Postgres to RDS/Aurora, keep Auth and Storage

Middle path, and the one that carries the most hidden work:

- **pgvector must exist on the target.** RDS and Aurora PostgreSQL offer the
  `vector` extension, but confirm the chosen engine version supports the
  `ivfflat` opclass used by
  `aria_knowledge_articles_embedding_idx`. If it does not, ARIA retrieval
  degrades to keyword overlap without erroring.
- **The pooler split has to be reproduced.** Prisma expects a transaction-mode
  pooled URL (`DATABASE_URL`, `?pgbouncer=true`) and a session-mode direct URL
  (`DIRECT_URL`) for migrations. On RDS that means **RDS Proxy** (or self-hosted
  PgBouncer) for the former and the instance endpoint for the latter. Pointing
  both at the same pooled endpoint will make `prisma migrate deploy` fail on DDL.
- **The RLS layer becomes inert, and that is fine — but say so explicitly.**
  `public.is_service_role()` tests `current_setting('role') IN ('service_role',
  'supabase_admin') OR current_user = 'postgres'`, and the revokes target the
  `anon` / `authenticated` roles. None of those roles exists on a plain RDS
  instance. Since the Express API is the only database client and authorises in
  application code, dropping the policies loses nothing operationally — but
  carrying them over unmodified creates a false sense that RLS is enforcing
  something. Decide deliberately; do not port by accident.
- The `storage.objects` policy in `0000_init` is Supabase-specific and already
  guards itself with an `information_schema` check, so it no-ops safely.
- Mechanics: `pg_dump --no-owner --no-acl` → restore, or AWS DMS for a
  low-downtime cut. 274 tables, 444 FKs — restore in `--section=pre-data`,
  `data`, `post-data` order so index and FK creation does not serialise against
  the load.

### Option C — full exit: RDS + Cognito + S3

Everything in Option B, plus:

- **Auth.** Only 9 call sites, all server-side, all in `apps/api` — see
  [06-infrastructure-inventory.md](06-infrastructure-inventory.md) §2b. The
  frontend has zero `@supabase/*` imports and rides the API's own httpOnly
  cookies, so a Cognito swap is invisible to `apps/web`. The real work is the
  **user migration**: `users.id` is the Supabase `auth.users.id` UUID, and 202
  tables reference `users`. Cognito will not accept an arbitrary `sub`, so
  either keep `public.users.id` as the canonical key and store the Cognito sub
  alongside it, or accept an ID remap across 202 foreign keys. **The first
  option is the only sane one.**
- Password hashes cannot be exported from Supabase Auth in a form Cognito
  accepts. A cutover therefore means either a forced reset for every user, or
  Cognito's migration Lambda trigger validating against Supabase on first login
  during a grace window.
- **Storage.** Six buckets → S3, with `documents` and `receipts` private and
  served by **presigned URLs** (the existing 5-minute signed-URL pattern maps
  one-to-one). `ensureStorageBuckets()` boot-time provisioning should become
  infrastructure-as-code rather than an application call. `parseStorageUrl` and
  every stored `fileUrl` need a rewrite pass — existing rows contain Supabase
  URLs.

**Recommended staging if Option C is the destination:** compute first (§1), then
storage, then Postgres, then Auth last. Each step is independently reversible;
Auth is the only one that touches every user.

---

## 4. Decision 2 — Fargate vs App Runner vs EKS

| | Fits because | Watch out for |
|---|---|---|
| **ECS Fargate + ALB** *(default recommendation)* | closest operational analogue to Cloud Run; full control over WebSockets, sticky sessions, health checks, autoscaling | no scale-to-zero; you pay for a warm task 24/7 |
| **App Runner** | closest *developer experience* to Cloud Run; managed HTTPS and autoscaling | **verify WebSocket support before choosing it** — the `/messages` Socket.IO namespace is a hard requirement, and this is the single question that can disqualify the option outright |
| **EKS** | if there is an existing cluster and platform team | large operational surface for two containers |

Notes that apply regardless:

- `/health` already exists (`app.get("/health")`) and is the natural ALB
  target-group health check for the API. The web service's `/` is a redirect —
  pick a concrete page or add a health route rather than health-checking a 3xx.
- **`min-instances=0` does not survive the move to Fargate.** Today both
  services scale to zero and accept cold starts; the API's cold start is
  materially worse than a compiled server's because it runs TypeScript through
  `tsx`. On Fargate you will run ≥1 task continuously, which *improves* latency
  and *raises* the floor on cost.
- Sizing today is 512Mi / 1 vCPU, max 10 instances. That is a reasonable
  starting task size, but note the API buffers uploads in memory (`multer`,
  up to 50 MB) and shells out to `qpdf`, so 512Mi is tight for concurrent
  payslip generation. Right-size from real CloudWatch/Cloud Monitoring data, not
  from the current flags.
- Ephemeral disk: `payslip-crypto.ts` writes to `os.tmpdir()`. Fargate's default
  ephemeral storage is ample; just do not assume the filesystem persists across
  tasks (nothing in the code does).

---

## 5. Decision 3 — Socket.IO fan-out (a real bug, currently masked)

`apps/api/src/modules/messages/messages.bus.ts` is an **in-process** emitter — a
`Map<channelId, Set<handler>>`. There is no Redis adapter, no shared pub/sub.
Cloud Run already runs up to 10 instances, so a message sent through instance A
is never delivered to a subscriber connected to instance B. **This is a
pre-existing defect, not one the migration introduces** — but the migration
forces a decision:

1. **Fix it properly** — add `@socket.io/redis-adapter` backed by
   **ElastiCache for Redis / Valkey**. Correct at any instance count. Adds a
   cache cluster to the footprint.
2. **Pin the API to one task** and accept that messaging does not scale
   horizontally. Cheapest, honest, and a documented ceiling.
3. **ALB sticky sessions only** — insufficient on its own. Stickiness keeps one
   *client* on one instance; it does nothing about two clients in the same
   channel landing on different instances.

Whichever is chosen, the ALB target group needs the idle timeout raised above
Socket.IO's ping interval, and the API must remain **publicly reachable over
HTTPS** because the browser opens the WebSocket directly at the API hostname —
`NEXT_PUBLIC_SOCKET_URL` is unset in prod, so the web build falls back to the
`API_URL` build arg. A private-only API breaks messaging even though every REST
call would still work through the Next.js rewrite.

---

## 6. Cutover checklist

Ordered, and each item exists because skipping it fails silently rather than
loudly.

**Before anything**

- [ ] `gcloud scheduler jobs list --project=tbh-nexora --location=asia-southeast1` — archive the real job list; the repo documents only 4 of 20 and `docs/ops/cloud-scheduler-cron-jobs.md` has drifted by three entries
- [ ] Read the prod `DATABASE_URL` secret and record the actual Supabase region (repo sources disagree: `ap-southeast-1` vs `ap-southeast-2`)
- [ ] Enumerate live Cloud Run domain mappings and any Firebase Hosting site (`tbh-intranet.web.app`)
- [ ] Confirm whether `BOT_API_CLIENT_ID` (Bank of Thailand FX) is IP-allowlisted — a new NAT egress IP would silently break `/fx-sync`
- [ ] Decide the fate of `bnii-analytics-api` (a separate Cloud Run service in its own repo, hardcoded as a default in two files)
- [ ] Capture 30 days of request-count / p95-latency / memory metrics from Cloud Monitoring, so Fargate sizing and cost are computed rather than guessed

**Schema**

- [ ] Apply `03-schema.sql`, then **`04-schema-addendum.sql`** — the addendum carries pgvector, the `embedding` column and its ivfflat index, two GIN indexes, and the RLS layer. A database built from the Prisma schema alone boots fine and quietly breaks ARIA retrieval
- [ ] Verify `SELECT extname FROM pg_extension` includes `vector`
- [ ] Verify `aria_knowledge_articles_embedding_idx` exists and is an ivfflat index
- [ ] Verify `projects_departments_idx` and `investors_tags_gin_idx` exist (both carry comments noting that `prisma db push` does not create them)
- [ ] Verify the RLS layer landed as expected: `SELECT count(*) FROM pg_policies WHERE schemaname='public'` should return **91**, and 91 tables should have `relrowsecurity` set. `0000_init` names 94, but `survey_definitions`, `survey_waves` and `upload_jobs` have since been dropped — the verbatim init block therefore *errors* against a current schema, which is why `04-schema-addendum.sql` skips absent tables rather than copying it
- [ ] Run `prisma migrate resolve --applied 0000_init` on a restored database so the migration history is not re-attempted

**Pipeline**

- [ ] GitHub OIDC → IAM role, replacing WIF
- [ ] All 38 prod secrets + 7 staging secrets re-homed, ideally into Secrets Manager rather than plain task env vars
- [ ] All 3 GitHub *variables* preserved, including the fail-closed feature gates — remember the flag needs Dockerfile `ARG`, `--build-arg`, **and** `--set-env-vars`, and Docker drops an unmatched `--build-arg` without erroring
- [ ] `GOOGLE_OAUTH_REDIRECT_URI` re-registered in the Google Cloud console for the new API hostname, or every user's Gmail/Drive connect flow breaks
- [ ] Re-create all 20 scheduler jobs, `X-Cron-Secret` header intact. Schedule exactly **one** of `/crm-deadline-reminders` and its legacy alias `/it-crm-deadline-reminders` — they hit the same handler
- [ ] `marketing-drift-check` is currently **paused** on GCP because the endpoint reached `main` after the job was created; decide whether it goes live on the new scheduler
- [ ] Keep `prisma migrate deploy` running against the **direct/session-mode** URL, before the image build, with the deploy aborting on failure — and keep the `migrate resolve --rolled-back … || true` step for the known-stuck migration names

**After**

- [ ] Confirm `POST /api/aria/chat` still streams — `compression` is explicitly bypassed for that route, and an ALB or CloudFront that buffers will undo it
- [ ] Confirm the Socket.IO handshake succeeds from the production web origin (its CORS list is a separate chain from the Express one, and has broken independently before)
- [ ] Confirm a private-bucket download still returns a short-lived signed/presigned URL and not a raw object URL
- [ ] Confirm a payslip PDF still generates — that path shells out to `qpdf`
- [ ] Confirm `/health` returns 200 through the ALB and that rate-limit buckets see real client IPs, not the proxy's

---

## 7. Open questions for Sanjeev

1. Is Supabase in scope, or is this a compute-only migration? Everything else
   follows from this.
2. If Postgres moves: RDS or Aurora, and which engine version — the answer has
   to satisfy pgvector with the ivfflat opclass.
3. Fargate, App Runner, or an existing EKS cluster? If App Runner, WebSocket
   support has to be confirmed first.
4. What is the acceptable downtime window for the database cut? That decides
   `pg_dump`/restore versus DMS.
5. Does messaging need to scale horizontally (ElastiCache + Redis adapter), or is
   a single API task an acceptable documented ceiling?
6. Which AWS region? The data is in AWS Singapore today and holds Thai, Indian,
   Vietnamese and Indonesian employee PII including Aadhaar and PAN numbers —
   moving region is a compliance question, not a latency one.
7. Is `bnii-analytics-api` migrating too, and by whom?
8. Should DocuSign be wired up during the move, or formally retired? Nine env
   vars and a code path exist for an integration that prod never configured.
