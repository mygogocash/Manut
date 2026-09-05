# Marketing Analytics

Engagement analytics for the OneWave telco estate, sourced from the BNII
Analytics API. Covers the DAU/MAU workbook exhibits, the Traffic Dashboard,
per-partner workspaces, the Raw Data explorer, and the daily drift check that
keeps the two readers of that API honest with each other.

- **Web**: `/marketing-analytics` and its sub-routes
- **API**: `/api/marketing-analytics`, `/api/marketing`, `/api/marketing-campaigns`
- **Permissions**: `marketing:dashboard:view`, `marketing:raw:view`,
  `marketing:reports:view`, `marketing:campaign:{view,create,update,delete}`;
  org-wide config writes gate on `admin:manage`

---

## The upstream: BNII Analytics API

One external HTTP dependency, unauthenticated, base URL defaulted in code so
the module works with no configuration at all:

```
https://bnii-analytics-api-epgxydm2fa-as.a.run.app
  POST /v1/metrics/query      partner_ids, date_from, date_to, metrics[]
  GET  /v1/metrics/catalog    core metrics + known transaction types
  GET  /v1/metrics/dictionary metric descriptions
```

`MARKETING_ANALYTICS_API_URL` overrides the base. It is an override, not a
prerequisite — an unset variable must never silently disable the only data
source, which it previously did.

### Partner registry

`apps/api/src/modules/marketing/bnii-partners.ts` is the single registry of
partners, shared by the analytics module and the OneWave ingest. Both used to
keep their own copy and had drifted in three ways that each caused a silent
failure: only one defaulted the base URL, the two read
`MARKETING_ANALYTICS_PARTNER_IDS` in different shapes (`slug:uuid` pairs vs
JSON), and their partner lists disagreed so Banglalink and Robi could never be
ingested at all.

Nine partners. Two naming notes are load-bearing:

- **`ryze` IS Banglalink.** The slug stays `ryze` because existing
  `ow_daily_metrics` rows are keyed by it; renaming orphans that history.
- **Okara is Vietnam**, not Pakistan, and is excluded from estate totals by
  the workbook's rule.

### Three id spaces

The single most confusing thing in this module. A field has up to three
different names and they are not interchangeable:

| Space | Example | Where it is used |
|---|---|---|
| Canonical id | `mau_d30` | referenced by metric formulas |
| Atlas ingest name | `mau` | the FIELD ID shown in Raw Data |
| Upstream BNII key | `mau_ga` | what you actually request from the API |

Mapping between the persisted column and the upstream key lives in
`API_CORE_TO_KEY` (`marketing/ow-analytics-map.ts`). Anything needing that
mapping must import it rather than restate it — a second copy is free to drift
from the thing it describes.

---

## Two independent readers of the same upstream

This is the module's defining structural fact:

| Surface | Source |
|---|---|
| `/marketing-analytics/dau-mau` | live BNII query per request (5-min cache), persists nothing |
| OneWave dashboard, Partner Workspaces | `ow_daily_metrics`, written by the `ow-snapshot-refresh` cron |

The same day can therefore read differently on two pages. A missed cron run, a
partially-ingested chunk (the ingest writes partial rows when a chunk fails) or
an upstream restatement of history all produce exactly that, silently. The
drift check below exists solely to notice.

---

## Surfaces

### Overview (`/marketing-analytics`)
Holistic OneWave engagement view with an admin-editable narrative
(`SystemSetting`-backed, `admin:manage` to write).

### DAU / MAU (`/marketing-analytics/dau-mau`)
The source workbook reimplemented as pure functions over `DauPoint[]`
(`dau-mau.metrics.ts`) — no DB and no `Date.now()` inside the maths, so every
exhibit is reproducible and unit-tested against the workbook's known numbers.
Tabs: Dashboard, DAU Explorer, 3-Day Trends, Forecast, Weekly Growth, Charts,
Campaign Index, Daily Recap.

**The one rule**: a blank day is `dau === null`, never `0`. Blanks are ignored
by every average, sum and percentage rather than dragging a mean down.
Percentages return `null` (not `0`) on an empty denominator so the UI renders
"—".

Two labelling facts worth stating plainly, because both have already caused a
reconciliation exercise:

- **"Homepage views" is not sessions.** The exhibit plots
  `total_views_homepage`, which runs roughly 2× BNII's GA-sourced
  `sessions_ga` and has been widening (1.9× June, 2.2× July, 2.6× August). It
  will not tie out to the "Sessions" figure in the Telco Reports Data Studio
  dashboard, which reads its own GA source.
