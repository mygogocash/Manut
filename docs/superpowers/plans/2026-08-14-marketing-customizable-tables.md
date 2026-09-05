# Marketing CRM Customizable Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Marketing CRM table becomes customizable — reorder, hide, resize, sort and filter columns — with an admin-set organisation default that each user may override, plus the missing per-tab date-range/partner filters and date tooltips.

**Architecture:** A three-layer resolution for table layout — code defaults, then an admin default stored server-side in one `SystemSetting` row per table id, then a per-user `localStorage` override. A single `useTableLayout` hook resolves the layers and exposes a reset-to-default path. The existing `useColumnOrder` / `useColumnWidths` / `SortableColumnHead` primitives are reused rather than replaced; `useTableLayout` composes them and adds visibility. Marketing's hand-rolled `<table>` markup adopts the shared primitives table by table.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, shadcn + base-ui, dnd-kit (already used by `useColumnOrder`), Express 5 + Prisma 6 (`SystemSetting`), vitest.

## Global Constraints

- Workspace package names stay `@nexora/*`; every user-visible string says "Intranet".
- Permission codes are `module:action`. Reuse existing codes — read gates on `marketing:dashboard:view`, admin writes gate on `admin:manage`. Do **not** mint new permission codes or a seed migration for this.
- No schema migration. The admin default lives in `SystemSetting` rows (`table-layout.<tableId>`), following the payslip-company pattern in `payroll.service.ts`.
- On `SystemSetting` upsert, write an **inline object literal** for `value` — a typed variable trips Prisma's `InputJsonValue`.
- Express: literal routes register **before** `:param` routes.
- Never re-derive a server-computed value client-side (CLAUDE.md paginated-aggregate pitfall). Tooltip window dates come from the API.
- Tailwind class strings must be full literals the static scanner can see. No `bg-${x}`.
- All four PR gates must pass: `pnpm type-check`, `pnpm lint`, `pnpm test`, brand-drift grep.
- Branch `claude/<slug>`, conventional-commit titles, PRs target `dev`.

## Table Inventory

12 tables across 4 files, all currently hand-rolled `<table>` markup with no shared primitives:

| File | Tables |
|---|---|
| `marketing-analytics/dau-mau/page.tsx` | 8 — Trend detail, Lifetime sessions, Rolling 3-day momentum, DAU Explorer, Forecast, Weekly Growth, Campaign Index, Charts-tab table |
| `marketing-analytics/page.tsx` | 1 |
| `marketing-analytics/reports/page.tsx` | 1 |
| `marketing-analytics/traffic/[partnerId]/page.tsx` | 2 |

Reference implementations of the existing per-user pattern: `it-crm-list.tsx`, `qa-crm-issue-table.tsx`, `legal-crm-list.tsx`, `investors/page.tsx`.

## File Structure

**Create:**
- `apps/api/src/modules/table-layouts/table-layouts.service.ts` — get/set/clear one layout by table id
- `apps/api/src/modules/table-layouts/table-layouts.controller.ts` — routes
- `apps/api/src/modules/table-layouts/table-layouts.validation.ts` — Zod schemas
- `apps/api/src/modules/table-layouts/__tests__/table-layouts.service.test.ts`
- `apps/web/src/services/table-layout.service.ts` — client for the above
- `apps/web/src/components/shared/use-table-layout.ts` — three-layer resolver
- `apps/web/src/components/shared/use-table-layout.test.ts`
- `apps/web/src/components/shared/table-customize-menu.tsx` — per-table popover (hide/show, reset, save-as-default)

**Modify:**
- `apps/api/src/modules/index.ts` — mount the new module
- the 4 marketing table files above

---

### Task 1: Server-side layout store

**Files:**
- Create: `apps/api/src/modules/table-layouts/table-layouts.service.ts`
- Create: `apps/api/src/modules/table-layouts/table-layouts.validation.ts`
- Test: `apps/api/src/modules/table-layouts/__tests__/table-layouts.service.test.ts`

