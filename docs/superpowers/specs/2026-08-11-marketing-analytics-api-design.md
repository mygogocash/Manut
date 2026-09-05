# Marketing OneWave — replace Google-Sheet ingest with the TBH Analytics API ("Rahul API")

Date: 2026-08-11
Branch: `claude/marketing-rahul-api-*`
Status: design approved — pending spec review → implementation plan

---

## 1. Context (current state)

The Marketing / OneWave dashboard (`apps/api/src/modules/marketing`, web at
`apps/web/src/app/(dashboard)/partners/dashboard/page.tsx`) currently sources
its per-telco daily metrics from a fragile ~30-tab **Google Sheet**
(`OW_TRACTION_SHEET_ID`). Telco is encoded in each tab title; typo-ridden
headers are normalized in `ow-aliases.ts`. Pipeline:

```
ingestSheet()  →  OwMetricRow[]  →  upsertDailyMetrics() → OwDailyMetric (per date,telco)
                              ↘  rawTabs + warnings  →  OwSnapshot (JSON payload)
```

Triggers: cron `POST /api/cron/ow-snapshot-refresh` → `refreshSnapshot()`, plus a
6h on-read TTL fallback in `holisticDashboard()`. Known pain: telco-matrix tabs
can't auto-map (blocked on a human), headers drift, sheet is hand-maintained.

`MARKETING_ANALYTICS_API_URL` and `MARKETING_ANALYTICS_PARTNER_IDS` are already
declared in `turbo.json` globalEnv but **referenced nowhere in code** — env
plumbing reserved ahead of this work.

## 2. Goal

Make the **TBH Analytics API** (`bnii-analytics-api`, aka the "Rahul API") the
**sole source** of per-(date, telco) daily metrics, replacing the sheet ingest.
Keep the `OwDailyMetric` → `OwSnapshot` → cron → dashboard pipeline intact; only
the **fetch layer** changes. Sheet code stays as a fallback (used only when the
API URL is unset) — no deletion this PR.

## 3. API contract (verified against the live service)

- Base: `MARKETING_ANALYTICS_API_URL` (origin, e.g.
  `https://bnii-analytics-api-epgxydm2fa-as.a.run.app`). Code appends the path.
- **Unauthenticated** (OpenAPI `securitySchemes: {}`). No API key env var.
- `GET /v1/metrics/catalog` — `core_metrics[]`, `transaction_type_pattern`
  (`tx.<transaction_type>.<field>`), `transaction_type_fields`
  (`count|amount|unique_users`), `known_transaction_types[]`.
- `GET /v1/metrics/dictionary` — one-line meaning per metric.
- `POST /v1/metrics/query` — the data endpoint:

  Request (`MetricsQueryRequest`):
  ```json
  {
    "partner_ids": ["<telco-uuid>", "..."],   // 1..10, = client_id in their DB
    "date_from": "YYYY-MM-DD",                 // inclusive, required
    "date_to":   "YYYY-MM-DD",                 // inclusive, required
    "metrics":   ["dau", "tx.use_pass.unique_users", "..."]  // >=1, core and/or tx.* keys
  }
  ```
  Response (`MetricsQueryResponse`):
  ```json
  {
    "date_from": "...", "date_to": "...",
    "results": [                               // one per partner, in request order
      { "partner_id": "<uuid>", "telco_name": "Dialog",
        "series": [ { "date": "YYYY-MM-DD", "metrics": { "<key>": <int|number|null> } } ] }
    ]
  }
  ```
  Errors: `422` `HTTPValidationError` on bad input.

- `partner_ids` cap is **10 per request** → the fetch layer chunks (we have 8
  telcos today, but chunk anyway so growth is safe).

## 4. Metric mapping (decided: **expand the model**)

All 23 API core metrics map 1:1 to columns. Existing 13 columns keep their names;
**+12 new columns** cover the rest. Amount/token columns are `BigInt` (daily BNRY
/ wallet sums can exceed `Int32` = 2.1B); user-count columns stay `Int`.

