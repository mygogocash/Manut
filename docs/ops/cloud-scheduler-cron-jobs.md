# Cloud Scheduler cron jobs

This document tracks the Google Cloud Scheduler jobs the Intranet API relies on.
Each job hits a `POST /api/cron/*` endpoint with the `X-Cron-Secret` header set
to `CRON_SECRET`.

## Active jobs

Every endpoint lives in `apps/api/src/modules/cron/cron.controller.ts` and is gated by the
`X-Cron-Secret: ${CRON_SECRET}` header (`verifyCronSecret`). The "Schedule" column shows the
recommended cadence from the route comments; only the four rows marked **auto** are actually
created by CI today — the rest are manual (or not yet scheduled).

> **Audited 2026-08-26.** The controller registers **21 routes / 20 distinct endpoints**
> (`/crm-deadline-reminders` has a legacy alias). This table had drifted by three:
> `/accounting-status`, `/it-billing-reminders` and `/marketing-drift-check` were documented
> only in `CLAUDE.md` and are now listed below.
>
> **This file is not the source of truth for what is actually scheduled.** It records intent.
> For live state, run and read:
>
> ```bash
> gcloud scheduler jobs list --project=tbh-nexora --location=asia-southeast1 \
>   --format="table(name,schedule,timeZone,state,httpTarget.uri)"
> ```
>
> Keeping this table honest automatically is tracked in
> [`../DOCS_PLAN.md`](../DOCS_PLAN.md).

| Job / endpoint                             | Schedule (Asia/Bangkok)        | Owner               | Provisioned by      |
| ------------------------------------------ | ------------------------------ | ------------------- | ------------------- |
| `POST /api/cron/sync-storage-snapshot`     | `30 4 * * *` (04:30)           | Workspace Usage     | `deploy.yml` (auto) — job `storage-snapshot-daily` |
| `POST /api/cron/aria-knowledge-sync`       | `0 3 * * *` (03:00)            | ARIA                | `deploy.yml` (auto) — job `aria-knowledge-sync-daily` |
| `POST /api/cron/aria-purge-pii`            | `30 2 * * *` (02:30)           | ARIA                | `deploy.yml` (auto) — job `aria-purge-pii-daily` |
| `POST /api/cron/expense-monthly-reminders` | `0 9 22 * *` (09:00 on 22nd)   | Expenses / HR       | `deploy.yml` (auto) — job `expense-monthly-reminders` |
| `POST /api/cron/leave-escalation`          | daily (recommended)            | Leave / HR          | manual              |
| `POST /api/cron/stale-leads-digest`        | daily (recommended)            | Sales CRM           | manual              |
| `POST /api/cron/legal-expiry-digest`       | daily (recommended)            | Legal               | manual              |
| `POST /api/cron/sync-telemetry`            | ~04:00 (recommended)           | Telemetry / PostHog | manual              |
| `POST /api/cron/crm-email-sync`            | every 10 min (recommended)     | Sales CRM           | manual              |
| `POST /api/cron/visa-expiry-reminders`     | ~08:00 (recommended)           | Visa / HR           | manual              |
| `POST /api/cron/ninety-day-reminders`      | ~08:00 (recommended)           | Immigration (TM.47) | manual              |
| `POST /api/cron/attendance-missed-checks`  | hourly / after shift start     | Attendance / HR     | manual              |
| `POST /api/cron/attendance-manager-alerts` | daily after shift start (~10:00) | Attendance / HR   | manual              |
| `POST /api/cron/aria-daily-brief`          | hourly (filters subscribers by local hour) | ARIA   | manual              |
| `POST /api/cron/ow-snapshot-refresh`       | a few times/day (cadence TBC)  | Marketing / OneWave | manual              |
| `POST /api/cron/fx-sync`                   | ~07:00 — no-op until `BOT_API_CLIENT_ID` set | Expenses / FX | manual              |
| `POST /api/cron/crm-deadline-reminders`    | `0 8 * * *` (08:00, recommended) | All CRMs (generalized engine) | manual — legacy alias `/api/cron/it-crm-deadline-reminders` hits the same handler; keep only ONE job scheduled |
| `POST /api/cron/accounting-status`         | `0 8 * * *` (08:00)            | Accounting          | manual — auto-expires sent quotes past expiry, flags overdue invoices/bills. "Today" resolved in Asia/Bangkok |
| `POST /api/cron/it-billing-reminders`      | `0 8 * * *` (08:00)            | IT Operations       | manual — renewal (30/15/7-day) + payment-due (7-day) alerts, debounced per subscription via `reminders_sent` |
| `POST /api/cron/marketing-drift-check`     | `0 9 * * *` (09:00)            | Marketing analytics | manual — **the prod job EXISTS and is PAUSED** (created before the endpoint reached `main`). Resume with `gcloud scheduler jobs resume marketing-drift-check --project=tbh-nexora --location=asia-southeast1` |

