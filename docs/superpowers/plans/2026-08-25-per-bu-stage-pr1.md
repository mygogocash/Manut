# Per-business-unit stage — PR1 (foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every business unit on an opportunity its own stage, probability, value and dates, while the deal-level fields stay correct as an auto-maintained roll-up — with no user-visible change.

**Architecture:** A child table per CRM (`crm_opportunity_business_units`, `revenue_opportunity_business_units`) holds per-unit progress. `Opportunity.businessUnits` stays the source of truth for _which_ units are on a deal; child rows are synced to match it. Deal-level `stage`, `probability`, `value`, `closeDate`, `launchDate`, `revenueLaunchDate` and `lostReason` become derived, recomputed in one place after every write. The comparison logic is a pure function in `crm-shared` shared by both CRMs; each CRM gets a thin I/O adapter.

**Tech Stack:** Prisma 6.19 + PostgreSQL, Express-style service/repository modules under `apps/api/src/modules`, Vitest with a hoisted `prisma` mock.

**Spec:** `docs/superpowers/specs/2026-08-25-per-business-unit-stage-design.md`

## Global Constraints

- **PR1 ships no UI and no API surface change.** Deal-level behaviour must be byte-identical to today. If a reviewer can see a difference in the app, the task is wrong.
- **Migration timestamp must be later than `20261225000000`.** Use `20261226000000`. Both `dev` and `main` already hold a `20261225000000_*` folder (`retire_aria_business_unit` and `mkt_campaigns_archived_at` respectively) — do not add a third at that stamp.
- **Staging never executes migration SQL.** `deploy-staging.yml` runs `pnpm db:push:staging` (`prisma db push --accept-data-loss`), which reconciles the schema only. Any INSERT that lives only in a migration will never run on staging. The backfill therefore lives in **code**, not in the migration. This is the same hole that once made the Investor board render zero columns.
- **All SQL idempotent:** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
- **`businessUnit` carries no foreign key** to `crm_business_units`, matching how `Opportunity.businessUnits` already references `CrmBusinessUnit.code`. Deleting a unit must never cascade into history.
- **Currency stays deal-level.** The child row has `value` but no `currency`; every child value is denominated in `Opportunity.currency`.
- **Active BU codes are `onewave` and `onewave-revenue`.** `aria` was deactivated by `20261225000000_retire_aria_business_unit` — it is still a valid stored tag, so code must handle it, but do not use it in fixtures as if it were live.
- **Money is summed with `Prisma.Decimal`, never JS floats.** The column is `DECIMAL(15,2)`; the existing float arithmetic in `opportunities.service.ts` `forecast()` is read-only display and is not the pattern to copy for a value written back to the database.
- **The stage order must fall back to code, never trust the table alone.** `opportunity_stage_config` is populated by migration SQL (`20260630000000_opportunity_stage_config`) and nothing calls `ensureCatalogSeeded` for it, so on staging the table can be **empty**. Build the sort-order map from the database when it has rows and from `OPPORTUNITY_STAGES` in `modules/opportunities/opportunities.constants.ts` when it does not. An empty map would rank every stage as unknown and make the roll-up meaningless.
- **Line length:** 300 for config, 1200 for application source (`scripts/check-line-length.sh`).
- Every task ends green on `npx prettier --check`, `npx eslint`, and the touched package's `npx tsc --noEmit`.

---

## File Structure

**Create**

| File                                                                                               | Responsibility                                                                                      |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/crm-shared/opportunity-rollup.ts`                                            | Pure roll-up computation. No Prisma client, no I/O. Shared by both CRMs so the mirror cannot drift. |
| `apps/api/src/modules/crm-shared/opportunity-rollup.test.ts`                                       | Unit tests for every roll-up rule, with no mocks.                                                   |
| `apps/api/src/modules/opportunities/opportunity-business-units.repository.ts`                      | Sales CRM I/O: read children, sync children to the tag array, write the roll-up back.               |
| `apps/api/src/modules/opportunities/opportunity-business-units.test.ts`                            | Sales CRM adapter tests against the hoisted Prisma mock.                                            |
| `apps/api/src/modules/revenue-opportunities/opportunity-business-units.repository.ts`              | Revenue CRM mirror of the above.                                                                    |
| `apps/api/src/modules/revenue-opportunities/opportunity-business-units.test.ts`                    | Revenue CRM adapter tests.                                                                          |
| `packages/database/prisma/migrations/20261226000000_opportunity_business_unit_stage/migration.sql` | Creates both tables and their indexes. No data.                                                     |

**Modify**

| File                                                                  | Change                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/database/prisma/schema/sales-crm.prisma`                    | Add `OpportunityBusinessUnit` model + `businessUnitProgress` relation on `Opportunity`. |
| `packages/database/prisma/schema/sales-revenue-crm.prisma`            | Add `RevenueOpportunityBusinessUnit` model + relation on `RevenueOpportunity`.          |
| `apps/api/src/modules/opportunities/opportunities.service.ts`         | Call sync + recompute after create, update and the `closed_lost` path.                  |
| `apps/api/src/modules/revenue-opportunities/opportunities.service.ts` | Same.                                                                                   |

**Deliberately untouched in PR1:** every controller, every validation schema, all of `apps/web`, and `crm-reminders.ts`. Reminders become per-BU in PR3.

---

### Task 1: Pure roll-up computation

The heart of the feature. Written first because it has no dependencies and every later task consumes it.

**Files:**

