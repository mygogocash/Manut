# Marketing Analytics API Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the OneWave Google-Sheet ingest with the TBH Analytics API ("Rahul API") as the sole source of per-(date, telco) daily metrics, expanding the schema to all 23 API core metrics + a JSON transaction bag.

**Architecture:** A new pure mapping module (`ow-analytics-map.ts`) turns a `POST /v1/metrics/query` response into the existing `OwMetricRow[]` contract; a thin orchestration service (`ow-analytics-api.service.ts`) does catalog + chunked query I/O best-effort. `refreshSnapshot()` selects the API when configured, else falls back to the sheet. `OwDailyMetric` gains 12 columns + `txMetrics` JSON; two token columns widen `Int→BigInt`.

**Tech Stack:** Express 5 + TypeScript, Prisma 6 (PostgreSQL), Vitest, Node global `fetch`.

## Global Constraints

- Backend exceptions only from `src/common/exceptions/http-exception` — never `throw new Error(...)`. (The ingest path is best-effort: it logs + returns an empty/partial result, never throws to the caller — mirrors `ingestSheet`.)
- Logger is winston (`src/common/utils/logger.ts`): `logger.info("msg", { … })` / `logger.error(...)`. No secrets in logs.
- Migrations idempotent: `ADD COLUMN IF NOT EXISTS` / `DROP … IF EXISTS`. Never edit a committed migration.
- Generated Prisma client is gitignored; run `pnpm db:generate` after schema edits.
- Prisma `Json` writes use an inline object literal or cast `as Prisma.InputJsonValue`; null via `Prisma.JsonNull`.
- Env additions: root `.env.development`, `turbo.json` `globalEnv`, GitHub Secrets + `deploy.yml` `--set-env-vars`. API-only vars are NOT mirrored in `apps/web`.
- Canonical telco slugs: `OW_TELCOS` in `ow-aliases.ts` (`gopay|dialog|ryze|telkomsel|okara|myim3|bima|u9`).
- API base: `MARKETING_ANALYTICS_API_URL` (origin). Endpoints: `GET /v1/metrics/catalog`, `POST /v1/metrics/query`. Unauthenticated. `partner_ids` cap = 10/request.

---

### Task 1: Schema — expand `OwDailyMetric`

**Files:**
- Modify: `packages/database/prisma/schema/operations.prisma` (model `OwDailyMetric`, ~line 1487)
- Create: `packages/database/prisma/migrations/<stamp>_ow_analytics_api_columns/migration.sql`

**Interfaces:**
- Produces: 12 new columns + `txMetrics Json?`; `bnryEarned`/`bnryRedeemed` become `BigInt?`. Consumed by Tasks 2/4.

- [ ] **Step 1: Edit the Prisma model**

In `model OwDailyMetric`, keep existing fields; change the two token columns and add the new ones (place after `bnryRedeemed`):

```prisma
  bnryEarned      BigInt?  @map("bnry_earned")
  bnryRedeemed    BigInt?  @map("bnry_redeemed")
  mauNexus         Int?    @map("mau_nexus")
  newUsersGa       Int?    @map("new_users_ga")
  repeatUsersGa    Int?    @map("repeat_users_ga")
  sessionsGa       Int?    @map("sessions_ga")
  totalCredit      BigInt? @map("total_credit")
  totalDebit       BigInt? @map("total_debit")
  totalTransactions Int?   @map("total_transactions")
  spinUsage        Int?    @map("spin_usage")
  spinWinTokens    BigInt? @map("spin_win_tokens")
  uniqueSpinUsers  Int?    @map("unique_spin_users")
  usersFando       Int?    @map("users_fando")
  usersNgage       Int?    @map("users_ngage")
  txMetrics        Json?   @map("tx_metrics")
```

- [ ] **Step 2: Create the migration**

Run: `pnpm db:migrate -- --name ow_analytics_api_columns`
(If the connection to Supabase is unavailable, create the folder + `migration.sql` by hand with the SQL in Step 3 and run `pnpm db:generate`.)

- [ ] **Step 3: Make the migration idempotent**

Replace the generated `migration.sql` body with:

```sql
ALTER TABLE "ow_daily_metrics"
  ADD COLUMN IF NOT EXISTS "mau_nexus" INTEGER,
  ADD COLUMN IF NOT EXISTS "new_users_ga" INTEGER,
  ADD COLUMN IF NOT EXISTS "repeat_users_ga" INTEGER,
  ADD COLUMN IF NOT EXISTS "sessions_ga" INTEGER,
  ADD COLUMN IF NOT EXISTS "total_credit" BIGINT,
  ADD COLUMN IF NOT EXISTS "total_debit" BIGINT,
  ADD COLUMN IF NOT EXISTS "total_transactions" INTEGER,
  ADD COLUMN IF NOT EXISTS "spin_usage" INTEGER,
  ADD COLUMN IF NOT EXISTS "spin_win_tokens" BIGINT,
  ADD COLUMN IF NOT EXISTS "unique_spin_users" INTEGER,
  ADD COLUMN IF NOT EXISTS "users_fando" INTEGER,
  ADD COLUMN IF NOT EXISTS "users_ngage" INTEGER,
  ADD COLUMN IF NOT EXISTS "tx_metrics" JSONB;

ALTER TABLE "ow_daily_metrics"
  ALTER COLUMN "bnry_earned" SET DATA TYPE BIGINT,
  ALTER COLUMN "bnry_redeemed" SET DATA TYPE BIGINT;
```

