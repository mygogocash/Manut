# Cutover runbook — Cloudflare edge (Phase 9)

Weekend window. **Do not execute** until Phase 8 gates pass and founder signs off.
Same Postgres stays; session model changes (users re-login once).

## Pre-flight (T−7d)

1. Staging UAT green on `next-staging.intranet…` Worker.
2. Prod Hyperdrive + R2 + KV + Queues provisioned (`intranet-prod-*`).
3. `docs/ops/scheduler-snapshot-*.json` reconciled with `apps/edge-jobs/src/schedule.ts`.
4. Freeze plan communicated; rollback owner named.

## T−24h

1. Announce freeze.
2. Disable Cloud Run / Vercel deploy workflows (or leave paused).
3. Set DNS TTL **300** on `intranet.` and `staging-intranet.` (and apex CNAME targets).

## T−2h

1. Final storage delta:  
   `DIRECT_URL=$PROD_DIRECT node packages/db/scripts/migrate-storage.mjs --delta`
2. Final auth import:  
   `DIRECT_URL=$PROD_DIRECT node packages/db/scripts/migrate-supabase-auth.mjs`
3. `pnpm db:drizzle:migrate` against prod (or confirmed already applied).
4. Enable prod Cron in `apps/edge-jobs` wrangler (was disabled to avoid double-fire with GCP).

## T (cutover)

1. Attach Workers custom domain: `manut.xyz` → prod edge Worker  
   (zone already on Cloudflare; remove Vercel CNAME).
2. `staging-intranet.` → staging Worker (if not already).
3. Smoke: login (magic-link + password), `/api/auth/me`, one leave list, one upload, one cron forced tick.
4. Users must re-login (Better Auth session cookies).

## T+0…48h watch

- Workers error rate, DO exceptions, Queue DLQ depth, email send counts.
- **Rollback:** re-point CNAME to Vercel within TTL; re-enable `deploy-vercel.yml`.  
  Data stays compatible (same Postgres). Leave Supabase Auth enabled until T+14d.

## T+14d (green)

1. Disable Supabase Auth providers.
2. Delete Cloud Run services, Artifact Registry repo, Cloud Scheduler jobs, WIF, obsolete GitHub secrets (`WIF_*`, `GCP_*`, `VERCEL_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GCS_*`), Vercel project.
3. Remove legacy trees only after a dedicated cleanup PR: `apps/api`, `apps/web`, `packages/database`, `docker/`, old deploy workflows.
4. Delete Supabase Storage buckets after **30-day** retention.

## Contacts

- Cutover lead: _TBD_
- Rollback lead: _TBD_
- Cloudflare account admin: founder