- Create: `apps/api/src/modules/crm-shared/opportunity-rollup.ts`
- Test: `apps/api/src/modules/crm-shared/opportunity-rollup.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `computeOpportunityRollup(children, stageSortOrder, tagOrder): OpportunityRollup | null`, plus the exported types `BusinessUnitProgress` and `OpportunityRollup`. **Returning `null` means "no child rows — caller must keep the deal's stored values untouched."** Tasks 4 and 5 rely on that contract.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/crm-shared/opportunity-rollup.test.ts
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "@/modules/crm-shared/opportunity-rollup";

// Mirrors the seeded catalog: qualified → proposal → negotiation →
// closed_won → live, with closed_lost parked at the end.
const STAGE_ORDER = new Map([
  ["qualified", 10],
  ["proposal", 20],
  ["negotiation", 30],
  ["closed_won", 40],
  ["live", 50],
  ["closed_lost", 60],
]);

const unit = (
  over: Partial<BusinessUnitProgress> & { businessUnit: string },
): BusinessUnitProgress => ({
  stage: "qualified",
  probability: 20,
  value: new Prisma.Decimal(0),
  closeDate: null,
  launchDate: null,
  revenueLaunchDate: null,
  lostReason: null,
  ...over,
});

describe("computeOpportunityRollup", () => {
  it("returns null when the deal has no business units", () => {
    // The caller must then leave the stored values alone. Rolling up to
    // defaults here would silently reset every untagged deal to
    // qualified / 0 on its first write.
    expect(computeOpportunityRollup([], STAGE_ORDER, [])).toBeNull();
  });

  it("takes the stage of the least-advanced unit", () => {
    // The reported case: Onewave is Live, Onewave Revenue is still at
    // Proposal. The deal must not read as Live.
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "onewave", stage: "live", probability: 100 }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          probability: 40,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.stage).toBe("proposal");
    expect(result?.probability).toBe(40);
  });

  it("breaks ties on tag-array order", () => {
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave-revenue",
          stage: "proposal",
          probability: 45,
        }),
        unit({ businessUnit: "onewave", stage: "proposal", probability: 35 }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.probability).toBe(35);
  });

  it("treats a stage missing from the catalog as least advanced", () => {
    // An admin deleted the stage out from under the row. Claiming
    // progress we cannot verify is worse than surfacing the bad data.
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "onewave", stage: "live" }),
        unit({ businessUnit: "onewave-revenue", stage: "ghost-stage" }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.stage).toBe("ghost-stage");
  });

  it("sums value across units without float drift", () => {
    const result = computeOpportunityRollup(
      [
        unit({ businessUnit: "onewave", value: new Prisma.Decimal("0.10") }),
        unit({
          businessUnit: "onewave-revenue",
          value: new Prisma.Decimal("0.20"),
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    expect(result?.value.toFixed(2)).toBe("0.30");
  });

  it("takes the latest close date and the earliest launch dates", () => {
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          closeDate: new Date("2026-01-31"),
          launchDate: new Date("2026-03-01"),
          revenueLaunchDate: new Date("2026-04-01"),
        }),
        unit({
          businessUnit: "onewave-revenue",
          closeDate: new Date("2026-06-30"),
          launchDate: new Date("2026-02-01"),
          revenueLaunchDate: null,
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );

    // Contractually done when the LAST unit closes; "first go-live" for
    // the launch dates, ignoring nulls.
    expect(result?.closeDate).toEqual(new Date("2026-06-30"));
    expect(result?.launchDate).toEqual(new Date("2026-02-01"));
    expect(result?.revenueLaunchDate).toEqual(new Date("2026-04-01"));
  });

  it("only marks the deal lost when every unit is lost", () => {
    const partial = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "closed_lost",
          lostReason: "price",
        }),
        unit({ businessUnit: "onewave-revenue", stage: "negotiation" }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );
    expect(partial?.lostReason).toBeNull();

    const all = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "closed_lost",
          lostReason: "price",
        }),
        unit({
          businessUnit: "onewave-revenue",
          stage: "closed_lost",
          lostReason: "timing",
        }),
      ],
      STAGE_ORDER,
      ["onewave", "onewave-revenue"],
    );
    // First reason in tag order wins, so the value is stable across runs.
    expect(all?.lostReason).toBe("price");
  });

  it("rolls a single-unit deal up to exactly that unit", () => {
    const result = computeOpportunityRollup(
      [
        unit({
          businessUnit: "onewave",
          stage: "negotiation",
          probability: 60,
          value: new Prisma.Decimal("40000.00"),
          closeDate: new Date("2026-05-05"),
        }),
      ],
      STAGE_ORDER,
      ["onewave"],
    );

    expect(result).toEqual({
      stage: "negotiation",
      probability: 60,
      value: new Prisma.Decimal("40000.00"),
      closeDate: new Date("2026-05-05"),
      launchDate: null,
      revenueLaunchDate: null,
      lostReason: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx vitest run src/modules/crm-shared/opportunity-rollup.test.ts`

Expected: FAIL — `Failed to resolve import "@/modules/crm-shared/opportunity-rollup"`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/modules/crm-shared/opportunity-rollup.ts
import { Prisma } from "@prisma/client";

/**
 * One business unit's progress on a deal. Mirrors a row of
 * `crm_opportunity_business_units` / `revenue_opportunity_business_units`,
 * narrowed to the fields the roll-up reads.
 *
 * No `currency`: a deal has exactly one currency and every unit's `value`
 * is denominated in it. Summing across currencies would produce a total
 * that means nothing, and Sales CRM v2 has no FX by design.
 */
export interface BusinessUnitProgress {
  businessUnit: string;
  stage: string;
  probability: number;
  value: Prisma.Decimal;
  closeDate: Date | null;
  launchDate: Date | null;
  revenueLaunchDate: Date | null;
  lostReason: string | null;
}

/** The deal-level fields derived from the units. */
export interface OpportunityRollup {
  stage: string;
  probability: number;
  value: Prisma.Decimal;
  closeDate: Date | null;
  launchDate: Date | null;
  revenueLaunchDate: Date | null;
  lostReason: string | null;
}

const LOST_STAGE = "closed_lost";

/**
 * A stage the catalog no longer knows sorts FIRST, i.e. least advanced.
 * The alternative — treating it as most advanced — would let a row whose
 * stage an admin deleted quietly stop holding the deal back.
 */
