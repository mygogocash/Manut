# GCP → Railway Migration — Staged Plan

**Status:** Decision document. No code yet. Each phase requires sign-off.

**Author of this doc:** session 2026-05-16, after user identified Railway as
the eventual replacement for GCP and requested a migration plan rather than
ad-hoc moves.

**Bottom line up front:** This migration is **doable but multi-week**, with
**one hard dependency that has no good solution** (Vertex AI). Read §1
before reading anything else — it determines whether the migration even
makes sense.

---

## §1 — The Vertex AI question (read this first)

The biggest blocker is not architectural — it's a hosting provider lock-in
that has nothing to do with where the app runs.

The Manut copilot routes every AI request to **Google Vertex AI** publishers:
`google` (Gemini), `anthropic` (Claude on Vertex), and the Model Garden
MaaS providers (`meta` / Llama, `mistralai`, `deepseek-ai`). All five
families authenticate via a Google service account scoped to project
`affine-495114`. See [CLAUDE.md §6c](../CLAUDE.md) and
[packages/backend/server/src/plugins/copilot/providers/](../packages/backend/server/src/plugins/copilot/providers/).

**Vertex AI is a Google Cloud product. You cannot use it without a GCP
project.** This is a vendor lock, not a deployment-layer lock — moving the
app server to Railway does not move the AI dependency.

You have three options. Pick one before the rest of the migration even
makes sense to plan:

### Option A — Keep GCP alive just for Vertex AI

The app runs on Railway. All AI calls still hit `aiplatform.googleapis.com`
via the GCP project's service account. You keep:

- The GCP project `affine-495114`
- Billing
- One service account + key (or workload identity federation from Railway)
- The Vertex AI API enabled

You stop paying for: GCE VM, Cloud SQL, Memorystore, Artifact Registry, GCS
buckets, Cloud DNS (already not used — DNS is in Cloudflare).

**Cost saving estimate**: ~$120–200/mo (rough — depends on disk + egress).
GCE e2-medium + Cloud SQL db-custom-1-3840 + Memorystore Basic 1 GB
together easily run that range. Vertex AI billing is per-call, no
infrastructure overhead.

**Trade-off**: you still depend on Google for billing, project policy,
and IAM. The "we're off GCP" goal is half-achieved.

### Option B — Replace Vertex with a non-Google AI provider

Rewrite [prompts.ts](../packages/backend/server/src/plugins/copilot/prompt/prompts.ts)
to use OpenAI direct, Anthropic API direct, or another inference service.
Probably touches `providers/*.ts` (Gemini provider, Anthropic Vertex
provider, MaaS provider, auto-router) too.

**Estimate**: 1–2 engineer-weeks for the rewrite + a full week of QA on
AI prompt regressions. Costs change shape: Anthropic API direct is
~similar pricing to Vertex; OpenAI direct may be cheaper or more
expensive depending on model mix.

**Trade-off**: real engineering work. You also lose Vertex Model Garden's
Llama / Mistral / DeepSeek routing unless you separately wire up
replicate.com / together.ai / similar.

### Option C — Drop AI features

You ship Manut without copilot. Significant feature regression — the
Knowledge Graph activation pulses, Auto Tag, Summary as title, Gmail/Drive
import dialogs, the chat sidebar all go away.

Not recommended unless the product direction is moving away from AI.

### Recommendation

**Option A.** Lowest risk, cheapest, fastest path. You're not "off GCP" but
you're off GCE/Cloud SQL/Memorystore which is where the bulk of the cost
and ops complexity lives. Vertex billing is small and zero ops.

The rest of this doc assumes Option A. If you pick B or C, the plan
changes meaningfully — flag for me and I'll revise.

---

## §2 — Current GCP topology (discovered 2026-05-16)