**Interfaces:**
- Consumes: `prisma.systemSetting`
- Produces: `tableLayoutsService.get(tableId)`, `.set(tableId, input)`, `.clear(tableId)`, `normalizeLayout(value)`, `TABLE_LAYOUT_KEY_PREFIX`, and `interface TableLayout { order: string[]; hidden: string[]; widths: Record<string, number> }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeLayout,
  TABLE_LAYOUT_KEY_PREFIX,
} from "@/modules/table-layouts/table-layouts.service";

describe("table layout normalisation", () => {
  it("keys a layout under a stable prefix", () => {
    expect(TABLE_LAYOUT_KEY_PREFIX + "ma-trend-detail").toBe(
      "table-layout.ma-trend-detail",
    );
  });

  it("drops junk and clamps widths to the minimum", () => {
    expect(
      normalizeLayout({
        order: ["date", 42, "day"],
        hidden: ["day", null],
        widths: { date: 10, day: 180, bogus: "x" },
      }),
    ).toEqual({
      order: ["date", "day"],
      hidden: ["day"],
      widths: { date: 56, day: 180 },
    });
  });

  it("returns empty structures for a null or non-object row", () => {
    expect(normalizeLayout(null)).toEqual({ order: [], hidden: [], widths: {} });
    expect(normalizeLayout([1, 2])).toEqual({ order: [], hidden: [], widths: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/modules/table-layouts`
Expected: FAIL — cannot resolve `table-layouts.service`

- [ ] **Step 3: Write minimal implementation**

`table-layouts.service.ts`:

```ts
import prisma from "@/infrastructure/database/prisma";

export const TABLE_LAYOUT_KEY_PREFIX = "table-layout.";
/** Mirrors MIN_COLUMN_WIDTH in apps/web/src/components/shared/use-column-widths.ts. */
const MIN_COLUMN_WIDTH = 56;

export interface TableLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

const EMPTY: TableLayout = { order: [], hidden: [], widths: {} };

/** Type-guard every field: the row is free-form JSON an admin wrote. */
export function normalizeLayout(value: unknown): TableLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY;
  const v = value as Record<string, unknown>;
  const strings = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((k): k is string => typeof k === "string") : [];
  const widths: Record<string, number> = {};
  if (v.widths && typeof v.widths === "object" && !Array.isArray(v.widths)) {
    for (const [k, w] of Object.entries(v.widths as Record<string, unknown>)) {
      if (typeof w === "number" && Number.isFinite(w)) {
        widths[k] = Math.max(MIN_COLUMN_WIDTH, Math.round(w));
      }
    }
  }
  return { order: strings(v.order), hidden: strings(v.hidden), widths };
}

export const tableLayoutsService = {
  async get(tableId: string): Promise<TableLayout | null> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: TABLE_LAYOUT_KEY_PREFIX + tableId },
    });
    return row ? normalizeLayout(row.value) : null;
  },

  async set(tableId: string, input: unknown): Promise<TableLayout> {
    const layout = normalizeLayout(input);
    await prisma.systemSetting.upsert({
      where: { key: TABLE_LAYOUT_KEY_PREFIX + tableId },
      // Inline literal: a typed variable trips Prisma's InputJsonValue.
      create: {
        key: TABLE_LAYOUT_KEY_PREFIX + tableId,
        value: {
          order: layout.order,
          hidden: layout.hidden,
          widths: layout.widths,
        },
      },
      update: {
        value: {
          order: layout.order,
          hidden: layout.hidden,
          widths: layout.widths,
        },
      },
    });
    return layout;
  },

  async clear(tableId: string): Promise<void> {
    // Already absent is success — clearing is idempotent.
    await prisma.systemSetting
      .delete({ where: { key: TABLE_LAYOUT_KEY_PREFIX + tableId } })
      .catch(() => undefined);
  },
};
```

`table-layouts.validation.ts`:

```ts
import { z } from "zod";

export const tableIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "tableId must be kebab-case");

export const tableLayoutSchema = z.object({
  order: z.array(z.string().max(64)).max(100).optional(),
  hidden: z.array(z.string().max(64)).max(100).optional(),
  widths: z.record(z.string().max(64), z.number()).optional(),
});

export type TableLayoutInput = z.infer<typeof tableLayoutSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/modules/table-layouts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/table-layouts
git commit -m "feat(table-layouts): server-side store for admin table defaults"
```

---

### Task 2: Layout routes