- **"Estate DAU, summed" is user-days, not a headcount.** Summing daily actives
  over the loaded window counts a daily returner once per day, and the window
  reaches back only as far as the range on screen.

The date range is a **draft** until Apply (`useAppliedDateRange`), and the
exhibit window follows the picked range rather than a fixed 28 days.

### Traffic Dashboard (`/marketing-analytics/traffic`)
Per-metric time series with range presets plus a custom range behind Apply.
Per-partner drill-down at `traffic/[partnerId]`.

### Partner Workspaces (`/marketing-analytics/partners`)
Per-partner Raw Data and Metrics, mirroring the Atlas Operator Console: 31
shown raw fields and 166 catalog metrics, evaluated by a faithful port of the
Atlas formula DSL (`atlas/metric-formula.ts` — recursive descent, eight
functions, `[t-k]` indexing; returns `null` on anything non-computable and
refuses trailing tokens so prose never partially evaluates).

### Raw Data (`/marketing-analytics/raw`), Reports, Campaigns, Settings
Field-level explorer, exports, campaign CRM, and host-baseline configuration.

---

## Scheduled jobs

### `POST /api/cron/ow-snapshot-refresh`
Ingests the BNII series into `ow_daily_metrics` + an `ow_snapshots` payload.
Idempotent (upsert on `(date, telco)`). Best-effort: a flaky read yields a
partial result and never throws, and an empty ingest will not overwrite a good
snapshot.

### `POST /api/cron/marketing-drift-check` — daily 09:00 Asia/Bangkok
Audits that the two readers still agree. Diffs `dau_ga`, `mau_ga` and
`total_views_homepage` for the trailing **30 settled days** (today and
yesterday excluded) against `ow_daily_metrics`, and cross-foots the dashboard's
published totals against the parts published beside them.

Finding kinds: `missing_row`, `unsettled_row` (a settled day still flagged
`is_intraday` — the ingest never came back for it), `missing_value`,
`value_mismatch`, `orphan_value` (held here, gone upstream — the one direction
a re-ingest will not fix).

Three design rules, each guarding a specific failure:

1. **Never alerts on an inconclusive run.** A failed query, an empty window, or
   a telco upstream has no data for at all is reported as inconclusive or
   silent — otherwise a BNII outage alerts every stored day as broken.
2. **The debounce is a fingerprint, not a timestamp.** It digests *which*
   `(telco, date, metric)` drifted and deliberately excludes magnitudes, so a
   permanent upstream restatement does not re-alert every morning while a new
   day or metric still does.
3. **Cross-foot, don't re-implement.** Each assertion compares two figures the
   payload already contains, reached by different aggregation orders. Only
   exact sums are asserted, never means or ratios — those legitimately disagree
   when the underlying series have different null coverage, and an invariant
   that can fail honestly is worse than none.

Body accepts `{"force":true}`, `{"dryRun":true}` and
`{"today":"YYYY-MM-DD","days":N}`. Recipients live in `SystemSetting`
`marketing-analytics.drift_recipients`, editable via the **Drift alerts**
dialog on the DAU/MAU page. An empty list means no email — the check still runs
and still reports.

> A clean report shows `recipients: 0` because the run returns on "no drift"
> before it ever reads the list. That is not evidence the list is unset.

---

## Layout

```
apps/api/src/modules/marketing/            ingest + partner registry
  bnii-partners.ts                         the nine partners, single source
  ow-analytics-api.service.ts              BNII → OwMetricRow ingest
  ow-analytics-map.ts                      API_CORE_TO_KEY, pure, tested
apps/api/src/modules/marketing-analytics/
  marketing-analytics.service.ts           BNII client, caching, dashboards
  dau-mau.metrics.ts                       pure workbook engine
  atlas/                                   ported Atlas fields, metrics, DSL
  drift/                                   drift.check.ts (pure) + service
apps/web/src/app/(dashboard)/marketing-analytics/
  dau-mau/ traffic/ partners/ raw/ reports/ campaigns/ settings/
```

Tables: `ow_daily_metrics` (`@@unique([date, telco])`), `ow_snapshots`,
`mkt_campaigns`.

---

## Related

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) — platform architecture
- [MODULES_SPECIFICATION.md](MODULES_SPECIFICATION.md) — all modules
- `CLAUDE.md` — cron provisioning, current scheduler state, working rules