| Surface        | What                                                                                                           | Where                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| App container  | `affine` (compose service) running `affine-gogocash:main-fc11d7785-25958662159`                                | GCE VM `affine-vm` (e2-standard-?, asia-southeast1-a, static IP `34.142.207.33`)   |
| Reverse proxy  | `caddy:2-alpine` (TLS via Let's Encrypt, serves `manut.xyz`)                                                   | Same VM, compose service                                                           |
| Postgres       | Cloud SQL `affine-pg`, POSTGRES_16, `db-custom-1-3840` (1 vCPU / 3.84 GB), 50 GB PD_SSD                        | asia-southeast1-c, managed                                                         |
| Redis          | Memorystore `affine-redis`, BASIC tier, 1 GB                                                                   | asia-southeast1, managed                                                           |
| Blob storage   | GCS buckets `gogocash-affine-blobs` + `gogocash-affine-backups` (both ASIA-SOUTHEAST1)                         | Currently reporting 0 bytes — needs verification; could be Postgres BYTEA fallback |
| Image registry | Artifact Registry `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash`                        | asia-southeast1                                                                    |
| DNS            | `manut.xyz` → `34.142.207.33`                                                                                  | Cloudflare zone (NS: `hadlee.ns.cloudflare.com`, `odin.ns.cloudflare.com`)         |
| Secrets        | `affine-cio-smtp-*`, `affine-db-password`, `affine-google-oauth-*`                                             | Secret Manager, project `affine-495114`                                            |
| OAuth          | Google OAuth client tied to `affine-495114`                                                                    | GCP Console                                                                        |
| AI             | Vertex AI in `affine-495114`, regions `us-central1` (Gemini, Meta, Mistral, DeepSeek) + `us-east5` (Anthropic) | GCP Vertex                                                                         |
| CI/CD          | GitHub Actions → GAR push → IAP-tunnel SSH to VM → compose swap                                                | `mygogocash/Manut` repo workflows                                                  |
| Backups        | `gogocash-affine-backups` bucket (presumably Cloud SQL automated backups + custom blob backups)                | GCS                                                                                |

**Key fact for migration**: Postgres and Redis are **NOT in-compose**.
They're managed services accessed by hostname. Moving them is straightforward
because the connection-string pattern doesn't change.

---

## §3 — Target Railway topology (proposed under Option A)

| Surface        | What                                                                                                                                                                                                | Where                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| App container  | Pulls `affine-gogocash:<tag>` from GAR                                                                                                                                                              | Railway service `manut-app`, current healthcheck URL `manut-app-production.up.railway.app` |
| Reverse proxy  | Railway's built-in (no Caddy needed)                                                                                                                                                                | Railway edge                                                                               |
| TLS            | Railway-managed                                                                                                                                                                                     | Auto                                                                                       |
| Postgres       | Railway Postgres add-on, ≥ 50 GB                                                                                                                                                                    | Railway region close to user (Singapore = ap-southeast-1?)                                 |
| Redis          | Railway Redis add-on, 1 GB                                                                                                                                                                          | Same region                                                                                |
| Blob storage   | **Decision needed**: stay on GCS (cross-cloud egress costs), move to Railway volume (limited size), or move to S3-compatible (Cloudflare R2 is the obvious cheap option since DNS is already there) |
| Image registry | Stay on GAR (Railway pulls). Optional later: push to Railway too.                                                                                                                                   |
| DNS            | `manut.xyz` → Railway custom hostname via CNAME                                                                                                                                                     |
| Secrets        | Railway environment variables (per service)                                                                                                                                                         |
| OAuth          | **Decision needed**: keep GCP-tied client (works, requires no user re-link) or create new client tied to Railway domain (every connected user re-links Gmail/Drive)                                 |
| AI (Vertex)    | Unchanged — calls go from Railway out to `aiplatform.googleapis.com`. Service account credentials live in Railway env vars.                                                                         |
| CI/CD          | `manut-railway-deploy.yml` already exists, mostly correct. Needs PAT fix + post-deploy probe alignment                                                                                              |
| Backups        | **Decision needed**: Railway Postgres has snapshots; for blobs (if moved to R2), R2 has its own retention                                                                                           |

---

## §4 — Surface-by-surface migration plan

### S1. Image build + push (no change)

Status: ✅ already works. CI builds image and pushes to GAR. Railway pulls
from GAR using a PAT (currently blocked — separate hotfix).

### S2. Postgres migration (Cloud SQL → Railway Postgres)

**Effort**: 1–3 day window depending on data volume.

**Procedure**:

1. Set up Railway Postgres at appropriate spec (initially mirror current
   1 vCPU / 4 GB / 50 GB).
2. On the GCP side, run `pg_dump` against Cloud SQL via Cloud SQL Auth
   Proxy. Save snapshot in a bucket.
3. Restore to Railway Postgres via `psql` from the dump.
4. Verify row counts on every table match.
5. Cut over `DATABASE_URL` env var on the Railway app service.

**Risks**:

- **Data drift during cutover**. The longer between dump and cutover, the
  more writes get lost. Minimize by stopping writes (maintenance mode) for
  the cutover window.
- **Logical replication via WAL** is theoretically possible Cloud SQL →
  Railway, but Railway doesn't expose superuser access — likely not
  feasible. Plan for a write-pause cutover, not zero-downtime.
- **PostgreSQL version**. Railway offers Postgres 14/15/16. Match current
  version (Postgres 16) exactly to avoid extension compatibility issues.

**Rollback**: keep Cloud SQL alive read-only for 30+ days. If post-migration
issues surface, flip `DATABASE_URL` back. Writes during the rollback
window must be replayed manually.

### S3. Redis migration (Memorystore → Railway Redis)

**Effort**: 1–2 hours.

**Procedure**: Redis stores session data, BullMQ queues, AI streaming
state. None of it is durable — losing it costs users a re-login and any
in-flight chat sessions. Acceptable.

1. Provision Railway Redis.
2. Cutover `REDIS_URL` env var simultaneously with the app cutover.
3. Drain BullMQ queues on Memorystore first (let reminder jobs finish) or
   accept that queued jobs orphan. Per CLAUDE.md §9 the `superflow.deliverReminder`
   prefix already has known orphan risk on rename; this is the same family
   of risk.

**Risks**: cleared sessions = every user re-logs-in. Communicate ahead.

### S4. Blob storage decision

Two sub-questions to answer first:

1. **What's actually in `gogocash-affine-blobs` today?** `gcloud storage du`
   reported 0 bytes for both buckets, which is suspicious. Either:
   - The workspace truly has no uploaded blobs (mostly text docs)
   - Blobs are stored as Postgres BYTEA in the workspace tables (the
     AFFiNE default), and the GCS buckets are unused or future-planned
   - The `du` command silently skipped (auth or quota issue)
     Run `gcloud storage ls -r gs://gogocash-affine-blobs | head` to verify.

2. **What does the app expect at runtime?** Check the storage provider
   config in [packages/backend/server/src/base/storage/providers/](../packages/backend/server/src/base/storage/providers/).
   The provider is configured via env (`STORAGE_PROVIDER=s3` vs `local` vs
   `cloudflare-r2` etc).

**If blobs are in Postgres**: nothing to migrate beyond the Postgres dump
in S2. Easy.

**If blobs are in GCS**:

- Option a) keep GCS — Railway app pulls from GCS over the internet
  (egress costs from Railway's region, latency penalty). Bad.
- Option b) `gcloud storage cp` everything to Cloudflare R2 (cheap egress,
  S3-compatible). Re-point app's storage provider config. ← recommended