**Files:**
- Create: `apps/api/src/modules/table-layouts/table-layouts.controller.ts`
- Modify: `apps/api/src/modules/index.ts`
- Test: extend `apps/api/src/modules/table-layouts/__tests__/table-layouts.service.test.ts`

**Interfaces:**
- Consumes: `tableLayoutsService`, `tableIdSchema`, `tableLayoutSchema` from Task 1
- Produces: `GET /table-layouts/:tableId`, `PUT /table-layouts/:tableId`, `DELETE /table-layouts/:tableId`

- [ ] **Step 1: Write the failing test**

The id becomes part of a `SystemSetting` key, so it must not be able to address another module's row.

```ts
import { describe, expect, it } from "vitest";
import { tableIdSchema } from "@/modules/table-layouts/table-layouts.validation";

describe("tableId guard", () => {
  it("accepts kebab-case ids", () => {
    expect(tableIdSchema.safeParse("ma-trend-detail").success).toBe(true);
  });

  it("rejects ids that could escape the key namespace", () => {
    for (const bad of ["../admin", "a.b", "A_B", "payslip.company", ""]) {
      expect(tableIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/modules/table-layouts -t "tableId guard"`
Expected: FAIL if `tableIdSchema` is absent. If Task 1 already added it, this passes on first run — that is fine, it pins the guard against future loosening.

- [ ] **Step 3: Write the controller**

```ts
import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { BadRequestException } from "@/common/exceptions/http-exception";
import { requirePermission } from "@/common/middleware/require-permission";

import { tableLayoutsService } from "./table-layouts.service";
import { tableIdSchema, tableLayoutSchema } from "./table-layouts.validation";

const router = Router();

function parseId(raw: string): string {
  const parsed = tableIdSchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException("Invalid table id");
  return parsed.data;
}

// Read is open to anyone who can see the dashboard: the layout is not secret
// and every viewer needs it to render the table at all.
router.get(
  "/:tableId",
  requirePermission(PERMISSIONS.MARKETING_DASHBOARD_VIEW),
  async (req, res) => {
    const data = await tableLayoutsService.get(parseId(req.params.tableId));
    res.json({ data });
  },
);

// Writing the org-wide default is an admin act.
router.put(
  "/:tableId",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  async (req, res) => {
    const body = tableLayoutSchema.parse(req.body);
    const data = await tableLayoutsService.set(parseId(req.params.tableId), body);
    res.json({ data });
  },
);

router.delete(
  "/:tableId",
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  async (req, res) => {
    await tableLayoutsService.clear(parseId(req.params.tableId));
    res.status(204).send();
  },
);

export default router;
```

Mount in `apps/api/src/modules/index.ts` at `/table-layouts`, following the surrounding router registrations.

- [ ] **Step 4: Run gates**

Run: `pnpm type-check && cd apps/api && npx vitest run src/modules/table-layouts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/table-layouts apps/api/src/modules/index.ts
git commit -m "feat(table-layouts): expose get/set/clear routes"
```

---

### Task 3: The three-layer resolver hook

**Files:**
- Create: `apps/web/src/services/table-layout.service.ts`
- Create: `apps/web/src/components/shared/use-table-layout.ts`
- Test: `apps/web/src/components/shared/use-table-layout.test.ts`

**Interfaces:**
- Consumes: `mergeStoredColumnOrder(stored, defaultOrder)` from `@/components/shared/use-column-order`, the routes from Task 2
- Produces: `resolveLayout(code, admin, user): TableLayout` and `useTableLayout(tableId, codeDefaults)` returning `{ order, hidden, widths, isHidden, toggleHidden, reorder, setWidth, resetToDefault, saveAsDefault, hasUserOverride }`

**Why a pure `resolveLayout` beside the hook:** the layering rules are the part most likely to be wrong, and they are far cheaper to test as a function than through a rendered hook.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveLayout } from "@/components/shared/use-table-layout";

const CODE = {
  order: ["date", "avg", "vs28", "vsPrev"],
  hidden: [],
  widths: {},
};

