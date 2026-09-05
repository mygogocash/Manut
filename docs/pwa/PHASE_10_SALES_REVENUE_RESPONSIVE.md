# Phase 10 — Sales & Revenue responsive conversion

**Four files changed**, each by adding `mobileRole` declarations. Plus one test file.

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.** No breakpoint
invented or moved. `DataTable`, `RecordCard`, `Sheet` and `SelectTrigger` untouched. Desktop
measured unchanged.

---

## 1. Baseline

Phase 9A: 2,721 tests, type-check/lint/build clean. Phase 8B flagged Sales & Revenue as one of
the largest remaining modules with possible mobile-hierarchy defects, and put its table count at
"approximately four".

---

## 2. Inventory

**Two live Sales surfaces, not one.** Both appear in the sidebar behind different permissions:

| Route | Label | Permissions | Components |
|---|---|---|---|
| `/sales` | Sales CRM | `crm:read`, `deals:read` | `components/{accounts,contacts,crm-activities,crm-tasks,leads,opportunities,sales}` |
| `/sales-revenue` | Sales Revenue CRM | `sales-revenue:read` | `components/sales-revenue/*` |
| `/revenue` | Revenue | — | `components/revenue/*` |

Their components are near-duplicates — `sales-dashboard.tsx` is 1,258 lines in both trees,
`convert-lead-dialog.tsx` 627 in both. **Every defect therefore exists twice**, and both copies
are fixed and tested here. (Whether two live copies should exist is a product question, not a
responsive one — flagged in §11, not acted on.)