| `OwDailyMetric` column | type | live API metric | note |
|---|---|---|---|
| homepageViews | Int | `total_views_homepage` | GA4 page views |
| dauCrm | Int | `dau` | Nexus traction DAU |
| dauGa | Int | `dau_ga` | GA4 DAU |
| mauRolling30 | Int | `mau_ga` | GA4 rolling-30 |
| **mauNexus** *(new)* | Int | `mau` | Nexus monthly |
| uniqueUsers | Int | `unique_users` | wallet-active distinct |
| newUsers | Int | `new_users` | registered that day |
| **newUsersGa** *(new)* | Int | `new_users_ga` | GA4 new |
| repeatUsers | Int | `repeated_users` | returning |
| **repeatUsersGa** *(new)* | Int | `repeated_users_ga` | GA4 returning |
| **sessionsGa** *(new)* | Int | `sessions_ga` | GA4 sessions |
| avgSessionSec | Int | `avg_time_spent_seconds` | `Math.round` (API may return float) |
| clicksBnryGames | Int | `total_user_games` | now = distinct games users (was raw clicks) |
| accessPassUsers | Int | `tx.use_pass.unique_users` | tx.* key |
| **totalCredit** *(new)* | BigInt | `total_credit` | wallet incoming |
| **totalDebit** *(new)* | BigInt | `total_debit` | wallet outgoing |
| **totalTransactions** *(new)* | Int | `total_transactions` | all wallet txns |
| **spinUsage** *(new)* | Int | `total_spin_usage` | spin plays |
| **spinWinTokens** *(new)* | BigInt | `total_spin_win_tokens` | BNRY won via spin |
| **uniqueSpinUsers** *(new)* | Int | `unique_spin_users` | distinct spin users |
| **usersFando** *(new)* | Int | `total_user_fando` | Fando engaged |
| **usersNgage** *(new)* | Int | `total_user_ngage` | Ngage engaged |
| bnryEarned | **Int→BigInt** | `total_bnry_tokens_earned` | widen (safe) |
| bnryRedeemed | **Int→BigInt** | `total_bnry_tokens_spent` | widen (safe) |
| stwWins | Int | *(none)* | **left null** under API — live API has no "winners count" |
| **txMetrics** *(new)* | Json | `tx.<type>.<field>` set | flexible transaction metrics (below) |

`sourceTab` = `"analytics-api"`; `isIntraday` = `false` (API is daily);
`isAnomaly` untouched (default false — anomaly detection is out of scope).

### 4a. Transaction metrics → `txMetrics` JSON (decided)

The `tx.<type>.<field>` space (~26 types × {count, amount, unique_users}) is
open-ended ("new ETL types allowed if they match the pattern"). Storing it as a
`Json?` column keeps the schema stable. The requested tx.* key list is built
**from the live catalog** at ingest time (`GET /v1/metrics/catalog` →
`known_transaction_types × transaction_type_fields`), with a hardcoded fallback
list if the catalog call fails. Response tx.* values (non-null) are stored under
`txMetrics` as `{ "tx.purchase.amount": 123, ... }`. `accessPassUsers` keeps its
own column for continuity **and** is derivable from `tx.use_pass.unique_users`.

## 5. Fetch-layer architecture

New file `ow-analytics-api.service.ts` — mirrors `ow-ingest.service.ts`'s output
contract so downstream code is untouched:

```ts
export async function ingestAnalyticsApi(): Promise<OwIngestResult>
```

Steps:
1. Read + parse `MARKETING_ANALYTICS_PARTNER_IDS` (`slug:uuid,...`). Validate each
   slug ∈ `OW_TELCOS`; warn + skip unknown slugs. Empty/unset → return empty
   result with a warning (best-effort, never throws — mirrors `ingestSheet`).
2. Fetch `/v1/metrics/catalog` to build the tx.* request list (fallback: constant).
3. Build the `metrics` request array = all 23 core keys + `tx.use_pass.unique_users`
   + the tx.* set. (`stwWins` has no core source, so nothing is requested for it —
   it stays null.)
4. Chunk `partner_ids` ≤10; `POST /v1/metrics/query` per chunk with
   `date_from = MARKETING_ANALYTICS_BACKFILL_FROM`, `date_to = today (UTC)`.
5. Map each `PartnerMetricsResult` → telco slug via the env map keyed on
   `partner_id` (not the response `telco_name` — env is authoritative). For each
   `MetricPoint` build an `OwMetricRow`: core columns from `metrics{}`, `txMetrics`
   from the `tx.*` keys, `isIntraday=false`, `sourceTab="analytics-api"`.
6. Synthesize `rawTabs`: one grid per telco (`title=slug`, `headers=["date", ...metric labels]`,
   `rows`=series as strings) so the existing dashboard renders unchanged.
7. Return `{ metrics, rawTabs, telcos, warnings, fetchedAt }`.