- Option c) Move to Railway's volume storage. Capped at 100 GB total;
  doesn't scale well for blob workloads. Avoid.

### S5. Domain + TLS

**Effort**: 1 hour.

1. In Railway, add `manut.xyz` as a custom domain on the app service.
   Railway provides a TXT verification record and a CNAME target. Run
   `./scripts/manut-dns-railway-tls.sh` to print the live values from the
   Railway API.
2. In Spaceship DNS (nameservers: `launch1/2.spaceship.net`):
   - **Delete** all `A` / `AAAA` records for `@` (do not point apex at
     Railway or GCP IPs — dual A records cause cert mismatch / "Not secure").
   - Add **CNAME** `@` → Railway target (e.g. `53sd5x3j.up.railway.app`), or
     **ALIAS** at apex if CNAME is not allowed.
   - Add **TXT** `_railway-verify` → value from Railway / the script above.
3. Set Railway runtime env (required for correct app URLs):
   - `AFFINE_SERVER_EXTERNAL_URL=https://manut.xyz`
   - `AFFINE_SERVER_HTTPS=true`
4. Wait for Railway TLS provisioning (~5–15 min); cert status should leave
   `ISSUING` once DNS matches.
5. Verify: `./scripts/manut-dns-railway-tls.sh` and `curl -vI https://manut.xyz`