| | Count |
|---|---|
| Routes | **3** (188 + 180 + 114 lines) |
| Components | **45** — sales-revenue 28 (13,739 lines), opportunities 5 (3,776), leads 6 (2,426), revenue 5 (894), sales 1 (282) |
| DataTables | **9** (4 duplicated pairs + `revenue/invoices-tab`) |
| Raw / primitive tables | **5** — `accounts-tab` ×2 and `revenue-overview-tab` use the `Table` primitive; `sales-dashboard` ×2 use bare `<table>` |
| DataTables with a footer | **0** |
| `.map()`-generated columns | **0** (checked explicitly — Phase 9's HRMS lesson) |

---

## 3. Table-by-table decisions

| Table | Record list or matrix? | Decision |
|---|---|---|
| **contacts** (×2) | record list — a person you contact | **CARD**, fixed (§4) |
| **activities** (×2) | record list — a logged interaction | **CARD**, fixed (§4) |
| leads (×2) | record list | **CARD** — already fixed in Phase 8B; company/name/status/owner/age visible |
| tasks (×2) | record list | **CARD** — already fixed in Phase 8B |
| `revenue/invoices-tab` | 3-column status/count/total roll-up | **unchanged** — all three columns already visible; nothing to promote |
| `accounts-tab` (×2) | 23-column engagement grid, drag-resizable, `table-fixed`, own scroll container | **TABLE, unchanged** — already a table at every width; card mode never applies |
| `revenue-overview-tab` | KPI cards + `Table` | **unchanged** — totals live in KPI cards, not a table footer |
| `sales-dashboard` (×2) | two bare `<table>`s, one with a Total row | **unchanged, flagged** (§6) |

---

## 4. What changed

Two record-oriented tables, on both surfaces:

**contacts** — measured at 320/375/390/430: `email=false, phone=false`. The card showed name,
account and job title. **A contact is reached by its email or phone**; the job title and created
date are context.

```ts
account → subtitle    email → field    phone → field    title/createdAt → detail
```

**activities** — measured: `occurredAt=false`, and the card was **titled by `type`** ("Meeting")
— a category, not an identity. An activity log with no "when" is not a log.

```ts
subject → title    anchor → subtitle    type → badge
occurredAt → field    owner → field    duration → detail
```

### Measured result

| Width | Mode | contacts before → after | activities before → after |
|---|---|---|---|
| 320 · 375 · 390 · 430 | cards | email ✗ phone ✗ → **✓ ✓** | when ✗ → **✓**, title `type` → `subject` |
| 768 → 1920 | table | unchanged | unchanged |

`pageOverflow = 0`, `uncontained = 0`, `clipped = 0` at **all twelve widths**, before and after.

---

## 5. Financial data — a false positive, recorded

`accounts-tab` renders `tcv`, `totalUsers`, `appUsers` and `probability` as:

```tsx
<span className="truncate text-right text-xs tabular-nums">
  {formatTcv(opp.value, opp.currency)}
</span>
```

inside a `table-fixed` table whose `tcv` column defaults to **130px** — and, unlike the text
columns (`name`, `blocker`, `remarks`), **with no `title` attribute**. Read from source that is
a serious defect: `"USD 18,000,000,000,000"` is 22 characters in a ~16-character box, and a cut
money value is a *wrong* money value with no tooltip to recover it.

**Measured with that exact markup and those exact widths: `clipped = 0`, and the value renders
in full.** `truncate` sets `overflow: hidden` on an **inline** `<span>`, where it has no effect;
the table container scrolls instead. The classes are inert, not protective.

So: no financial defect — but the protection is accidental. A test now asserts the `tcv` cell
does not gain `overflow-hidden`, because that single class would make the inert `truncate` live
and start silently cutting money.

Hostile values used throughout: `18,000,000,000,000` · `999,999,999` · `1,000,000` · `999,999` ·
`-4,500,000`, in USD/THB/JPY, with 70-character account names and 56-character person names.

---

## 6. Footers and totals

**No DataTable in this module passes a `footer`**, so Phase 8C's card-mode totals-loss defect
does not apply here.

`sales-dashboard` has a `Total` row inside a bare `<table>`, which is always a table (no card
mode), inside `<div className="overflow-x-auto">` — so the total survives and the scroll is
contained. **Flagged, not fixed**: a bare `<table>` inherits none of Phase 8D's work — no
`scope="col"`, no accessible name, no conditional tab stop, no 44px mobile hit area. Converting
it is the same one-line `Table` swap that fixed HRMS's payslip grid in Phase 9, but these two
files are 1,258 lines each and were not measured this phase. **P2.**

---

## 7. Toolbars, forms, sheets and dialogs

All audited, **no defects found**:

- **Toolbars** — `pageOverflow = 0` at 320/375/390/430 across all measured surfaces.
- **Forms** — no raw `<input>`, so every field inherits Phase 7F's pointer-aware sizing;
  **zero** occurrences of `md:text-sm` on text entry.
- **Sheets / dialogs** — no consumer declares a custom width, so all inherit the Phase 7F-1
  geometry. No `!` override added.
- **Selects** — Phase 9A's primitive fix covers the ones carrying a placeholder. Per the brief,
  the residual unnamed triggers were **not** touched here.

---

## 8. Accessibility

axe-core 4.13.0 on the rendered surfaces, **light and dark**, at 390px and 1280px, serially:

**0 violations in all four runs**, including `button-name`, `aria-input-field-name`, `label`,
`empty-table-header`, `scrollable-region-focusable`, `color-contrast` and `heading-order`.

Only the surfaces rendered were scanned. **No application-wide WCAG claim.**

---

## 9. Verification

| | Result |
|---|---|
| Unit / integration | **2,729 passed** (1,958 API + 771 web) — was 2,721; **+8** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| 320 · 375 · 390 · 430 | **PASS** — overflow 0, uncontained 0, clipped 0 |
| 768 · 834 · 900 · 1023 | **PASS** |
| 1024 · 1280 · 1440 · 1920 | **PASS** — unchanged |
| WebKit iPhone 13 | **PASS** |
| WebKit iPad Mini | not re-run — no shared primitive changed |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

Harness (`app/sr-check/page.tsx`) and five probe specs **deleted**; `GET /sr-check` returns
**404**; build emits the same 96 pages.

### Tests

`components/sales-revenue/__tests__/sales-revenue-responsive.test.tsx` — 8 tests: four card-face
expectations (both copies of both tables) driven through the real `deriveMobileRoles` · action
roles preserved on all four · an anti-tautology test feeding the pre-fix shapes · two guards on
the accounts numeric cells.

**Every invariant verified by breaking it:**

| Break | Result |
|---|---|
| Remove the `email` field role | **1 failed** |
| Remove the actions role | **1 failed** |
| Revert the activity title to `type` | **1 failed** |
| Add `overflow-hidden` to the `tcv` cell | **1 failed** |
| Restored | **8 passed** |

---

## 10. Four probe errors, recorded

This phase spent more effort on probe mechanics than on code, and every one of these produced a
confidently wrong reading first:

1. **Playwright matches routes last-registered-first.** My `**/api/**` catch-all was registered
   last and swallowed every specific stub, so the first run measured **three empty tables** and
   reported `email:false, tcvSeen:false` — which looks exactly like the defect I was hunting.
2. **Wrong endpoints.** The real URLs are `/api/sales-revenue/{accounts,contacts,activities}`,
   not `/accounts`. Found by logging requests, not by reading services.
3. **Hydration takes ~4–6s in dev** for these components. A 200ms settle produced empty
   measurements; `data-ready` only proves the effect ran, not that the fetch painted.
4. **The harness used hardcoded copies of the column arrays**, so after fixing the real files
   the measurement was unchanged — and briefly looked like the fix had not worked.

`AccountsTab` also could not be mounted at all: it throws on any fixture that does not satisfy
its full contract, and reverse-engineering that for a 1,377-line component cost more than it
returned. The numeric-cell question was answered instead by reproducing the exact cell markup
and column widths, which is what decides truncation — the approach Phases 8A and 8C used.

---

## 11. Known limitations

1. **`AccountsTab` was never rendered.** 1,377 lines, 23 columns, drag-resize, the module's
   densest surface. Its numeric-cell geometry was measured faithfully; its toolbar, filters,
   dialogs and drag behaviour were not.
2. **`sales-dashboard` (×2, 1,258 lines each) was not rendered** — two bare `<table>`s, one
   carrying a Total row (§6).
3. **`pipeline-kanban` (1,036 / 991 lines) was not measured at all.** A kanban board is the
   module's primary mobile surface and Phase 7C did this work for the project board; nothing
   equivalent has been done here.
4. **`revenue-overview-tab`, `opportunity-detail-sheet` (724 / 760), `account-form-dialog`
   (971) and `opportunity-form-dialog` (588) were audited structurally, not rendered.**
5. **Two live copies of the same module.** Every fix had to be applied twice. That duplication
   is a product/architecture question and was not acted on.
6. **No authenticated route was rendered.** WebKit only; no physical device.

---

## 12. Remaining Sales & Revenue work

- **`pipeline-kanban`** — unmeasured, and the largest gap in this module.
- **`accounts-tab`** — 23 columns with per-column drag-resize; needs a real session.
- **`sales-dashboard`** — the bare-`<table>` → `Table` swap (§6).
- The four large dialogs and two detail sheets in §11.4.

---

## 13. Recommended next phase

**`pipeline-kanban`, on its own.** It is the one Sales & Revenue surface where the mobile
experience is likely to be genuinely broken rather than merely imperfect: a horizontal column
board is the hardest thing to make work on a phone, this programme already solved exactly that
problem for the project board in Phases 7C–7D, and the two kanban files here (1,036 and 991
lines) have never been measured. The pattern to reuse — a status tab strip, a "move to" sheet
replacing drag, keyboard sensors — is written down and tested.

It is also the last large unmeasured surface reachable without a session. Everything after it —
`accounts-tab`'s drag-resize, the form dialogs, the detail sheets — needs the authenticated
account and safe dataset specified in Phase 7G-1 §9, now outstanding across eight phases.