const UNKNOWN_STAGE_ORDER = -1;

/**
 * Derive the deal-level fields from its business units.
 *
 * Returns `null` when the deal has no units. Callers MUST then leave the
 * deal's stored values untouched: rolling up to defaults would silently
 * reset every untagged deal to `qualified` / 0.
 *
 * @param tagOrder `Opportunity.businessUnits`, used to break ties
 *   deterministically so repeated recomputes cannot flap.
 */
export function computeOpportunityRollup(
  children: readonly BusinessUnitProgress[],
  stageSortOrder: ReadonlyMap<string, number>,
  tagOrder: readonly string[],
): OpportunityRollup | null {
  if (children.length === 0) return null;

  const rank = (row: BusinessUnitProgress) => {
    const stage = stageSortOrder.get(row.stage) ?? UNKNOWN_STAGE_ORDER;
    const tag = tagOrder.indexOf(row.businessUnit);
    return { stage, tag: tag === -1 ? Number.MAX_SAFE_INTEGER : tag };
  };

  const leastAdvanced = children.reduce((best, row) => {
    const a = rank(row);
    const b = rank(best);
    if (a.stage !== b.stage) return a.stage < b.stage ? row : best;
    return a.tag < b.tag ? row : best;
  });

  const value = children.reduce(
    (sum, row) => sum.add(row.value),
    new Prisma.Decimal(0),
  );

  const dates = (pick: (row: BusinessUnitProgress) => Date | null) =>
    children.map(pick).filter((d): d is Date => d !== null);

  const closeDates = dates((r) => r.closeDate);
  const launchDates = dates((r) => r.launchDate);
  const revenueLaunchDates = dates((r) => r.revenueLaunchDate);

  const max = (ds: Date[]) =>
    ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null;
  const min = (ds: Date[]) =>
    ds.length ? new Date(Math.min(...ds.map((d) => d.getTime()))) : null;

  // A single lost unit does not lose the deal. Only when every unit is
  // lost does the deal carry a reason, and it takes the first one in tag
  // order so the result is stable.
  const allLost = children.every((row) => row.stage === LOST_STAGE);
  const lostReason = allLost
    ? ([...children]
        .sort((a, b) => rank(a).tag - rank(b).tag)
        .find((row) => row.lostReason !== null)?.lostReason ?? null)
    : null;

  return {
    stage: leastAdvanced.stage,
    probability: leastAdvanced.probability,
    value,
    closeDate: max(closeDates),
    launchDate: min(launchDates),
    revenueLaunchDate: min(revenueLaunchDates),
    lostReason,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && npx vitest run src/modules/crm-shared/opportunity-rollup.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Lint, format and type-check**

```bash
cd apps/api
npx prettier --write src/modules/crm-shared/opportunity-rollup.ts src/modules/crm-shared/opportunity-rollup.test.ts
npx eslint src/modules/crm-shared/opportunity-rollup.ts src/modules/crm-shared/opportunity-rollup.test.ts
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/crm-shared/opportunity-rollup.ts apps/api/src/modules/crm-shared/opportunity-rollup.test.ts
git commit -m "feat(crm): derive a deal's stage from its least-advanced business unit"
```

---

### Task 2: Prisma models for both CRMs

**Files:**

- Modify: `packages/database/prisma/schema/sales-crm.prisma`
- Modify: `packages/database/prisma/schema/sales-revenue-crm.prisma`

**Interfaces:**

- Consumes: nothing.
- Produces: Prisma delegates `prisma.opportunityBusinessUnit` and `prisma.revenueOpportunityBusinessUnit`, and the relation fields `Opportunity.businessUnitProgress` / `RevenueOpportunity.businessUnitProgress`. Tasks 3–5 use these exact names.

- [ ] **Step 1: Add the Sales CRM model**

Append to `packages/database/prisma/schema/sales-crm.prisma`:

```prisma
// One row per (opportunity x business unit). Holds everything that
// describes how far along and how big THAT unit is, so a deal whose units
// disagree — Onewave live while Onewave Revenue is still at proposal —
// can say so. The deal-level fields on Opportunity become a roll-up of
// these rows; see modules/crm-shared/opportunity-rollup.ts.
//
// No `currency`: the deal has one currency and every value here is
// denominated in it. Summing units across currencies would be meaningless
// and v2 has no FX.
model OpportunityBusinessUnit {
  id            String @id @default(cuid())
  opportunityId String @map("opportunity_id")
  // CrmBusinessUnit.code with NO FK, exactly like Opportunity.businessUnits.
  // Deleting a unit must never cascade into history.
  businessUnit String @map("business_unit")

  stage                String    @default("qualified")
  probability          Int       @default(20)
  probabilityCustom    Boolean   @default(false) @map("probability_custom")
  value                Decimal   @default(0) @db.Decimal(15, 2)
  closeDate            DateTime? @map("close_date") @db.Date
  launchDate           DateTime? @map("launch_date") @db.Date
  revenueLaunchDate    DateTime? @map("revenue_launch_date") @db.Date
  lostReason           String?   @map("lost_reason")
  sortOrderWithinStage Int       @default(0) @map("sort_order_within_stage")

  // Per-unit reminder debounce. PR1 only stores these; crm-reminders.ts
  // starts reading them in PR3.
  remindersSent      Json      @default("[]") @map("reminders_sent")
  lastReminderSentAt DateTime? @map("last_reminder_sent_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@unique([opportunityId, businessUnit])
  @@index([businessUnit, stage])
  @@index([stage, sortOrderWithinStage])
  @@map("crm_opportunity_business_units")
}
```

- [ ] **Step 2: Add the relation field to `Opportunity`**

In the same file, inside `model Opportunity`, next to the existing `activities`/`tasks` relations:

```prisma
  businessUnitProgress OpportunityBusinessUnit[]
```

- [ ] **Step 3: Mirror both into the Revenue CRM**

In `packages/database/prisma/schema/sales-revenue-crm.prisma`, add the same model renamed `RevenueOpportunityBusinessUnit`, mapped to `revenue_opportunity_business_units`, relating to `RevenueOpportunity`, and add `businessUnitProgress RevenueOpportunityBusinessUnit[]` to `model RevenueOpportunity`. Copy the comments; the mirror has drifted before and an uncommented twin drifts faster.

- [ ] **Step 4: Generate the client and type-check**

```bash
pnpm db:generate
cd apps/api && npx tsc --noEmit
```

Expected: client regenerates, no type errors.

- [ ] **Step 5: Verify the delegate names are what later tasks expect**

```bash
cd apps/api && node -e "
const { PrismaClient } = require('../../packages/database/src/generated/prisma');
const p = new PrismaClient();
console.log('sales  :', typeof p.opportunityBusinessUnit);
console.log('revenue:', typeof p.revenueOpportunityBusinessUnit);
"
```

Expected: both print `object`. If either prints `undefined`, the model name is wrong and Tasks 4–5 will not compile.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema/
git commit -m "feat(crm): add a per-business-unit progress row to both opportunity models"
```

---

### Task 3: Migration — tables only

**Files:**

- Create: `packages/database/prisma/migrations/20261226000000_opportunity_business_unit_stage/migration.sql`

**Interfaces:**

- Consumes: the models from Task 2.
- Produces: the two tables in production. **No data** — the backfill is Task 6, in code, because staging never runs migration SQL.

- [ ] **Step 1: Write the migration**

```sql
-- Per-business-unit stage: tables only (schema-only, staging applies via db:push).
--
-- Deliberately NO backfill here. deploy-staging.yml runs
-- `prisma db push --accept-data-loss`, which reconciles the SCHEMA and never
-- executes migration SQL, so an INSERT in this file would populate production
-- and silently skip staging. The backfill lives in
-- apps/api/src/modules/opportunities/opportunity-business-units.repository.ts
-- and runs identically in both environments.

CREATE TABLE IF NOT EXISTS "crm_opportunity_business_units" (
  "id" TEXT NOT NULL,
  "opportunity_id" TEXT NOT NULL,
  "business_unit" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'qualified',
  "probability" INTEGER NOT NULL DEFAULT 20,
  "probability_custom" BOOLEAN NOT NULL DEFAULT false,
  "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "close_date" DATE,
  "launch_date" DATE,
  "revenue_launch_date" DATE,
  "lost_reason" TEXT,
  "sort_order_within_stage" INTEGER NOT NULL DEFAULT 0,
  "reminders_sent" JSONB NOT NULL DEFAULT '[]',
  "last_reminder_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_opportunity_business_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_opportunity_business_units_opportunity_id_business_unit_key"
  ON "crm_opportunity_business_units" ("opportunity_id", "business_unit");
CREATE INDEX IF NOT EXISTS "crm_opportunity_business_units_business_unit_stage_idx"
  ON "crm_opportunity_business_units" ("business_unit", "stage");
CREATE INDEX IF NOT EXISTS "crm_opportunity_business_units_stage_sort_idx"
  ON "crm_opportunity_business_units" ("stage", "sort_order_within_stage");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'crm_opportunity_business_units_opportunity_id_fkey'
  ) THEN
    ALTER TABLE "crm_opportunity_business_units"
      ADD CONSTRAINT "crm_opportunity_business_units_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "revenue_opportunity_business_units" (
  "id" TEXT NOT NULL,
  "opportunity_id" TEXT NOT NULL,
  "business_unit" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'qualified',
  "probability" INTEGER NOT NULL DEFAULT 20,
  "probability_custom" BOOLEAN NOT NULL DEFAULT false,
  "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "close_date" DATE,
  "launch_date" DATE,
  "revenue_launch_date" DATE,
  "lost_reason" TEXT,
  "sort_order_within_stage" INTEGER NOT NULL DEFAULT 0,
  "reminders_sent" JSONB NOT NULL DEFAULT '[]',
  "last_reminder_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revenue_opportunity_business_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "revenue_opportunity_business_units_opportunity_id_business_unit_key"
  ON "revenue_opportunity_business_units" ("opportunity_id", "business_unit");
CREATE INDEX IF NOT EXISTS "revenue_opportunity_business_units_business_unit_stage_idx"
  ON "revenue_opportunity_business_units" ("business_unit", "stage");
CREATE INDEX IF NOT EXISTS "revenue_opportunity_business_units_stage_sort_idx"
  ON "revenue_opportunity_business_units" ("stage", "sort_order_within_stage");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'revenue_opportunity_business_units_opportunity_id_fkey'
  ) THEN
    ALTER TABLE "revenue_opportunity_business_units"
      ADD CONSTRAINT "revenue_opportunity_business_units_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "revenue_opportunities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
```

- [ ] **Step 2: Verify the migration matches the schema**

```bash
pnpm db:generate
cd packages/database && npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --exit-code
```

Expected: exit code 0 — no drift between migrations and schema. A non-zero exit means the SQL and the Prisma models disagree; fix the SQL, not the schema.

- [ ] **Step 3: Run it twice against a scratch database**

```bash
cd packages/database
npx prisma migrate deploy
npx prisma migrate deploy
```

Expected: the second run is a no-op. Any error on the second run means the SQL is not idempotent.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/migrations/20261226000000_opportunity_business_unit_stage/
git commit -m "feat(crm): create the per-business-unit progress tables"
```

---

### Task 4: Sales CRM adapter — sync, recompute, backfill

**Files:**

- Create: `apps/api/src/modules/opportunities/opportunity-business-units.repository.ts`
- Test: `apps/api/src/modules/opportunities/opportunity-business-units.test.ts`

**Interfaces:**

- Consumes: `computeOpportunityRollup` from Task 1; the `prisma.opportunityBusinessUnit` delegate from Task 2.
- Produces:
  - `syncBusinessUnitRows(opportunityId, tagOrder, tx?): Promise<void>` — creates rows for newly tagged units at the first stage with value 0, deletes rows for untagged ones.
  - `recomputeOpportunityRollup(opportunityId, tx?): Promise<void>` — the single write point for the derived deal fields.
  - `backfillOpportunityBusinessUnits(): Promise<number>` — idempotent, returns rows inserted.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/opportunities/opportunity-business-units.test.ts
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The adapter is the only place the derived deal fields are written, so
// assert the exact `data` shape reaching prisma.opportunity.update.
const db = vi.hoisted(() => ({
  opportunity: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  opportunityBusinessUnit: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  opportunityStageConfig: { findMany: vi.fn() },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: db }));

const {
  recomputeOpportunityRollup,
  syncBusinessUnitRows,
  backfillOpportunityBusinessUnits,
} =
  await import("@/modules/opportunities/opportunity-business-units.repository");

beforeEach(() => {
  vi.clearAllMocks();
  db.opportunityStageConfig.findMany.mockResolvedValue([
    { key: "qualified", sortOrder: 10, probability: 20 },
    { key: "proposal", sortOrder: 20, probability: 40 },
    { key: "live", sortOrder: 50, probability: 100 },
  ]);
  db.opportunityBusinessUnit.findMany.mockResolvedValue([]);
  db.opportunityBusinessUnit.count.mockResolvedValue(0);
  db.opportunity.findMany.mockResolvedValue([]);
});

describe("recomputeOpportunityRollup", () => {
  it("writes the least-advanced unit's stage onto the deal", async () => {
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp1",
      businessUnits: ["onewave", "onewave-revenue"],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      {
        businessUnit: "onewave",
        stage: "live",
        probability: 100,
        value: new Prisma.Decimal("30000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
      },
      {
        businessUnit: "onewave-revenue",
        stage: "proposal",
        probability: 40,
        value: new Prisma.Decimal("10000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
      },
    ]);

    await recomputeOpportunityRollup("opp1");

    const data = db.opportunity.update.mock.calls[0][0].data;
    expect(data.stage).toBe("proposal");
    expect(data.probability).toBe(40);
    expect(data.value.toFixed(2)).toBe("40000.00");
  });

  it("falls back to the code stage order when the catalog table is empty", async () => {
    // Staging deploys with `db:push`, which creates opportunity_stage_config
    // but never runs the migration INSERT that fills it. Ranking every
    // stage as unknown would make the roll-up pick by tag order alone.
    db.opportunityStageConfig.findMany.mockResolvedValue([]);
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp3",
      businessUnits: ["onewave", "onewave-revenue"],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      {
        businessUnit: "onewave",
        stage: "live",
        probability: 100,
        value: new Prisma.Decimal(0),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
      },
      {
        businessUnit: "onewave-revenue",
        stage: "qualified",
        probability: 20,
        value: new Prisma.Decimal(0),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
      },
    ]);

    await recomputeOpportunityRollup("opp3");

    expect(db.opportunity.update.mock.calls[0][0].data.stage).toBe("qualified");
  });

  it("leaves an untagged deal's stored values alone", async () => {
    // The silent-corruption path: without this guard every deal with no
    // business units resets to qualified / 0 on its first write.
    db.opportunity.findUnique.mockResolvedValue({
      id: "opp2",
      businessUnits: [],
    });
    db.opportunityBusinessUnit.findMany.mockResolvedValue([]);

    await recomputeOpportunityRollup("opp2");

    expect(db.opportunity.update).not.toHaveBeenCalled();
  });
});