**Source selection** in `refreshSnapshot()`:
```
if (MARKETING_ANALYTICS_API_URL set && partner map non-empty) → ingestAnalyticsApi()
else → ingestSheet()   // fallback; unchanged
```
`upsertDailyMetrics()` extended to write the new columns + `txMetrics` (BigInt
coercion for amount columns).

## 6. Refresh strategy (decided: **full history every run**)

Every `refreshSnapshot()` re-fetches `date_from = MARKETING_ANALYTICS_BACKFILL_FROM`
→ `date_to = today`. Idempotent upsert on `(date, telco)` overwrites, so late ETL
corrections propagate. Acceptable load: ~8 telcos × range, one (chunked) call.
No incremental-window bookkeeping.

## 7. BigInt at the JSON boundary

Prisma returns `bigint` for the BigInt columns; `JSON.stringify` throws on
`bigint`. Handling:
- Synthesized `rawTabs` values are already strings — no issue.
- Any read path that returns raw `OwDailyMetric` rows (dashboard aggregation)
  coerces BigInt → Number at the boundary (daily values are far below
  `Number.MAX_SAFE_INTEGER` ≈ 9e15). A small `toNum()` helper in the repository
  read; no global `BigInt.prototype.toJSON` patch.

## 8. Dashboard (decided: **keep rendering, synthesize grids**)

No React rewrite this PR. The synthesized `rawTabs` (§5.6) feed the existing
holistic section; `metricCount`/`warnings`/`telcos` populate as before. For the
top `traction` exhibit (`dashboard().getTraction`), add an API-source branch that
returns a compact recent grid synthesized from the latest ingest (falling back to
`null` when unconfigured). Proper per-metric charts = follow-up.

## 9. Config / env

| var | where | value |
|---|---|---|
| `MARKETING_ANALYTICS_API_URL` | turbo.json (exists), root `.env.*`, GH secrets, `deploy.yml` | API origin |
| `MARKETING_ANALYTICS_PARTNER_IDS` | turbo.json (exists), root `.env.*`, GH secrets, `deploy.yml` | `gopay:<uuid>,dialog:<uuid>,...` (slug ∈ OW_TELCOS) |
| `MARKETING_ANALYTICS_BACKFILL_FROM` | **add** to turbo.json + root `.env.*` + GH secrets + `deploy.yml` | history start `YYYY-MM-DD` (e.g. `2026-05-01`) |

API-only — **not** mirrored in `apps/web/.env`. Fail-open on source selection:
missing API url → sheet fallback (not a hard error).

## 10. Migration (`packages/database/prisma/schema/operations.prisma`)

`ALTER TABLE ow_daily_metrics`:
- `ADD COLUMN IF NOT EXISTS` for the 12 new core columns + `tx_metrics jsonb`.
- `ALTER COLUMN bnry_earned TYPE bigint`, `bnry_redeemed TYPE bigint`,
  and the new amount columns typed `bigint` at creation.
Idempotent per CLAUDE.md (`IF NOT EXISTS`; `TYPE bigint` is safe to re-run).
Run `pnpm db:generate` after. Note: staging syncs via `db:push` (schema only);
no data backfill runs there — the cron populates rows.

## 11. Testing

- `ow-analytics-api.test.ts` (new): fixture `MetricsQueryResponse` → expected
  `OwMetricRow[]` — core mapping, `txMetrics` capture, BigInt coercion, slug
  bucketing by `partner_id`, `stwWins` null, `avg_time_spent_seconds` rounding,
  null passthrough.
- Partner-map parsing: `slug:uuid` list, malformed entries, unknown slug warning,
  empty/unset.
- Chunking: >10 partners → multiple requests, order preserved.
- Catalog-driven tx list: mocked catalog → request metric array; fallback on
  catalog failure.
- Source selection: API url set → API path; unset → sheet path.
- Existing `ow-ingest.test.ts` unchanged.

## 12. Out of scope / follow-ups

- Retiring/deleting the sheet ingest code and `OW_TRACTION_SHEET_*` env.
- Proper per-telco / per-metric charts + GA-vs-Nexus comparison UI.
- Anomaly detection (`isAnomaly`) and the AI narrative.
- A "STW winners" metric if ETL later exposes one (unblocks `stwWins`).
- Backfill-trigger UI (today it's just the cron + `?fresh=1`).

## 13. Deploy-time inputs still needed (not code)

- The real `slug → telco UUID` values for `MARKETING_ANALYTICS_PARTNER_IDS`
  (from the atlas telco/client seed) — set in GH secrets / Cloud Run env.
- `MARKETING_ANALYTICS_BACKFILL_FROM` — the earliest date with valid data.