- [ ] **Step 4: Regenerate + type-check**

Run: `pnpm db:generate && pnpm --filter @nexora/api type-check`
Expected: PASS (Prisma client now exposes the new fields; `bnryEarned`/`bnryRedeemed` typed `bigint | null`).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema/operations.prisma packages/database/prisma/migrations
git commit -m "feat(marketing): expand OwDailyMetric for analytics-api metrics"
```

---

### Task 2: Pure mapping module `ow-analytics-map.ts`

**Files:**
- Modify: `apps/api/src/modules/marketing/ow-aliases.ts` (extend `OwMetricKey` union)
- Modify: `apps/api/src/modules/marketing/ow-ingest.service.ts` (add `txMetrics` to `OwMetricRow`)
- Create: `apps/api/src/modules/marketing/ow-analytics-map.ts`
- Test: `apps/api/src/modules/marketing/__tests__/ow-analytics-map.test.ts`

**Interfaces:**
- Consumes: `OwMetricRow`, `OwRawTab`, `OwTelco`, `OW_TELCOS`.
- Produces:
  - `API_CORE_TO_KEY: Record<string, OwMetricKey>` (23 entries)
  - `AMOUNT_KEYS: Set<OwMetricKey>` (`bnryEarned,bnryRedeemed,totalCredit,totalDebit,spinWinTokens`)
  - `ACCESS_PASS_METRIC = "tx.use_pass.unique_users"`
  - `parsePartnerMap(raw: string | undefined): { byUuid: Map<string, OwTelco>; warnings: string[] }`
  - `buildMetricRequestList(txTypes: string[], txFields: readonly string[]): string[]`
  - `FALLBACK_TX_TYPES: string[]`, `TX_FIELDS = ["count","amount","unique_users"] as const`
  - `mapResultsToRows(results: ApiPartnerResult[], byUuid: Map<string, OwTelco>): { rows: OwMetricRow[]; warnings: string[] }`
  - `synthesizeRawTabs(rows: OwMetricRow[]): OwRawTab[]`
  - types `ApiMetricPoint`, `ApiPartnerResult`, `ApiQueryResponse`

- [ ] **Step 1: Extend `OwMetricKey` and `OwMetricRow`**

In `ow-aliases.ts`, add the 12 new members to the `OwMetricKey` union:

```ts
export type OwMetricKey =
  | "homepageViews"
  | "dauCrm"
  | "dauGa"
  | "mauRolling30"
  | "uniqueUsers"
  | "newUsers"
  | "repeatUsers"
  | "avgSessionSec"
  | "stwWins"
  | "clicksBnryGames"
  | "accessPassUsers"
  | "bnryEarned"
  | "bnryRedeemed"
  | "mauNexus"
  | "newUsersGa"
  | "repeatUsersGa"
  | "sessionsGa"
  | "totalCredit"
  | "totalDebit"
  | "totalTransactions"
  | "spinUsage"
  | "spinWinTokens"
  | "uniqueSpinUsers"
  | "usersFando"
  | "usersNgage";
```

In `ow-ingest.service.ts`, add a `txMetrics` field to `OwMetricRow`:

```ts
export interface OwMetricRow {
  date: string;
  telco: OwTelco;
  values: Partial<Record<OwMetricKey, number>>;
  txMetrics?: Record<string, number>;
  isIntraday: boolean;
  sourceTab: string;
}
```

- [ ] **Step 2: Write failing tests**

Create `__tests__/ow-analytics-map.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parsePartnerMap,
  buildMetricRequestList,
  mapResultsToRows,
  synthesizeRawTabs,
  API_CORE_TO_KEY,
  TX_FIELDS,
  ACCESS_PASS_METRIC,
  type ApiPartnerResult,
} from "../ow-analytics-map";

describe("parsePartnerMap", () => {
  it("parses slug:uuid pairs and rejects unknown slugs", () => {
    const { byUuid, warnings } = parsePartnerMap("gopay:u1, dialog:u2 ,bogus:u3");
    expect(byUuid.get("u1")).toBe("gopay");
    expect(byUuid.get("u2")).toBe("dialog");
    expect(byUuid.has("u3")).toBe(false);
    expect(warnings.some((w) => w.includes("bogus"))).toBe(true);
  });
  it("returns empty + warning for undefined/blank", () => {
    expect(parsePartnerMap(undefined).byUuid.size).toBe(0);
    expect(parsePartnerMap("").warnings.length).toBeGreaterThan(0);
  });
  it("warns on malformed entries", () => {
    const { byUuid, warnings } = parsePartnerMap("gopay:u1,garbage");
    expect(byUuid.size).toBe(1);
    expect(warnings.some((w) => w.includes("garbage"))).toBe(true);
  });
});