> **Auto-provisioned (4):** `storage-snapshot-daily`, `aria-knowledge-sync-daily`,
> `aria-purge-pii-daily`, `expense-monthly-reminders` — each created/updated idempotently after a
> successful prod API deploy in `deploy.yml`. Everything else is created manually (some are not
> scheduled anywhere yet). Coordinate with infra before adding new auto-provisioned jobs (per
> `CLAUDE.md`).

## How the auto-provisioned jobs work

`.github/workflows/deploy.yml` runs one idempotent step per auto-provisioned job
(`storage-snapshot-daily`, `aria-knowledge-sync-daily`, `aria-purge-pii-daily`,
`expense-monthly-reminders`) after every successful API deploy. Each is gated on
`vars.SKIP_SCHEDULER_PROVISION != 'true'` and follows the describe-then-create-or-update
pattern:

```bash
gcloud scheduler jobs describe <job> --location="$REGION" \
  && gcloud scheduler jobs update http <job> ... --update-headers="$HEADERS" \
  || gcloud scheduler jobs create http <job> ... --headers="$HEADERS"
```

> `create` uses `--headers` (full replace); `update` uses `--update-headers` (merge) — the
> workflow keeps two distinct flag sets per path. Body is empty `{}`, header is
> `X-Cron-Secret: ${CRON_SECRET}` (matches the `verifyCronSecret` middleware in
> `apps/api/src/modules/cron/cron.controller.ts`). Each step also `gcloud services enable
> cloudscheduler.googleapis.com` and retries 5× to absorb API-activation propagation.

## Required IAM on the Workload Identity Federation service account

The deploy SA needs `roles/cloudscheduler.admin` on the project. Without it the
provisioning step fails with `PERMISSION_DENIED`. Grant once:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/cloudscheduler.admin"
```

The same SA already has `roles/run.admin`; this is one extra grant.

## Escape hatch

To skip the auto-provisioning (e.g. during a region failover or when the
scheduler is disabled by ops):

1. Set repo variable `SKIP_SCHEDULER_PROVISION=true` in **Settings → Variables → Actions**.
2. Re-deploy. The step will short-circuit cleanly.

Unset the variable to resume auto-provisioning.

## Manual provisioning (fallback)

If CI cannot provision (missing IAM, escape hatch on, or you want to drive the
job from a workstation), run:

```bash
PROJECT_ID=...
REGION=asia-southeast1
API_URL=$(gcloud run services describe nexora-api --region="$REGION" --format='value(status.url)')

gcloud scheduler jobs create http storage-snapshot-daily \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="30 4 * * *" \
  --time-zone="Asia/Bangkok" \
  --uri="${API_URL}/api/cron/sync-storage-snapshot" \
  --http-method=POST \
  --headers="X-Cron-Secret=${CRON_SECRET},Content-Type=application/json" \
  --message-body='{}' \
  --attempt-deadline=180s \
  --description="Daily Supabase Storage usage snapshot for /admin Workspace Usage."
```

To force-run once for verification:

```bash
gcloud scheduler jobs run storage-snapshot-daily --location="$REGION"
gcloud logging read \
  'resource.type="cloud_run_revision" AND textPayload=~"storage-snapshot"' \
  --limit=20 --freshness=10m
```

## Verification after first run

```sql
-- Inside the prod database
SELECT bucket, bytes, object_count, captured_at
FROM storage_snapshots
ORDER BY captured_at DESC
LIMIT 20;
```

The Workspace Usage tab's bucket-health card reads from this table — no rows
means the snapshot has not run yet.