**Rollback**: flip the DNS record back to the A record. TTL on Cloudflare
defaults to "auto" (~5 min); set to 60s before cutover for faster rollback.

### S6. OAuth client (the user-facing risk)

The Manut app has Google OAuth client credentials in
`affine-google-oauth-client-id` + `affine-google-oauth-client-secret`,
registered in project `affine-495114`. Users who have connected Gmail or
Drive (via the v1.10.2 integrations) have OAuth tokens stored in the
`IntegrationConnection` table, encrypted, tied to **this specific client
ID**.

**Two paths**:

**Path α — keep the existing client**:

- Add these **Authorized redirect URIs** on the existing GCP OAuth client
  (Secret Manager: `affine-google-oauth-client-id`):
  - `https://manut.xyz/oauth/callback` — **Sign in with Google** (the
    Continue with Google button; backend sends this URI to Google)
  - `https://manut.xyz/oauth/google/callback` — Gmail/Drive integrations
    (Settings → Integrations; optional `GOOGLE_OAUTH_REDIRECT_URI` override)
- Add **Authorized JavaScript origin**: `https://manut.xyz`
- Existing user tokens continue to work — no re-link needed.
- After full migration, remove legacy redirect URIs (e.g. GCE host) if unused.
- **Requires keeping the GCP OAuth client in `affine-495114`**, which is
  fine under Option A (project stays alive for Vertex anyway).

**Path β — new client tied to Railway**:

- Create a new Google OAuth client in either the same GCP project or a
  new one.
- Old `client_id` is now invalid for the new app.
- **Every user with a connected Google integration must re-link.** Their
  stored tokens become useless.
- Communicate the disruption in advance.

**Recommendation**: Path α. There is essentially no reason to break user
tokens unless the OAuth client itself is being audited or revoked.

### S7. CI/CD rewrite

**Effort**: 3–5 days of careful work.

Workflows to update (per CLAUDE.md §9 emoji-filter trap, mind the chain):