describe("buildMetricRequestList", () => {
  it("includes 23 core keys, the access-pass tx key, and tx.<type>.<field>", () => {
    const list = buildMetricRequestList(["purchase"], TX_FIELDS);
    expect(Object.keys(API_CORE_TO_KEY).every((k) => list.includes(k))).toBe(true);
    expect(list).toContain(ACCESS_PASS_METRIC);
    expect(list).toContain("tx.purchase.amount");
    expect(list).toContain("tx.purchase.count");
    expect(new Set(list).size).toBe(list.length); // deduped
  });
});

describe("mapResultsToRows", () => {
  const byUuid = new Map([["u1", "gopay" as const]]);
  const results: ApiPartnerResult[] = [
    {
      partner_id: "u1",
      telco_name: "GoPay",
      series: [
        {
          date: "2026-05-12",
          metrics: {
            dau: 100,
            total_bnry_tokens_earned: 5000000000, // > Int32
            avg_time_spent_seconds: 42.7,
            "tx.use_pass.unique_users": 12,
            "tx.purchase.amount": 900,
            unique_users: null,
          },
        },
      ],
    },
  ];
  it("maps core metrics, rounds durations, buckets by partner_id", () => {
    const { rows } = mapResultsToRows(results, byUuid);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.telco).toBe("gopay");
    expect(rows[0]!.values.dauCrm).toBe(100);
    expect(rows[0]!.values.bnryEarned).toBe(5000000000);
    expect(rows[0]!.values.avgSessionSec).toBe(43); // rounded
    expect(rows[0]!.values.accessPassUsers).toBe(12); // from tx.use_pass.unique_users
    expect(rows[0]!.values.stwWins).toBeUndefined(); // no source
  });
  it("captures tx.* into txMetrics and skips null values", () => {
    const { rows } = mapResultsToRows(results, byUuid);
    expect(rows[0]!.txMetrics!["tx.purchase.amount"]).toBe(900);
    expect(rows[0]!.values.uniqueUsers).toBeUndefined(); // null skipped
    expect(rows[0]!.sourceTab).toBe("analytics-api");
    expect(rows[0]!.isIntraday).toBe(false);
  });
  it("warns and skips a partner_id not in the map", () => {
    const { rows, warnings } = mapResultsToRows(
      [{ ...results[0]!, partner_id: "unknown" }],
      byUuid,
    );
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("unknown"))).toBe(true);
  });
});