describe("resolveLayout", () => {
  it("returns code defaults when neither layer is set", () => {
    expect(resolveLayout(CODE, null, null)).toEqual(CODE);
  });

  it("applies the admin default over code", () => {
    const admin = {
      order: ["avg", "date"],
      hidden: ["vs28"],
      widths: { date: 120 },
    };
    const r = resolveLayout(CODE, admin, null);
    expect(r.order).toEqual(["avg", "date", "vs28", "vsPrev"]);
    expect(r.hidden).toEqual(["vs28"]);
    expect(r.widths).toEqual({ date: 120 });
  });

  it("lets the user override the admin default", () => {
    const admin = { order: ["avg", "date"], hidden: ["vs28"], widths: {} };
    const user = { order: ["vsPrev"], hidden: [], widths: { avg: 200 } };
    const r = resolveLayout(CODE, admin, user);
    expect(r.order[0]).toBe("vsPrev");
    expect(r.hidden).toEqual([]);
    expect(r.widths).toEqual({ avg: 200 });
  });

  it("ignores keys the table no longer defines", () => {
    const admin = { order: ["removed", "avg"], hidden: ["removed"], widths: {} };
    const r = resolveLayout(CODE, admin, null);
    expect(r.order).not.toContain("removed");
    expect(r.hidden).not.toContain("removed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/shared/use-table-layout.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `resolveLayout`, then the hook around it**

```ts
"use client";

import { mergeStoredColumnOrder } from "@/components/shared/use-column-order";

export interface TableLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

/**
 * Code defaults < admin default < user override, resolved per field. Each
 * layer is partial: a layer that says nothing about widths leaves the layer
 * beneath it showing through, so an admin who only reorders columns does not
 * also wipe every user's widths.
 *
 * Order runs through mergeStoredColumnOrder so a column added to the code
 * default after a layout was saved lands beside its neighbours instead of
 * being appended past every column the user has seen.
 */
export function resolveLayout(
  code: TableLayout,
  admin: TableLayout | null,
  user: TableLayout | null,
): TableLayout {
  const known = new Set(code.order);
  const keep = (keys: string[]) => keys.filter((k) => known.has(k));
  const pickOrder = (l: TableLayout | null) =>
    l && l.order.length > 0
      ? mergeStoredColumnOrder(keep(l.order), code.order)
      : null;
  const pickHidden = (l: TableLayout | null) => (l ? keep(l.hidden) : null);
  const pickWidths = (l: TableLayout | null) =>
    l && Object.keys(l.widths).length > 0 ? l.widths : null;

  return {
    order: pickOrder(user) ?? pickOrder(admin) ?? [...code.order],
    hidden: pickHidden(user) ?? pickHidden(admin) ?? [...code.hidden],
    widths: pickWidths(user) ?? pickWidths(admin) ?? { ...code.widths },
  };
}
```

The hook: fetch the admin layer once per `tableId` (tolerating a 403 as "no default"), read the user layer from `localStorage["table-layout." + tableId]`, persist user edits there, and expose `resetToDefault()` (delete the local key) and `saveAsDefault()` (PUT the resolved layout, then delete the local key so the admin sees exactly what everyone else will).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/shared/use-table-layout.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/use-table-layout.ts apps/web/src/components/shared/use-table-layout.test.ts apps/web/src/services/table-layout.service.ts
git commit -m "feat(tables): three-layer column layout resolver"
```

---

### Task 4: Customize menu

**Files:**
- Create: `apps/web/src/components/shared/table-customize-menu.tsx`

**Interfaces:**
- Consumes: the `useTableLayout` return shape from Task 3, `useAuth().hasPermission`
- Produces: `<TableCustomizeMenu layout={layout} labels={Record<string, string>} />`

- [ ] **Step 1: Build the popover**

A `SlidersHorizontal` trigger opening a popover with a checkbox per column bound to `toggleHidden`, a "Reset to default" item enabled only when `hasUserOverride`, and — rendered only when `hasPermission("admin:manage")` — "Save as organisation default" calling `saveAsDefault()`.

Guard: never allow hiding every column. Disable the checkbox of the last visible one.

Note the dialog-scroll trap from `project-form-dialog.tsx`: a portalled popover inside a `react-remove-scroll` container cannot be wheel-scrolled. These tables are not inside a dialog, so a normal popover is fine here — but do not copy this component into a dialog without re-checking that.

- [ ] **Step 2: Verify against the DAU/MAU page once Task 5 lands**
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/shared/table-customize-menu.tsx
git commit -m "feat(tables): column customize menu with admin save-as-default"
```

---

### Task 5: Adopt on Trend detail (reference table)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/marketing-analytics/dau-mau/page.tsx`

Table id `ma-trend-detail`. Wire `useTableLayout`, render headers through `SortableColumnHead`, respect `hidden`, apply `widths` against a `table-fixed` layout, and add click-to-sort per column. Keep the existing date tooltips exactly as they are.

- [ ] **Step 1:** Extract the Trend detail table into a local component — the page file is already ~1400 lines.
- [ ] **Step 2:** Wire layout + sort + `<TableCustomizeMenu />`.
- [ ] **Step 3:** Run `pnpm type-check && pnpm lint && pnpm test`.
- [ ] **Step 4:** Verify in the running app: reorder a column, hide one, reload — the layout survives. "Reset to default" restores it. As an admin, "Save as organisation default" then reset shows the saved order.
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(marketing-analytics): customizable Trend detail table"
```

---

### Task 6: Per-tab date-range and partner filters

**Files:**
- Modify: `apps/web/src/app/(dashboard)/marketing-analytics/dau-mau/page.tsx`

`getDauMauDashboard()` already accepts `dateFrom` / `dateTo`; the page only ever *displays* `data.dateFrom → data.dateTo` and never lets anyone set them. `TelcoSelect` exists but renders on only two tabs. Filters stay per-tab per the chosen shape.

- [ ] **Step 1:** Add `dateFrom` / `dateTo` state seeded from the API's current window, so first paint is unchanged.
- [ ] **Step 2:** Refetch on change; add a "Reset range" affordance.
- [ ] **Step 3:** Add `TelcoSelect` to the Dashboard tab and any other tab lacking it.
- [ ] **Step 4:** Gates + manual verification.
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(marketing-analytics): date-range and partner filters per tab"
```

---

### Task 7: Roll out to the remaining 7 DAU/MAU tables

Table ids: `ma-lifetime-sessions`, `ma-rolling-momentum`, `ma-dau-explorer`, `ma-forecast`, `ma-weekly-growth`, `ma-campaign-index`, `ma-charts`.

Each gets the Task 5 treatment plus date tooltips wherever a figure comes from a window: Rolling momentum's "last 3-day" / "prior 3-day", Lifetime's "peak date", Weekly Growth's week bounds, Forecast's baseline window. Where a tooltip needs dates the client does not have, extend the API row type exactly as `TrendRow` was extended in #1054 — emitted server-side, never re-derived in the browser.

- [ ] One commit per table, gates green on each.

---

### Task 8: Roll out to the other marketing files

- `marketing-analytics/page.tsx` — 1 table, id `ma-overview`
- `marketing-analytics/reports/page.tsx` — 1 table, id `ma-reports`
- `marketing-analytics/traffic/[partnerId]/page.tsx` — 2 tables, ids `ma-traffic-summary`, `ma-traffic-detail`

- [ ] One commit per file, gates green on each.

---

## Self-Review

**Spec coverage:** reorder (Tasks 3/5) · hide (3/4/5) · resize (3/5) · sort (5) · filter (6) · admin default + user override (1/2/3/4) · tooltips across marketing tables (5/7/8) · date-range + partner filters (6). No gaps.

**Type consistency:** `TableLayout` has the same three fields in the API service (Task 1), the Zod schema (Task 1), and the web hook (Task 3). `mergeStoredColumnOrder` is the existing exported name from `use-column-order.ts`. `normalizeLayout` and `resolveLayout` are distinct functions with distinct jobs — server-side sanitising versus client-side layering.

**Sequencing:** Tasks 1–5 are the foundation and must land before 7 and 8, which are mechanical repetitions. Task 6 is independent and can ship in parallel.

**Open question carried from #1054:** `vsPrevMonthTip` still has a `TODO(project-team)` about month-end clamping — 31 May compares against 30 Apr, so "vs prev month" is not a same-date comparison on those rows. Settle the wording during Task 5 while that table is already open.

**Deliberately not in scope — row reordering.** These are derived analytics tables ordered by date or by a computed rank; a manual row order would not survive the next refetch and would fight the sort added in Task 5. Sorting is the useful form of that request. If drag-to-reorder rows is genuinely wanted, it needs its own task and a persistence story for rows that come and go.