| Existing                                | New equivalent / status                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manut-build.yml`                       | No change — still builds + pushes image to GAR.                                                                                                  |
| `manut-autodeploy.yml` (GCE)            | Either keep for parallel run during migration, then delete after. Or rewrite to deploy to Railway.                                               |
| `manut-deploy.yml` (manual GCE)         | Same.                                                                                                                                            |
| `manut-railway-deploy.yml`              | **Already exists** — needs PAT fix (separate hotfix). Becomes the new auto-deploy after cutover.                                                 |
| `manut-rollback.yml` (GCE compose-swap) | Need a Railway equivalent. Railway has its own deploy-rollback API but the prompt-seed verification gate (per CLAUDE.md §6c) needs to be ported. |
| `manut-vm-init.yml`                     | Delete after VM teardown.                                                                                                                        |

**Notable port**: the deploy-gate prompt-seed psql verification (CLAUDE.md
§6c) is currently in `scripts/deploy.sh` on the VM. This must be ported to
a Railway equivalent — either run as a post-deploy job in the workflow, or
as a Railway-side "deploy hook." If skipped, the prompt regression class
of bug (v1.8.4 / v1.10.0) can ship undetected.

### S8. Operational tooling differences

| Today (GCP)                                                   | Tomorrow (Railway)                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `gcloud compute ssh affine-vm --tunnel-through-iap` for debug | `railway run` / Railway dashboard shell. Limited.                                                   |
| `sudo docker compose logs -f affine`                          | Railway logs dashboard or `railway logs --service ...`                                              |
| `compose.yml.pre-<feature>.bak` rollback convention           | Railway's "Revert to previous deployment" button or workflow_dispatch redeploy with prior image tag |
| `gcloud sql connect affine-pg`                                | Railway's psql web console or `railway connect`                                                     |
| Cloud Logging for app logs                                    | Railway log viewer (limited retention compared to Cloud Logging)                                    |

**Worth documenting**: a Railway equivalent of the 60-second rollback
recipe in CLAUDE.md §4 ("ROLLBACK" section).

### S9. Cost estimate

**Today (GCP, monthly, rough)**:

- GCE VM (e2-standard-2 estimate): ~$60
- Cloud SQL db-custom-1-3840 + 50 GB SSD: ~$50–70
- Memorystore Basic 1 GB: ~$30
- GAR storage + egress: ~$5–15
- Cloud DNS: $0 (using Cloudflare)
- Network egress: variable, est. $10–30
- Vertex AI: variable (per-token), est. $20–100 depending on usage
- **Total: ~$175–300/mo**

**Under Option A (Railway + GCP-for-Vertex)**:

- Railway base ($5) + app service (1–2 GB constant memory): ~$30–50
- Railway Postgres (Hobby plan, 8 GB / Pro plan, more): $5–20+
- Railway Redis: ~$5–15
- GAR (no change): ~$5–15
- Cloud egress GCS → Railway (if blobs stay on GCS): could be $20–50
- Cloudflare R2 (if blobs move): ~$0–5 (R2 has free egress, only storage)
- Vertex AI (unchanged): $20–100
- **Total: ~$65–250/mo** depending on blob storage choice

**Net**: 30–50% cost reduction is achievable with R2 blob storage. Most of
the savings come from ditching Cloud SQL + Memorystore for Railway's
managed offerings. The migration pays for itself in 2–4 months of running.

⚠️ **Model your actual usage before committing.** These are estimates. The
Railway pricing model (per-second compute) penalizes idle CPU more than
GCP's sustained-use discount; if Manut is mostly idle, Railway saves more.
If it's CPU-busy 24/7, savings narrow.

---

## §5 — Recommended order of operations

### Phase 0 — Preparation (1–2 weeks, no production changes)

- [ ] Decide §1 Vertex AI option (recommendation: A)
- [ ] Verify §4 S4 blob storage actual state (`gcloud storage ls -r`)
- [ ] Fix `RAILWAY_TOKEN` PAT (separate hotfix already discussed)
- [ ] Spin up Railway project + scaffold services (app, postgres, redis)
- [ ] Restore a Cloud SQL snapshot to Railway Postgres as a one-off test
      to verify Postgres 16 compat and dump/restore time
- [ ] Decide §4 S4 blob path (recommendation: R2 if blobs exist)
- [ ] Decide §4 S6 OAuth path (recommendation: α — keep client)
- [ ] Run a Railway parallel deploy on a staging hostname
      (`staging.manut.xyz`) to validate everything works end-to-end

### Phase 1 — Parallel run (2–4 weeks)

- [ ] Railway runs at `staging.manut.xyz`, GCP runs at
      `manut.xyz`. Both serving real traffic (different audiences)
- [ ] Periodic sync: nightly Cloud SQL → Railway Postgres refresh
- [ ] Periodic sync: GCS → R2 incremental copy (if applicable)
- [ ] Run team / power users on staging first, collect feedback
- [ ] Fix any Railway-specific issues (logging, ops, monitoring gaps)

### Phase 2 — Cutover window (planned maintenance, 1–4 hours)

- [ ] Announce maintenance window (24+ hours notice)
- [ ] Lower Cloudflare DNS TTL to 60s ahead of time (~24h before)
- [ ] At T-0: enable maintenance mode (block writes) on GCP
- [ ] Final Postgres dump from Cloud SQL → restore to Railway
- [ ] Final blob sync (if applicable)
- [ ] DNS flip: `manut.xyz` → Railway CNAME
- [ ] Smoke test full feature surface (CLAUDE.md §4 deploy checklist
      adapted for Railway)
- [ ] If green: keep GCP alive read-only for 30+ days as rollback target
- [ ] If red: flip DNS back to GCP, postmortem

### Phase 3 — Wind-down (30+ days after Phase 2 success)

- [ ] Tear down GCE VM `affine-vm` (release static IP `affine-ip`)
- [ ] Delete Cloud SQL `affine-pg` (after final backup snapshot)
- [ ] Delete Memorystore `affine-redis`
- [ ] Keep Artifact Registry alive (still pushing images for Railway pulls)
- [ ] Keep `affine-google-oauth-*` Secret Manager secrets if Path α
- [ ] Keep Vertex AI service account
- [ ] Delete `manut-autodeploy.yml`, `manut-deploy.yml`, `manut-rollback.yml`,
      `manut-vm-init.yml`
- [ ] Update CLAUDE.md §4 + §5 with Railway equivalents

---

## §6 — What I will NOT do without explicit per-phase sign-off

Following the pattern from `RENAME_AFFINE_TO_MANUT.md` §5:

- [ ] No code changes for any of the migration phases until the §1 Vertex
      AI option is decided in writing
- [ ] No Phase 2 cutover without (a) a tested Postgres dump/restore
      roundtrip, (b) a working Railway staging environment that has run
      real traffic for 2+ weeks, (c) a rollback plan documented and dry-run
- [ ] No teardown of GCP resources (Phase 3) until 30+ days post-cutover
      with no rollback incidents

---

## §7 — Open questions / discovery needed

Things this doc deliberately did not resolve, because they need either
user input or live system access:

1. **Blob storage actual state.** `gcloud storage du` reported 0 bytes for
   both `gogocash-affine-blobs` and `gogocash-affine-backups`. Need to
   verify: are blobs in Postgres BYTEA (the AFFiNE default) or in GCS?
   Check via `gcloud storage ls -r gs://gogocash-affine-blobs | head -20`.