describe("syncBusinessUnitRows", () => {
  it("creates a newly tagged unit at the first stage with value 0", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave", "onewave-revenue"]);

    expect(db.opportunityBusinessUnit.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            opportunityId: "opp1",
            businessUnit: "onewave-revenue",
            stage: "qualified",
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it("deletes the row for an untagged unit", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
      { businessUnit: "onewave-revenue" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave"]);

    expect(db.opportunityBusinessUnit.deleteMany).toHaveBeenCalledWith({
      where: {
        opportunityId: "opp1",
        businessUnit: { in: ["onewave-revenue"] },
      },
    });
  });

  it("does nothing when the tags already match", async () => {
    db.opportunityBusinessUnit.findMany.mockResolvedValue([
      { businessUnit: "onewave" },
    ]);

    await syncBusinessUnitRows("opp1", ["onewave"]);

    expect(db.opportunityBusinessUnit.createMany).not.toHaveBeenCalled();
    expect(db.opportunityBusinessUnit.deleteMany).not.toHaveBeenCalled();
  });
});

describe("backfillOpportunityBusinessUnits", () => {
  it("puts the whole deal value on the first unit and 0 on the rest", async () => {
    // This is what keeps deploy day a no-op: the roll-up sum has to
    // reproduce today's deal value exactly, so no pipeline total moves.
    db.opportunityBusinessUnit.count.mockResolvedValue(0);
    db.opportunity.findMany.mockResolvedValue([
      {
        id: "opp1",
        businessUnits: ["onewave", "onewave-revenue"],
        stage: "proposal",
        probability: 40,
        probabilityCustom: false,
        value: new Prisma.Decimal("50000.00"),
        closeDate: null,
        launchDate: null,
        revenueLaunchDate: null,
        lostReason: null,
        sortOrderWithinStage: 3,
      },
    ]);

    await backfillOpportunityBusinessUnits();

    const rows = db.opportunityBusinessUnit.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0].businessUnit).toBe("onewave");
    expect(rows[0].value.toFixed(2)).toBe("50000.00");
    expect(rows[1].businessUnit).toBe("onewave-revenue");
    expect(rows[1].value.toFixed(2)).toBe("0.00");
    // Every other field is copied so the roll-up reproduces the deal.
    expect(rows[0].stage).toBe("proposal");
    expect(rows[0].sortOrderWithinStage).toBe(3);
  });

  it("skips deals with no business units", async () => {
    db.opportunityBusinessUnit.count.mockResolvedValue(0);
    db.opportunity.findMany.mockResolvedValue([
      { id: "opp2", businessUnits: [], value: new Prisma.Decimal("1.00") },
    ]);

    const inserted = await backfillOpportunityBusinessUnits();

    expect(inserted).toBe(0);
    expect(db.opportunityBusinessUnit.createMany).not.toHaveBeenCalled();
  });

  it("is a no-op once rows exist", async () => {
    db.opportunityBusinessUnit.count.mockResolvedValue(12);

    const inserted = await backfillOpportunityBusinessUnits();

    expect(inserted).toBe(0);
    expect(db.opportunity.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx vitest run src/modules/opportunities/opportunity-business-units.test.ts`

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/modules/opportunities/opportunity-business-units.repository.ts
import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "@/modules/crm-shared/opportunity-rollup";
import {
  OPPORTUNITY_STAGES,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/modules/opportunities/opportunities.constants";

type Db = Prisma.TransactionClient | typeof prisma;
const client = (tx?: Prisma.TransactionClient): Db => tx ?? prisma;

/**
 * Stage key → sort order.
 *
 * Falls back to the code constant when the catalog table is empty, which
 * is the normal state on staging: `db:push` creates the table and never
 * runs the migration INSERT that fills it.
 */
async function stageSortOrder(
  tx?: Prisma.TransactionClient,
): Promise<Map<string, number>> {
  const rows = await client(tx).opportunityStageConfig.findMany({
    select: { key: true, sortOrder: true },
  });
  if (rows.length > 0) {
    return new Map(rows.map((r) => [r.key, r.sortOrder]));
  }
  return new Map(OPPORTUNITY_STAGES.map((key, i) => [key, i * 10]));
}

/** The stage a newly tagged unit starts at — the lowest in the order. */
async function firstStage(tx?: Prisma.TransactionClient) {
  const order = await stageSortOrder(tx);
  const [key] = [...order.entries()].sort((a, b) => a[1] - b[1])[0] ?? [
    OPPORTUNITY_STAGES[0],
  ];
  return {
    stage: key,
    probability:
      STAGE_PROBABILITY_DEFAULTS[
        key as keyof typeof STAGE_PROBABILITY_DEFAULTS
      ] ?? 0,
  };
}

/**
 * Create rows for newly tagged units and delete rows for untagged ones,
 * so the child rows always match `Opportunity.businessUnits`.
 *
 * A new unit starts at the first stage with value 0 rather than
 * inheriting the deal's stage: it has not done the work its siblings
 * have, and claiming otherwise would hide that from the roll-up.
 */
export async function syncBusinessUnitRows(
  opportunityId: string,
  tagOrder: readonly string[],
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = client(tx);
  const existing = await db.opportunityBusinessUnit.findMany({
    where: { opportunityId },
    select: { businessUnit: true },
  });
  const have = new Set(existing.map((r) => r.businessUnit));
  const want = new Set(tagOrder);

  const toAdd = tagOrder.filter((code) => !have.has(code));
  const toRemove = [...have].filter((code) => !want.has(code));

  if (toAdd.length > 0) {
    const { stage, probability } = await firstStage(tx);
    await db.opportunityBusinessUnit.createMany({
      data: toAdd.map((businessUnit) => ({
        opportunityId,
        businessUnit,
        stage,
        probability,
        value: new Prisma.Decimal(0),
      })),
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await db.opportunityBusinessUnit.deleteMany({
      where: { opportunityId, businessUnit: { in: toRemove } },
    });
  }
}

/**
 * The ONLY place the derived deal fields are written.
 *
 * A deal with no child rows keeps its stored values — see the null
 * contract on computeOpportunityRollup. Resetting them here would wipe
 * every untagged deal back to qualified / 0.
 */
export async function recomputeOpportunityRollup(
  opportunityId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = client(tx);
  const deal = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, businessUnits: true },
  });
  if (!deal) return;

  const children = (await db.opportunityBusinessUnit.findMany({
    where: { opportunityId },
    select: {
      businessUnit: true,
      stage: true,
      probability: true,
      value: true,
      closeDate: true,
      launchDate: true,
      revenueLaunchDate: true,
      lostReason: true,
    },
  })) as BusinessUnitProgress[];

  const rollup = computeOpportunityRollup(
    children,
    await stageSortOrder(tx),
    deal.businessUnits,
  );
  if (rollup === null) return;

  await db.opportunity.update({
    where: { id: opportunityId },
    data: rollup,
  });
}

/**
 * One-time backfill: one child row per existing tag.
 *
 * The deal's whole value goes on the FIRST tag and 0 on the rest, so the
 * roll-up sum reproduces today's figure exactly and no pipeline total
 * moves on deploy. Reps split it properly afterwards.
 *
 * Lives in code rather than migration SQL because staging deploys with
 * `db:push`, which never executes migration SQL.
 */
export async function backfillOpportunityBusinessUnits(): Promise<number> {
  if ((await prisma.opportunityBusinessUnit.count()) > 0) return 0;

  const deals = await prisma.opportunity.findMany({
    where: { NOT: { businessUnits: { isEmpty: true } } },
    select: {
      id: true,
      businessUnits: true,
      stage: true,
      probability: true,
      probabilityCustom: true,
      value: true,
      closeDate: true,
      launchDate: true,
      revenueLaunchDate: true,
      lostReason: true,
      sortOrderWithinStage: true,
    },
  });

  const rows = deals.flatMap((deal) =>
    deal.businessUnits.map((businessUnit, index) => ({
      opportunityId: deal.id,
      businessUnit,
      stage: deal.stage,
      probability: deal.probability,
      probabilityCustom: deal.probabilityCustom,
      value: index === 0 ? deal.value : new Prisma.Decimal(0),
      closeDate: deal.closeDate,
      launchDate: deal.launchDate,
      revenueLaunchDate: deal.revenueLaunchDate,
      lostReason: deal.lostReason,
      sortOrderWithinStage: deal.sortOrderWithinStage,
    })),
  );
  if (rows.length === 0) return 0;

  await prisma.opportunityBusinessUnit.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return rows.length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && npx vitest run src/modules/opportunities/opportunity-business-units.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Lint, format, type-check**

```bash
cd apps/api
npx prettier --write src/modules/opportunities/opportunity-business-units.repository.ts src/modules/opportunities/opportunity-business-units.test.ts
npx eslint src/modules/opportunities/
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/opportunities/opportunity-business-units.repository.ts apps/api/src/modules/opportunities/opportunity-business-units.test.ts
git commit -m "feat(crm): sync business-unit rows and recompute the deal roll-up"
```

---

### Task 5: Wire the Sales CRM write paths

**Files:**

- Modify: `apps/api/src/modules/opportunities/opportunities.service.ts`
- Test: `apps/api/src/modules/opportunities/opportunities.service.test.ts` (extend)

**Interfaces:**

- Consumes: `syncBusinessUnitRows` and `recomputeOpportunityRollup` from Task 4.
- Produces: nothing new. This is the task that makes the roll-up true.

The named risk in the spec is that `Opportunity.stage` is both stored and derived, so **every** write must funnel through the recompute helper. Three call sites exist today: `create`, `update` (`opportunities.service.ts:396`, the `input.stage` branch), and the `closed_lost` path at `:462`.

- [ ] **Step 1: Write the failing test**

```ts
// Add to apps/api/src/modules/opportunities/opportunities.service.test.ts
const rollup = vi.hoisted(() => ({
  syncBusinessUnitRows: vi.fn().mockResolvedValue(undefined),
  recomputeOpportunityRollup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(
  "@/modules/opportunities/opportunity-business-units.repository",
  () => rollup,
);

describe("opportunity update — roll-up wiring", () => {
  it("syncs the units BEFORE recomputing", async () => {
    // Order matters: a recompute that runs first reads the OLD child
    // rows and writes a roll-up for units the deal no longer has.
    await opportunityService.update(
      "opp1",
      { businessUnits: ["onewave", "onewave-revenue"] },
      "user1",
      ["crm:team-read"],
    );

    expect(rollup.syncBusinessUnitRows).toHaveBeenCalledWith(
      "opp1",
      ["onewave", "onewave-revenue"],
      expect.anything(),
    );
    expect(rollup.recomputeOpportunityRollup).toHaveBeenCalledWith(
      "opp1",
      expect.anything(),
    );
    expect(
      rollup.syncBusinessUnitRows.mock.invocationCallOrder[0],
    ).toBeLessThan(
      rollup.recomputeOpportunityRollup.mock.invocationCallOrder[0],
    );
  });

  it("recomputes after a stage change too", async () => {
    await opportunityService.update("opp1", { stage: "proposal" }, "user1", [
      "crm:team-read",
    ]);

    expect(rollup.recomputeOpportunityRollup).toHaveBeenCalled();
  });
});
```

Match the real `opportunityService.update` signature when writing this — read it at `opportunities.service.ts:396` first; the argument list above is illustrative of the call, not copied from the source.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx vitest run src/modules/opportunities/opportunities.service.test.ts`

Expected: FAIL — neither helper is called.

- [ ] **Step 3: Wire the three call sites**

In each of `create`, `update` and the `closed_lost` path, inside the existing transaction where there is one: call `syncBusinessUnitRows(id, businessUnits, tx)` first, then `recomputeOpportunityRollup(id, tx)`. Never write `stage`, `probability`, `value`, `closeDate`, `launchDate`, `revenueLaunchDate` or `lostReason` to the deal directly once children exist — the recompute owns them.

- [ ] **Step 4: Run the full API suite**

Run: `cd apps/api && npx vitest run`

Expected: PASS. The 2136 existing tests must stay green — PR1 changes no behaviour for a deal with no business units, and every fixture today is untagged.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/opportunities/
git commit -m "feat(crm): funnel every opportunity write through the roll-up"
```

---

### Task 6: Revenue CRM mirror

**Files:**

- Create: `apps/api/src/modules/revenue-opportunities/opportunity-business-units.repository.ts`
- Test: `apps/api/src/modules/revenue-opportunities/opportunity-business-units.test.ts`
- Modify: `apps/api/src/modules/revenue-opportunities/opportunities.service.ts`

**Interfaces:**

- Consumes: `computeOpportunityRollup` from Task 1 — the same pure function, which is the point. Only the Prisma delegates differ.
- Produces: the same three function names, scoped to the Revenue CRM.

- [ ] **Step 1: Copy Task 4's test file, swap the delegates**

`prisma.opportunityBusinessUnit` → `prisma.revenueOpportunityBusinessUnit`, `prisma.opportunity` → `prisma.revenueOpportunity`, `prisma.opportunityStageConfig` → `prisma.revenueStageConfig`. Keep every assertion.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run src/modules/revenue-opportunities/opportunity-business-units.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the mirror and wire its service**

Same three functions against the Revenue delegates; same three call sites in `revenue-opportunities/opportunities.service.ts`. The pure roll-up is imported, not duplicated.

- [ ] **Step 4: Run the full API suite**

Run: `cd apps/api && npx vitest run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/revenue-opportunities/
git commit -m "feat(sales-revenue): mirror per-business-unit progress and roll-up"
```

---

### Task 7: Run the backfill on boot, and prove it moves no money

**Files:**

- Modify: `apps/api/src/main.ts` (or the existing startup hook that calls `ensureCatalogSeeded`)
- Test: `apps/api/src/modules/opportunities/opportunity-business-units.test.ts` (extend)

**Interfaces:**

- Consumes: `backfillOpportunityBusinessUnits` from Tasks 4 and 6.
- Produces: nothing. This is the deploy-safety task.

- [ ] **Step 1: Write the invariant test**

```ts
it("reproduces every deal's value exactly after backfill", async () => {
  // Deploy-day guarantee: the roll-up sum must equal the pre-migration
  // deal value, or the pipeline total visibly moves on release.
  const deal = {
    id: "opp1",
    businessUnits: ["onewave", "onewave-revenue"],
    stage: "proposal",
    probability: 40,
    probabilityCustom: false,
    value: new Prisma.Decimal("50000.00"),
    closeDate: null,
    launchDate: null,
    revenueLaunchDate: null,
    lostReason: null,
    sortOrderWithinStage: 0,
  };
  db.opportunityBusinessUnit.count.mockResolvedValue(0);
  db.opportunity.findMany.mockResolvedValue([deal]);

  await backfillOpportunityBusinessUnits();
  const rows = db.opportunityBusinessUnit.createMany.mock.calls[0][0].data;

  const summed = rows.reduce(
    (acc: Prisma.Decimal, r: { value: Prisma.Decimal }) => acc.add(r.value),
    new Prisma.Decimal(0),
  );
  expect(summed.toFixed(2)).toBe(deal.value.toFixed(2));
});
```

- [ ] **Step 2: Run to verify it passes** (Task 4's implementation should already satisfy it)

Run: `cd apps/api && npx vitest run src/modules/opportunities/opportunity-business-units.test.ts`

Expected: PASS. If it fails, Task 4's value split is wrong — fix there, not here.

- [ ] **Step 3: Call both backfills at startup**

Alongside the existing catalog seeding, `await` both `backfillOpportunityBusinessUnits()` calls, log the inserted count, and **swallow errors into a warning**. A backfill that throws must not stop the API from booting; the tables simply stay empty and the roll-up keeps every deal's stored values, which is the safe degradation.

- [ ] **Step 4: Full verification**

```bash
cd apps/api && npx vitest run && npx tsc --noEmit
cd ../web && npx vitest run && npx tsc --noEmit
cd ../.. && bash scripts/check-line-length.sh && npx prettier --check .
```

Expected: api 2136+ pass, web 480 pass, both type-checks clean, no over-long lines.

- [ ] **Step 5: Commit and open the PR**

```bash
git add apps/api/src/
git commit -m "feat(crm): backfill business-unit rows on boot, in code not migration SQL"
```

PR body must state: no UI change, deal-level behaviour identical, backfill puts full value on the first unit so no pipeline total moves, and PR2 brings the board.

---

## Manual verification on staging

Automated tests mock Prisma, so the backfill's real SQL has never touched a database at this point. After the branch deploys to staging:

1. Record the pipeline total before: the Sales CRM board's column totals.
2. Deploy, and confirm the API booted — the backfill runs on boot and logs its inserted count.
3. Confirm the totals are **unchanged**. Any movement means the value split is wrong; roll back rather than adjust the data.
4. `SELECT opportunity_id, business_unit, stage, value FROM crm_opportunity_business_units LIMIT 20;` — spot-check that a multi-unit deal has one row per tag, with the full value on the first and 0 on the rest.
5. Tag a test deal with a second unit and confirm a new row appears at `qualified` with value 0, and that the deal's own stage does not change (it is already at or beyond `qualified`... unless it was further along, in which case the deal **should** drop back to `qualified` — that is the roll-up working, and is the one visible behaviour change PR1 can produce).

Point 5 is worth flagging to BD before release: tagging a new unit onto an advanced deal will pull the deal's stage back. That is intended — the new unit genuinely has not started — but it will surprise a rep the first time.

## Deviation from plan (2026-08-25 fix wave)

**Task 5 (Wire the Sales CRM write paths) and its Task 6 revenue-CRM equivalent were implemented,
then reverted on `main` (`6e43353d`) and moved to PR2.** `syncBusinessUnitRows` and
`recomputeOpportunityRollup` stay exported and tested by Task 4 / Task 6's own suites — only the
`OpportunityService` call sites and their wiring tests were reverted.

Reason: the wiring broke PR1's binding constraint that deal-level behaviour stay byte-identical.

- On `create`, a brand-new deal has no child rows yet, so `syncBusinessUnitRows` treated every
  submitted tag as newly added and seeded it at `firstStage()` / value 0; `recomputeOpportunityRollup`
  then wrote that blank state back onto the stage/value/dates the rep just submitted. A deal created
  at `negotiation` for 500000 persisted as `qualified` / 0 / null.
- On every edit of an already-tagged deal, nothing propagated the deal-level write down onto the
  existing child rows before recomputing, so the recompute overwrote the edit with a stale roll-up.
- Untagged deals were unaffected (recompute is a no-op with no child rows), which is why this suite
  stayed green while the bug shipped.

Root cause, so PR2 does not repeat it: the spec's "a newly tagged BU starts at the first stage with
value 0" rule was written for seeding a deal's _first_ child rows from its own already-correct
deal-level fields (see Task 7's backfill — full value on the first tag, 0 on the rest, an exact
reproduction, not a reset). It does not describe what a _write path_ should do to a deal that already
has child rows and is only now getting a genuinely new tag, and the reverted wiring conflated the
two: it used the seed rule even on a first-time create, which is exactly the "no child rows yet" case
that should instead reproduce the submitted deal, not blank it. See the spec's own "Deviation from
plan" section for the full writeup. PR2's write-path wiring must seed a deal's first set of child rows
FROM the deal (mirroring the backfill) and reserve first-stage/value-0 for a tag added to a deal that
already carries child rows, plus write deal-level edits down onto existing child rows before
recomputing.
