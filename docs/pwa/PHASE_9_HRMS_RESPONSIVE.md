# Phase 9 — HRMS responsive conversion

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.**
No breakpoint invented or moved. No component rewritten. `DataTable` and `ui/table.tsx`
untouched. Desktop measured unchanged at 1280/1440/1920.

---

## 1. Inventory

| | Count |
|---|---|
| Routes | **2** (`hrms/page.tsx` 1,117 lines; `hrms/esop/[employeeId]/page.tsx` 189) |
| Components | **34** (12,667 lines total) |
| DataTables | **14** (6 already explicit from Phase 8B) |
| Tables not using `DataTable` | **2** — `attendance-calendar-panel` (`Table`), `payslip-management-tab` (**raw `<table>`**) |
| Dialogs | 16 · Sheets: 0 |
| Forms (`useForm`) | 4 · files with inputs: 15 |
| `w-[Npx]` | 20 · `min-w-[Npx]` 4 · fixed-px grid-cols 1 · `overflow-x-auto` 3 |
| `md:text-sm` on text entry | **0** — Phase 7F's rule is not violated anywhere in HRMS |

Verified rather than assumed: **no raw `<input>` anywhere in HRMS**, so every field goes through
the shared primitive and inherits the Phase 7F pointer-aware sizing; **no custom `DialogContent`
width**, so all 16 dialogs inherit the Phase 7F-1 geometry; the one fixed-px grid
(`sm:grid-cols-[160px_1fr]`) is `sm:`-prefixed and single-column below 640px.

---

## 2. What was measured, and what it found

The harness mounted the **real components** — `EquityMonthlySalaryTab`, `OnboardingTab` and
`PayslipManagementTab` — with hostile fixtures. The self-fetching one had its API stubbed at
the network layer, so no record was created and no production data touched. The fixtures
type-check against the real prop types, which is what proves they are faithful.

**Four defects, all measured before any code changed:**

| Defect | Evidence at 320–430px |
|---|---|
| **Page overflow** | `page=283`, `unc=3` — "Manage template" (169px) and "New onboarding" (162px) reaching **x=603 in a 320px viewport** |
| **Equity matrix flattened to cards** | `months=0/12` — not one of twelve monthly allocations visible |
| **Payslip table clipped** | `clip=1` — Status, PDF and Actions unreachable, not scrollable |
| **Manager dashboard hid "Late (min)"** | the question the screen exists to answer, behind the expander |

---

## 3. The matrix nobody could see

`equity-monthly-salary-tab` builds **twelve month columns** from `MONTH_NAMES.map(...)`:

```ts
const monthCols = MONTH_NAMES.map((m) => ({ key: `month_${m}`, header: m, … }));
```

They are generated, not literal, so the column parser used throughout Phases 8B–8C reported
this table as **five columns** — `employeeName, position, currency, year, startDate`. The real
shape is **seventeen**, and a row is one employee's year of share allocations.

Against Phase 8C's matrix rule it scores 8/8, the same as the payroll grid: the comparison runs
down the columns, the twelve months are a series, the row *is* a repeated measurement, and the
column count is the task. **Decision: `mobileMode="table"`.**

Measured after: `table`, `months=12/12`, scrolling 1908px inside a 286px container at 320px,
page overflow 0, and the scroll region keyboard-reachable via Phase 8D's conditional tab stop.

A scan of every HRMS DataTable for `.map()`-generated columns found **exactly one**. Phase 8's
warning was that parsers produce false positives; this is the same warning in the other
direction — a **false negative** that hid the module's most significant defect.

---

## 4. The payslip table

`payslip-management-tab` (1,125 lines) rendered a **raw lowercase `<table>`** inside
`<div className="border-border overflow-hidden rounded-md border">`. Two consequences:

1. `overflow-hidden` **clips**. Measured `clip=1` at 320–430px: the Status, PDF and Actions
   columns were not merely off-screen, they were unreachable.
2. A hand-rolled `<div><table>` inherits **none** of Phase 8D's work — no contained scrolling,
   no conditional tab stop, no `role="region"`, no focus ring, no `scope="col"`.

The table is grouped by month with expandable group rows, so converting it to `DataTable` is
the "large unrelated refactor" the brief lists as a stop condition. Instead the **outer element**
became the shared `Table` primitive, leaving every grouped row untouched:

```tsx
<Table className="w-full text-xs"
       containerClassName="border-border rounded-md border"
       aria-label="Payslips">
```

Measured after: `clip=0` at every width; at 320px it scrolls `451/286` **with** a tab stop; at
768+ it needs no scroll and gets **no** tab stop.

**An error of mine, caught by axe:** the first fix was `overflow-hidden` → `overflow-x-auto`,
which removed the clipping and immediately introduced a
`scrollable-region-focusable` violation — a scroll region a keyboard user could not reach.
Adopting the primitive fixed both.

---

## 5. Toolbars

Four HRMS toolbars shared one shell — `flex items-center gap-2 rounded-lg border p-3` — with
**no `flex-wrap`**, plus a `flex-1` spacer. That is the entire 283px of page overflow.

Fix: `flex-wrap`, matching the repo's own working pattern. Measured after: **page overflow 0,
uncontained 0** at all twelve widths.

Every other fixed width was manually confirmed and none is a defect: the `w-[36px]`/`w-[56px]`/
`w-[80px]`/`w-[180px]`/`w-[260px]` values are **table column widths** (contained by
`overflow-x-auto`), and `attendance-calendar-panel`, `attendance-corrections-panel` and
`payslip-management-tab` already carry `flex flex-wrap`. Three of the automated hits were false
positives from too short a lookback window — confirmed by reading, per the brief.

---

## 6. Information hierarchy

Four tables were surfacing the wrong fields. Each was confirmed by reading the column list
before changing anything:

| Table | Was hidden | Why it matters |
|---|---|---|
| `attendance-manager-panel` | `checkIn`, **`late` (min)** | a manager's dashboard exists to answer "who is late, and by how much" |
| `attendance-shift-assignment-panel` | `effective` | the date the assignment takes effect *is* the thing being scheduled |
| `attendance-settings-panel` [0] | `active` | whether a shift is in use |
| `attendance-settings-panel` [1] | `status` | whether an exception was approved |

**Deliberately unchanged**: `attendance-tab` [2] (the department roll-up) — Phase 8C already
decided cards, because `attendancePercentage` *is* the comparison metric and it is visible; the
counts are the workings. `attendance-executive-panel` (both arrays) — three columns each, all
already visible.

---

## 7. Accessibility

axe-core 4.13.0 on the real components, light and dark, at 390px and 1280px, **run serially**
(the Phase 8D lesson: four workers against one dev server produced a phantom contrast finding).

| | Before | After |
|---|---|---|
| `button-name` (**critical**) | **4** | **0** |
| `scrollable-region-focusable` (serious) | 1¹ | **0** |
| `landmark-one-main`, `region` (moderate) | present | present — **harness artifacts**, see below |
| `page-has-heading-one` (moderate) | present | present — **real, and out of scope** |

¹ introduced by this phase's first payslip fix and removed by the second.

**The `button-name` finding is genuine and not HRMS-specific.** `role="combobox"` does **not**
take its name from content, so a `SelectTrigger` displaying "All statuses" is an unnamed control
to a screen reader. Eight HRMS filter selects and the shared `DataPagination` page-size select
were given `aria-label`.

Two findings are deliberately *not* fixed here, both verified rather than waved away:

- **`landmark-one-main` / `region`** — the dashboard layout does render `<main>`
  (`app/(dashboard)/layout.tsx:303`); the harness page does not. Artifacts.
- **`page-has-heading-one`** — real. Neither the layout nor the HRMS page has an `<h1>`, and
  **97 of 104 dashboard routes have none**. App-wide heading structure, not an HRMS table
  concern. **P2, reported.**
- **444 `SelectTrigger`s exist app-wide and exactly 1 carried an `aria-label` before this
  phase.** Only the HRMS ones were measured, and Selects inside labelled form fields may well be
  named, so 443 is an upper bound rather than a defect count. **P1 candidate for a dedicated
  pass**, sized but not claimed.

---

## 8. Verification

| | Result |
|---|---|
| Unit / integration | **2,709 passed** (1,958 API + 751 web) — was 2,691; **+18** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| 320 · 375 · 390 · 430 | **PASS** — page overflow 0, uncontained 0, clipped 0 |
| 768 · 834 · 900 · 1023 | **PASS** |
| 1024 · 1280 · 1440 · 1920 | **PASS** — toolbars single-row, 66px, unchanged |
| WebKit iPhone 13 | **PASS** |
| WebKit iPad Mini | not re-run — Phase 8D's runs cover the shared primitives, unchanged here |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The harness (`app/hr-check/page.tsx`) and five probe specs were **deleted**; no references
remain and the build emits the same 96 pages.