2. **Postgres data size.** `pg_dump` time and Railway Postgres tier choice
   depend on actual table sizes. Run `gcloud sql databases list` and
   `pg_dump --schema-only --format=p | wc -l` for a sense of scale, plus
   per-table `pg_relation_size()` queries for the big tables.

3. **Active Google integrations.** Number of `IntegrationConnection` rows
   with a Google provider tells you how many users would have to re-link
   under Path β (S6 OAuth). Run a SELECT count.

4. **Current monthly GCP bill.** The cost estimates in §4 S9 are rough.
   Pull the actual bill from
   https://console.cloud.google.com/billing for `affine-495114` and
   compare.

5. **Railway region availability.** Railway's region for Postgres /
   Redis / app should be close to your users. Verify Singapore / ap-
   southeast-1 is supported.

6. **Cloudflare R2 vs alternatives.** If blob migration is needed, R2 is
   the obvious pick (you're already on Cloudflare DNS). But verify there
   isn't a strategic reason to pick AWS S3 / Backblaze B2 / etc.

---

## §8 — Appendix: discovery commands

Run these to populate §7 before committing to Phase 0:

```bash
# Blob storage actual state
gcloud storage ls -r gs://gogocash-affine-blobs | head -30
gcloud storage ls -r gs://gogocash-affine-backups | head -30

# Postgres size + per-database breakdown
gcloud sql databases list --instance=affine-pg --project=affine-495114

# Connect to Postgres via Cloud SQL Auth Proxy and:
#   SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(C.oid))
#   FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
#   WHERE nspname NOT IN ('pg_catalog', 'information_schema')
#   AND C.relkind = 'r'
#   ORDER BY pg_total_relation_size(C.oid) DESC LIMIT 20;

# Connected Google integrations (run on a psql session against affine-pg)
#   SELECT count(*) FROM "IntegrationConnection" WHERE provider = 'google';

# Current month bill
gcloud billing accounts list
# Then dashboard: https://console.cloud.google.com/billing
```

---

_Last updated: 2026-05-16. Edits via PR only. Phase sign-off is gated on
written acknowledgement of the trade-offs in §1._