describe("synthesizeRawTabs", () => {
  it("produces one grid per telco with a date column", () => {
    const results: ApiPartnerResult[] = [
      { partner_id: "u1", telco_name: "GoPay",
        series: [{ date: "2026-05-12", metrics: { dau: 100 } }] },
    ];
    const { rows } = mapResultsToRows(results, new Map([["u1", "gopay" as const]]));
    const tabs = synthesizeRawTabs(rows);
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.telco).toBe("gopay");
    expect(tabs[0]!.headers[0]).toBe("date");
    expect(tabs[0]!.rows[0]![0]).toBe("2026-05-12");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @nexora/api test ow-analytics-map`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `ow-analytics-map.ts`**

```ts
// Pure mapping between the TBH Analytics API (POST /v1/metrics/query) and
// the OneWave OwMetricRow contract. No I/O — unit tested.
import { OW_TELCOS, type OwMetricKey, type OwTelco } from "@/modules/marketing/ow-aliases";
import type { OwMetricRow, OwRawTab } from "@/modules/marketing/ow-ingest.service";

export interface ApiMetricPoint {
  date: string;
  metrics: Record<string, number | null>;
}
export interface ApiPartnerResult {
  partner_id: string;
  telco_name: string | null;
  series: ApiMetricPoint[];
}
export interface ApiQueryResponse {
  date_from: string;
  date_to: string;
  results: ApiPartnerResult[];
}

// API core metric name → OwDailyMetric column key. 23 entries = every core
// metric the API exposes. stwWins + accessPassUsers are NOT core (see below).
export const API_CORE_TO_KEY: Record<string, OwMetricKey> = {
  total_views_homepage: "homepageViews",
  dau: "dauCrm",
  dau_ga: "dauGa",
  mau_ga: "mauRolling30",
  mau: "mauNexus",
  unique_users: "uniqueUsers",
  new_users: "newUsers",
  new_users_ga: "newUsersGa",
  repeated_users: "repeatUsers",
  repeated_users_ga: "repeatUsersGa",
  sessions_ga: "sessionsGa",
  avg_time_spent_seconds: "avgSessionSec",
  total_user_games: "clicksBnryGames",
  total_credit: "totalCredit",
  total_debit: "totalDebit",
  total_transactions: "totalTransactions",
  total_spin_usage: "spinUsage",
  total_spin_win_tokens: "spinWinTokens",
  unique_spin_users: "uniqueSpinUsers",
  total_user_fando: "usersFando",
  total_user_ngage: "usersNgage",
  total_bnry_tokens_earned: "bnryEarned",
  total_bnry_tokens_spent: "bnryRedeemed",
};

// Duration metrics arrive as floats; store rounded ints.
const ROUND_KEYS: Set<OwMetricKey> = new Set(["avgSessionSec"]);

// Columns persisted as BigInt (values can exceed Int32); Task 4 coerces.
export const AMOUNT_KEYS: Set<OwMetricKey> = new Set([
  "bnryEarned",
  "bnryRedeemed",
  "totalCredit",
  "totalDebit",
  "spinWinTokens",
]);

// accessPassUsers is a tx.* metric, not a core column.
export const ACCESS_PASS_METRIC = "tx.use_pass.unique_users";

export const TX_FIELDS = ["count", "amount", "unique_users"] as const;

// Used when the catalog fetch fails — a curated subset that always exists.
export const FALLBACK_TX_TYPES = [
  "PURCHASE",
  "MEMBERSHIP_PURCHASE",
  "QUEST_REWARD",
  "SPIN_REWARD",
  "ONLINE_REWARD",
  "USE_PASS",
];

const TELCO_SET = new Set<string>(OW_TELCOS);

/** Parse `slug:uuid,slug:uuid` → uuid→slug map. Unknown slugs + malformed entries warn. */
export function parsePartnerMap(raw: string | undefined): {
  byUuid: Map<string, OwTelco>;
  warnings: string[];
} {
  const byUuid = new Map<string, OwTelco>();
  const warnings: string[] = [];
  const trimmed = raw?.trim();
  if (!trimmed) {
    warnings.push("MARKETING_ANALYTICS_PARTNER_IDS is empty/unset");
    return { byUuid, warnings };
  }
  for (const part of trimmed.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const idx = entry.indexOf(":");
    if (idx <= 0) {
      warnings.push(`partner entry not slug:uuid — "${entry}"`);
      continue;
    }
    const slug = entry.slice(0, idx).trim().toLowerCase();
    const uuid = entry.slice(idx + 1).trim();
    if (!uuid) {
      warnings.push(`partner entry missing uuid — "${entry}"`);
      continue;
    }
    if (!TELCO_SET.has(slug)) {
      warnings.push(`unknown telco slug "${slug}" (skipped)`);
      continue;
    }
    byUuid.set(uuid, slug as OwTelco);
  }
  return { byUuid, warnings };
}

/** Full `metrics` request list: 23 core + access-pass + tx.<type>.<field>, deduped. */
export function buildMetricRequestList(
  txTypes: string[],
  txFields: readonly string[],
): string[] {
  const out = new Set<string>(Object.keys(API_CORE_TO_KEY));
  out.add(ACCESS_PASS_METRIC);
  for (const t of txTypes) {
    for (const f of txFields) out.add(`tx.${t}.${f}`);
  }
  return [...out];
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Map API results → OwMetricRow[], bucketing by partner_id via the env map. */
export function mapResultsToRows(
  results: ApiPartnerResult[],
  byUuid: Map<string, OwTelco>,
): { rows: OwMetricRow[]; warnings: string[] } {
  const rows: OwMetricRow[] = [];
  const warnings: string[] = [];
  for (const result of results) {
    const telco = byUuid.get(result.partner_id);
    if (!telco) {
      warnings.push(`result partner_id "${result.partner_id}" not in partner map (skipped)`);
      continue;
    }
    for (const point of result.series ?? []) {
      const values: Partial<Record<OwMetricKey, number>> = {};
      const txMetrics: Record<string, number> = {};
      for (const [apiName, rawVal] of Object.entries(point.metrics ?? {})) {
        const v = num(rawVal);
        if (v == null) continue;
        if (apiName === ACCESS_PASS_METRIC) values.accessPassUsers = v;
        if (apiName.startsWith("tx.")) {
          txMetrics[apiName] = v;
          continue;
        }
        const key = API_CORE_TO_KEY[apiName];
        if (!key) continue;
        values[key] = ROUND_KEYS.has(key) ? Math.round(v) : v;
      }
      rows.push({
        date: point.date,
        telco,
        values,
        txMetrics: Object.keys(txMetrics).length ? txMetrics : undefined,
        isIntraday: false,
        sourceTab: "analytics-api",
      });
    }
  }
  return { rows, warnings };
}

/** One raw grid per telco (headers = date + column keys) for the existing dashboard. */
export function synthesizeRawTabs(rows: OwMetricRow[]): OwRawTab[] {
  const cols = Object.values(API_CORE_TO_KEY);
  const byTelco = new Map<OwTelco, OwMetricRow[]>();
  for (const r of rows) {
    const list = byTelco.get(r.telco) ?? [];
    list.push(r);
    byTelco.set(r.telco, list);
  }
  const tabs: OwRawTab[] = [];
  for (const [telco, list] of byTelco) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    tabs.push({
      title: telco,
      telco,
      headers: ["date", ...cols],
      rows: list.map((r) => [
        r.date,
        ...cols.map((c) => {
          const v = r.values[c];
          return v == null ? "" : String(v);
        }),
      ]),
    });
  }
  return tabs;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @nexora/api test ow-analytics-map`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/marketing/ow-analytics-map.ts apps/api/src/modules/marketing/ow-aliases.ts apps/api/src/modules/marketing/ow-ingest.service.ts apps/api/src/modules/marketing/__tests__/ow-analytics-map.test.ts
git commit -m "feat(marketing): pure analytics-api → OwMetricRow mapping"
```

**Note on `ow-aliases.ts` import:** `OwMetricKey` and `OwTelco` are already exported from `ow-aliases.ts` alongside `OW_TELCOS` — the single import line in Step 4 covers all three. Do not add a second import from a different path.

---

### Task 3: Orchestration `ow-analytics-api.service.ts`

**Files:**
- Create: `apps/api/src/modules/marketing/ow-analytics-api.service.ts`
- Test: `apps/api/src/modules/marketing/__tests__/ow-analytics-api.test.ts`

**Interfaces:**
- Consumes: everything Produced by Task 2; `OwIngestResult` from `ow-ingest.service.ts`; `logger`.
- Produces:
  - `isAnalyticsApiConfigured(): boolean`
  - `ingestAnalyticsApi(): Promise<OwIngestResult>` (best-effort; never throws)
  - `chunk<T>(arr: T[], size: number): T[][]` (exported for test)

- [ ] **Step 1: Write failing tests (fetch mocked)**

Create `__tests__/ow-analytics-api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chunk, ingestAnalyticsApi, isAnalyticsApiConfigured } from "../ow-analytics-api.service";

const CATALOG = {
  core_metrics: [],
  transaction_type_pattern: "tx.<transaction_type>.<field>",
  transaction_type_fields: ["count", "amount", "unique_users"],
  known_transaction_types: ["purchase", "use_pass"],
};
const QUERY = {
  date_from: "2026-05-12",
  date_to: "2026-05-12",
  results: [
    { partner_id: "u1", telco_name: "GoPay", series: [{ date: "2026-05-12", metrics: { dau: 100 } }] },
  ],
};

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (String(url).includes("/catalog")) {
      return { ok: true, json: async () => CATALOG } as unknown as Response;
    }
    return { ok: true, json: async () => QUERY } as unknown as Response;
  });
}

describe("chunk", () => {
  it("splits into <=size groups preserving order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("isAnalyticsApiConfigured", () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });
  it("true only when url + a valid partner map are set", () => {
    process.env.MARKETING_ANALYTICS_API_URL = "https://x";
    process.env.MARKETING_ANALYTICS_PARTNER_IDS = "gopay:u1";
    expect(isAnalyticsApiConfigured()).toBe(true);
    delete process.env.MARKETING_ANALYTICS_API_URL;
    expect(isAnalyticsApiConfigured()).toBe(false);
  });
});

describe("ingestAnalyticsApi", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.MARKETING_ANALYTICS_API_URL = "https://x";
    process.env.MARKETING_ANALYTICS_PARTNER_IDS = "gopay:u1";
    process.env.MARKETING_ANALYTICS_BACKFILL_FROM = "2026-05-12";
  });
  afterEach(() => { process.env = { ...OLD }; vi.restoreAllMocks(); });

  it("returns normalized rows + synthesized rawTabs", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const res = await ingestAnalyticsApi();
    expect(res.metrics).toHaveLength(1);
    expect(res.metrics[0]!.telco).toBe("gopay");
    expect(res.metrics[0]!.values.dauCrm).toBe(100);
    expect(res.rawTabs).toHaveLength(1);
  });

  it("never throws — a failed fetch yields an empty result + warning", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    const res = await ingestAnalyticsApi();
    expect(res.metrics).toHaveLength(0);
    expect(res.warnings.some((w) => w.toLowerCase().includes("boom") || w.toLowerCase().includes("failed"))).toBe(true);
  });

  it("falls back to FALLBACK_TX_TYPES when the catalog call fails", async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).includes("/catalog")) return { ok: false, status: 500 } as unknown as Response;
      return { ok: true, json: async () => QUERY } as unknown as Response;
    });
    vi.stubGlobal("fetch", f);
    const res = await ingestAnalyticsApi();
    expect(res.metrics).toHaveLength(1); // query still ran
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @nexora/api test ow-analytics-api`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `ow-analytics-api.service.ts`**

```ts
// TBH Analytics API ("Rahul API") ingester. Best-effort: unconfigured or a
// flaky read yields an empty/partial OwIngestResult — never throws to the
// caller (mirrors ingestSheet). Produces the same contract so refreshSnapshot
// is source-agnostic.
import { logger } from "@/common/utils/logger";
import { OW_TELCOS } from "@/modules/marketing/ow-aliases";
import type { OwIngestResult, OwMetricRow } from "@/modules/marketing/ow-ingest.service";
import {
  buildMetricRequestList,
  FALLBACK_TX_TYPES,
  mapResultsToRows,
  parsePartnerMap,
  synthesizeRawTabs,
  TX_FIELDS,
  type ApiQueryResponse,
} from "@/modules/marketing/ow-analytics-map";

const QUERY_PATH = "/v1/metrics/query";
const CATALOG_PATH = "/v1/metrics/catalog";
const PARTNER_CHUNK = 10;
const FETCH_TIMEOUT_MS = 20_000;

function baseUrl(): string | null {
  const raw = process.env.MARKETING_ANALYTICS_API_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function backfillFrom(): string {
  return process.env.MARKETING_ANALYTICS_BACKFILL_FROM?.trim() || "2026-05-01";
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isAnalyticsApiConfigured(): boolean {
  if (!baseUrl()) return false;
  return parsePartnerMap(process.env.MARKETING_ANALYTICS_PARTNER_IDS).byUuid.size > 0;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTxTypes(base: string): Promise<string[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${CATALOG_PATH}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
      const cat = (await res.json()) as { known_transaction_types?: string[] };
      const types = cat.known_transaction_types;
      return Array.isArray(types) && types.length ? types : FALLBACK_TX_TYPES;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn(
      `OW analytics catalog fetch failed, using fallback tx types: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return FALLBACK_TX_TYPES;
  }
}

export async function ingestAnalyticsApi(): Promise<OwIngestResult> {
  const fetchedAt = new Date().toISOString();
  const empty: OwIngestResult = {
    metrics: [],
    rawTabs: [],
    telcos: [...OW_TELCOS],
    warnings: [],
    fetchedAt,
  };

  const base = baseUrl();
  if (!base) return { ...empty, warnings: ["MARKETING_ANALYTICS_API_URL not set"] };

  const { byUuid, warnings } = parsePartnerMap(process.env.MARKETING_ANALYTICS_PARTNER_IDS);
  if (byUuid.size === 0) return { ...empty, warnings };

  try {
    const txTypes = await fetchTxTypes(base);
    const metricsReq = buildMetricRequestList(txTypes, TX_FIELDS);
    const uuids = [...byUuid.keys()];
    const date_from = backfillFrom();
    const date_to = todayUtc();

    const allRows: OwMetricRow[] = [];
    for (const group of chunk(uuids, PARTNER_CHUNK)) {
      const resp = await postJson<ApiQueryResponse>(`${base}${QUERY_PATH}`, {
        partner_ids: group,
        date_from,
        date_to,
        metrics: metricsReq,
      });
      const mapped = mapResultsToRows(resp.results ?? [], byUuid);
      allRows.push(...mapped.rows);
      warnings.push(...mapped.warnings);
    }

    return {
      metrics: allRows,
      rawTabs: synthesizeRawTabs(allRows),
      telcos: [...OW_TELCOS],
      warnings,
      fetchedAt,
    };
  } catch (err) {
    logger.error(
      `OW analytics API ingest failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      ...empty,
      warnings: [
        ...warnings,
        `analytics API read failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @nexora/api test ow-analytics-api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/marketing/ow-analytics-api.service.ts apps/api/src/modules/marketing/__tests__/ow-analytics-api.test.ts
git commit -m "feat(marketing): analytics-api ingest orchestration (catalog + chunked query)"
```

---

### Task 4: Repository — persist new columns + `txMetrics` + BigInt

**Files:**
- Modify: `apps/api/src/modules/marketing/marketing.repository.ts` (`upsertDailyMetrics`, ~line 101; top import ~line 1)
- Test: `apps/api/src/modules/marketing/__tests__/ow-upsert-shape.test.ts`

**Interfaces:**
- Consumes: `AMOUNT_KEYS`, `OwMetricKey` (Task 2); `OwMetricRow.txMetrics`.
- Produces: `buildMetricUpdateData(row)` (exported pure helper returning a Prisma column payload — bigint amounts, int counts, optional `txMetrics`; unit-tested without a DB).

- [ ] **Step 1: Write a failing test for the pure column-builder**

Create `__tests__/ow-upsert-shape.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMetricUpdateData } from "../marketing.repository";

describe("buildMetricUpdateData", () => {
  it("coerces amount keys to bigint, counts to int, and carries txMetrics", () => {
    const data = buildMetricUpdateData({
      date: new Date("2026-05-12T00:00:00.000Z"),
      telco: "gopay",
      values: { dauCrm: 100, bnryEarned: 5000000000, avgSessionSec: 43 },
      txMetrics: { "tx.purchase.amount": 900 },
      isIntraday: false,
      sourceTab: "analytics-api",
    });
    expect(data.dauCrm).toBe(100);
    expect(typeof data.bnryEarned).toBe("bigint");
    expect(data.bnryEarned).toBe(5000000000n);
    expect(data.sourceTab).toBe("analytics-api");
    expect(data.isIntraday).toBe(false);
    expect(data.txMetrics).toEqual({ "tx.purchase.amount": 900 });
  });
  it("omits txMetrics when absent", () => {
    const data = buildMetricUpdateData({
      date: new Date("2026-05-12T00:00:00.000Z"), telco: "gopay", values: { dauCrm: 1 },
      isIntraday: false, sourceTab: "analytics-api",
    });
    expect("txMetrics" in data).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexora/api test ow-upsert-shape`
Expected: FAIL (`buildMetricUpdateData` not exported).

- [ ] **Step 3: Implement the builder + rewire `upsertDailyMetrics`**

Change the top import from `import type { Prisma }` to a value import (needed for enums/types at runtime is not required here, but keep the type import; add the new imports):

```ts
import type { Prisma } from "@nexora/database";
import { prisma } from "@/infrastructure/database/prisma";
import type { OwMetricKey } from "@/modules/marketing/ow-aliases";
import { AMOUNT_KEYS } from "@/modules/marketing/ow-analytics-map";
```

Add the exported helper (module scope, above the class):

```ts
type MetricRowInput = {
  date: Date;
  telco: string;
  values: Record<string, number>;
  txMetrics?: Record<string, number>;
  isIntraday: boolean;
  sourceTab: string;
};

// Build the Prisma column payload: amount keys → bigint, counts → int,
// txMetrics → JSON (omitted when absent). Pure — unit tested.
export function buildMetricUpdateData(row: MetricRowInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    isIntraday: row.isIntraday,
    sourceTab: row.sourceTab,
  };
  for (const [k, v] of Object.entries(row.values)) {
    if (v == null) continue;
    const key = k as OwMetricKey;
    data[key] = AMOUNT_KEYS.has(key) ? BigInt(Math.round(v)) : Math.round(v);
  }
  if (row.txMetrics && Object.keys(row.txMetrics).length) {
    data.txMetrics = row.txMetrics;
  }
  return data;
}
```

Replace the `upsertDailyMetrics` body:

```ts
  async upsertDailyMetrics(
    rows: Array<{
      date: Date;
      telco: string;
      values: Record<string, number>;
      txMetrics?: Record<string, number>;
      isIntraday: boolean;
      sourceTab: string;
    }>,
  ) {
    let count = 0;
    for (const r of rows) {
      const data = buildMetricUpdateData(r);
      await prisma.owDailyMetric.upsert({
        where: { date_telco: { date: r.date, telco: r.telco } },
        create: { date: r.date, telco: r.telco, ...data } as Prisma.OwDailyMetricUncheckedCreateInput,
        update: { ...data } as Prisma.OwDailyMetricUncheckedUpdateInput,
      });
      count++;
    }
    return count;
  }
```

- [ ] **Step 4: Run tests + type-check**

Run: `pnpm --filter @nexora/api test ow-upsert-shape && pnpm --filter @nexora/api type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/marketing/marketing.repository.ts apps/api/src/modules/marketing/__tests__/ow-upsert-shape.test.ts
git commit -m "feat(marketing): persist expanded metrics + txMetrics with bigint coercion"
```

---

### Task 5: Service — source selection + API-source traction

**Files:**
- Modify: `apps/api/src/modules/marketing/marketing.service.ts` (imports ~line 17; `getTraction` ~line 60; `refreshSnapshot` ~line 174)
- Test: `apps/api/src/modules/marketing/__tests__/ow-source-selection.test.ts`

**Interfaces:**
- Consumes: `isAnalyticsApiConfigured`, `ingestAnalyticsApi` (Task 3); `ingestSheet` (existing); `marketingRepository.getLatestSnapshot`.
- Produces: `pickIngestSource(): "api" | "sheet"` (exported pure selector, unit-tested).

- [ ] **Step 1: Write a failing test for the selector**

Create `__tests__/ow-source-selection.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { pickIngestSource } from "../marketing.service";

describe("pickIngestSource", () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });
  it("chooses 'api' when the analytics API is configured", () => {
    process.env.MARKETING_ANALYTICS_API_URL = "https://x";
    process.env.MARKETING_ANALYTICS_PARTNER_IDS = "gopay:u1";
    expect(pickIngestSource()).toBe("api");
  });
  it("falls back to 'sheet' when the API url is unset", () => {
    delete process.env.MARKETING_ANALYTICS_API_URL;
    expect(pickIngestSource()).toBe("sheet");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexora/api test ow-source-selection`
Expected: FAIL (`pickIngestSource` not exported).

- [ ] **Step 3: Add imports + selector**

Add near the existing imports (below the `ingestSheet` import):

```ts
import {
  ingestAnalyticsApi,
  isAnalyticsApiConfigured,
} from "@/modules/marketing/ow-analytics-api.service";
```

Add the exported selector at module scope (near `getTraction`, outside the class):

```ts
export function pickIngestSource(): "api" | "sheet" {
  return isAnalyticsApiConfigured() ? "api" : "sheet";
}
```

- [ ] **Step 4: Wire source selection + thread `txMetrics` in `refreshSnapshot`**

Replace `const ingest = await ingestSheet();` with the source selector:

```ts
    const ingest =
      pickIngestSource() === "api" ? await ingestAnalyticsApi() : await ingestSheet();
```

In the SAME method, the existing `upsertDailyMetrics(...)` map drops `txMetrics`. Update that `.map` callback to carry it (add the one line):

```ts
      await marketingRepository.upsertDailyMetrics(
        ingest.metrics.map((m) => ({
          date: new Date(`${m.date}T00:00:00.000Z`),
          telco: m.telco,
          values: m.values as Record<string, number>,
          txMetrics: m.txMetrics,
          isIntraday: m.isIntraday,
          sourceTab: m.sourceTab,
        })),
      );
```

- [ ] **Step 5: API-source traction (latest-per-telco grid from the snapshot)**

At the very top of `getTraction`, before the `sheetId` check, add:

```ts
  if (isAnalyticsApiConfigured()) {
    return buildApiTraction();
  }
```

Add the helper at module scope (strings only — no BigInt reads):

```ts
async function buildApiTraction(): Promise<TractionData | null> {
  const snap = await marketingRepository.getLatestSnapshot();
  const payload = snap?.payload as
    | { rawTabs?: Array<{ telco: string | null; headers: string[]; rows: string[][] }> }
    | undefined;
  const tabs = payload?.rawTabs ?? [];
  if (tabs.length === 0) return null;
  const headers = ["telco", ...(tabs[0]!.headers ?? [])];
  const rows = tabs.map((t) => {
    const last = t.rows[t.rows.length - 1] ?? [];
    return [t.telco ?? "", ...last];
  });
  return { headers, rows, range: "analytics-api", fetchedAt: new Date().toISOString() };
}
```

- [ ] **Step 6: Run tests + type-check**

Run: `pnpm --filter @nexora/api test ow-source-selection && pnpm --filter @nexora/api type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/marketing/marketing.service.ts apps/api/src/modules/marketing/__tests__/ow-source-selection.test.ts
git commit -m "feat(marketing): select analytics-api source with sheet fallback + api traction"
```

---

### Task 6: Env + deploy wiring

**Files:**
- Modify: `turbo.json` (`globalEnv` — add `MARKETING_ANALYTICS_BACKFILL_FROM`)
- Modify: root `.env.development` (add the three vars)
- Modify: `.github/workflows/deploy.yml` (`nexora-api` `--set-env-vars`)
- Modify: `docs/ENVIRONMENT_MANAGEMENT.md` (document the three vars + `slug:uuid` format)

**Interfaces:**
- Consumes: nothing. Produces: runtime config for Task 3/5.

- [ ] **Step 1: turbo.json**

Add to the `globalEnv` array (next to the two existing `MARKETING_ANALYTICS_*` entries):

```json
    "MARKETING_ANALYTICS_BACKFILL_FROM",
```

- [ ] **Step 2: root `.env.development`**

Append (locally blank so the sheet fallback stays active until you fill real values):

```bash
# TBH Analytics API (Marketing → OW Dashboard). Replaces the OW sheet ingest
# when set. PARTNER_IDS is slug:uuid pairs (slug ∈ gopay|dialog|ryze|telkomsel|okara|myim3|bima|u9).
MARKETING_ANALYTICS_API_URL=
MARKETING_ANALYTICS_PARTNER_IDS=
MARKETING_ANALYTICS_BACKFILL_FROM=2026-05-01
```

- [ ] **Step 3: deploy.yml**

Grep `deploy.yml` for `OW_TRACTION_SHEET_ID` to find the `nexora-api` `--set-env-vars` block, and add (comma-joined, matching the file's existing style):

```
MARKETING_ANALYTICS_API_URL=${{ secrets.MARKETING_ANALYTICS_API_URL }},MARKETING_ANALYTICS_PARTNER_IDS=${{ secrets.MARKETING_ANALYTICS_PARTNER_IDS }},MARKETING_ANALYTICS_BACKFILL_FROM=${{ secrets.MARKETING_ANALYTICS_BACKFILL_FROM }}
```

- [ ] **Step 4: Document**

In `docs/ENVIRONMENT_MANAGEMENT.md`, add a row/paragraph for each of the three vars, noting: unauthenticated API; `PARTNER_IDS` is `slug:uuid`; when `MARKETING_ANALYTICS_API_URL` is set the API replaces the sheet, else the sheet fallback runs; the real telco UUIDs come from the atlas telco/client seed and are set in GitHub Secrets.

- [ ] **Step 5: Verify build config**

Run: `pnpm --filter @nexora/api type-check && pnpm --filter @nexora/api lint`
Expected: PASS (no code depends on these at build time; this is config).

- [ ] **Step 6: Commit**

```bash
git add turbo.json .env.development .github/workflows/deploy.yml docs/ENVIRONMENT_MANAGEMENT.md
git commit -m "chore(marketing): wire analytics-api env vars + deploy secrets"
```

---

## Final verification (after all tasks)

- [ ] `pnpm --filter @nexora/api type-check`
- [ ] `pnpm --filter @nexora/api lint`
- [ ] `pnpm --filter @nexora/api test` (all marketing suites green, incl. existing `ow-ingest.test.ts`)
- [ ] Manual smoke (optional, needs real env): set the three vars locally, `GET /api/marketing/holistic-dashboard?fresh=1`, confirm `snapshot.rawTabs` populate per telco and `OwDailyMetric` rows land with `sourceTab="analytics-api"`.

## Deploy-time inputs still needed (not code)

- Real `slug → telco UUID` values for `MARKETING_ANALYTICS_PARTNER_IDS` (atlas telco/client seed) → GitHub Secrets.
- `MARKETING_ANALYTICS_BACKFILL_FROM` = earliest valid data date.
- Add the three secrets to the GitHub repo before the first `main` deploy that expects live data.