---

## 9. Tests

`components/hrms/__tests__/hrms-responsive.test.tsx` — **18 tests**: the equity matrix renders
as a table at 320px and shows all twelve month headers (plus a guard that `MONTH_NAMES` is still
12, so the first two cannot pass over a table that stopped being a matrix) · four toolbars wrap ·
the payslip table neither clips nor bypasses the primitive · five filter selects are named ·
four per-table field expectations driven through the real `deriveMobileRoles`.

**Every invariant verified by breaking it:**

| Break | Result |
|---|---|
| Remove `mobileMode="table"` from the equity matrix | **2 failed** |
| Un-wrap the onboarding toolbar | **1 failed** |
| Remove the `late` field role | **1 failed** |
| Point the payslip table away from the primitive | **1 failed** |
| Remove a filter `aria-label` | **1 failed** |
| Restored | **18 passed** |

---

## 10. A second error of mine, recorded

The desktop-regression probe reported the onboarding toolbar wrapping to **3 rows at 1280px**,
which looked like a regression caused by adding `flex-wrap`. I changed the `flex-1` spacer to
`ml-auto` to fix it. It still reported 3 rows.

The probe was wrong. It counted rows by distinct `top` values, and the toolbar's children are
vertically centred with different heights — a 40px Select beside 36px Buttons — so three
`top` values meant three heights, not three rows. `barH: 66px` was a single row all along
(40px content + 12px padding each side).

The spacer change was reverted — it fixed nothing — and the probe now groups children by
centre-line with tolerance. It reports **1 row at 1280, 1440 and 1920**.

Two phases running, the measurement has been wrong before the code was. It is cheaper to
distrust the probe first.

---

## 11. API / Database / RBAC

**NONE.** Every change is a class string, a `mobileRole` declaration, an `aria-label`, or an
element swap. Mobile and desktop continue to use the same query, mutation, validation,
permission check and handler — no path was duplicated and no `canManage` / permission gate was
touched.

---

## 12. Known limitations

1. **No authenticated HRMS page was rendered.** Three real components were mounted with
   fixtures; the other 31 were audited by reading.
2. **11 of 14 DataTables were not rendered** — their hierarchy is asserted through the real
   `deriveMobileRoles`, but they were not seen.
3. **The 16 dialogs were audited structurally, not rendered.** They declare no custom width and
   contain no raw `<input>`, so they inherit the Phase 7F/7F-1 behaviour — but "inherits the
   right primitive" is not the same as "measured".
4. **`esop-grant-dialog` (1,205 lines) was not opened.** It is the largest HRMS dialog and has
   seven Selects.
5. **iPad Mini not re-run this phase.**
6. **Chromium and Firefox binaries absent** — WebKit only.
7. **The app-wide combobox-naming and missing-`<h1>` findings are sized, not fixed** (§7).
8. **No physical device.**

---

## 13. Remaining HRMS work

- The 31 components not rendered (§12.1), particularly `esop-grant-dialog`,
  `payslip-create-dialog` and `offboarding-checklist` — the three largest interactive surfaces.
- `attendance-calendar-panel` uses `Table` for what is a **calendar grid**; it was not measured
  and a month grid at 320px is a plausible defect.
- The HRMS route file itself (`hrms/page.tsx`, 1,117 lines) — tab strip, filters and layout were
  not measured, only the tab contents.

---

## 14. Recommended next phase

**The two app-wide accessibility findings this phase sized but did not fix**, together:
`aria-label` on unnamed comboboxes, and an `<h1>` per dashboard route. Both are single-attribute
changes, both were found with a real scanner rather than inferred, both affect every module
including the eight already converted, and neither belongs to any one feature phase — which is
precisely why they keep being deferred.

They are also the last shared-surface items in the backlog. After them, every remaining item on
this programme's list needs an authenticated session, and that prerequisite — a dedicated
non-admin account and a safe dataset, specified in Phase 7G-1 §9 — has now blocked verification
across six consecutive phases.
