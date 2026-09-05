# Phase 8 — Remaining intranet modules

**Scope delivered:** a full inventory of every remaining module, and **one bounded
conversion completed and measured end to end** — the action-column sweep across 42 files in
~25 modules.

**Zero API, database, Prisma, RBAC, auth, business-logic or dependency change.**

---

## 1. What this phase honestly covers

The repository has **104 dashboard routes across 51 top-level modules**. Two are converted
(`dashboard`, `projects`). Converting the other 49 to the standard this programme has held
itself to — measure, convert, verify at twelve widths, test, document — is not one phase of
work, and pretending otherwise would produce a large diff nobody has verified.

So this phase does two things properly rather than fifty things thinly:

1. **Inventories everything**, with measurable risk signals, as the roadmap (§2).
2. **Completes the action-column sweep** that Phase 7B-0 built the capability for and
   explicitly deferred — the single highest-coverage P1 fix available, mechanical enough to
   apply safely across 25 modules and verifiable without a session (§3).

Everything else is prioritised and left, named, in §7.

---

## 2. Module inventory

Signals per module: routes, DataTable consumers, action columns, already-annotated, sheet
consumers, fixed pixel widths, fixed-px grid columns, forms.

| Module | Routes | DT | Action cols | Fixed w | Fixed grid | Forms | Risk |
|---|---|---|---|---|---|---|---|
| **accounting** | 2 | **19** | **15** | 13 | **16** | 19 | **87** |
| projects | 7 | 2 | 1 | 23¹ | 9¹ | 5 | 41 |
| **hrms** | 2 | **10** | 5 | 10 | 1 | 4 | 24 |
| **sales-revenue** | 1 | 4 | 4 | 0 | 6 | 10 | 24 |
| crm (shared) | 0 | 0 | 0 | 0 | 8 | 3 | 16 |
| marketing-analytics | 12 | 5 | 1 | 11 | 0 | 0 | 14 |
| it-operations | 3 | 3 | 2 | 7 | 0 | 0 | 13 |
| cash-advance | 2 | 0 | 0 | 2 | 3 | 1 | 8 |
| leave | 4 | 1 | 1 | 6 | 1 | 5 | 8 |
| partners | 4 | 1 | 1 | 5 | 0 | 1 | 8 |
| visa | 3 | 2 | 2 | 0 | 0 | 2 | 6 |
| applications · benefits · docs · expenses · investors · payroll · qa-crm | 1–3 each | 0–3 | 0–2 | 0–4 | 0–2 | 0–3 | 4 |
| admin · contacts · crm-activities · crm-tasks · dataroom · employees · investor-updates · leads | 0–6 | 0–3 | 0–1 | 0 | 0 | 0–3 | 3 |
| 30 further modules | 1–4 | 0 | 0 | 0 | 0 | 0–2 | 0 |

¹ `projects`' fixed widths are the board's deliberate 270px columns and the task sheet — both
already converted and measured in Phases 7B–7D.

**Totals: 104 routes · 51 modules · 108 fixed pixel widths · 48 fixed-px grid columns ·
43 un-annotated action columns.**

---

## 3. What changed — the action-column sweep

### The defect

`deriveMobileRoles` cannot distinguish an action column from a data column, so an
un-annotated one becomes a labelled value **inside the card's expander**. For a row menu
that is a nuisance. For Approve, Reject or Delete the control is simply not present.

### Selection — 45 annotated, 2 deliberately not

Every `{ key: "actions" | "manage", … }` object in a DataTable consumer was parsed and its
cell body inspected. A column qualified only if it **actually renders a control**
(`Button`, `DropdownMenu`, `WorkflowActions`, `ResponsiveActions`, `IconButton`, link).

**Two were excluded** because the key says "actions" but the cell renders no control:
`it-operations/access/page.tsx` (one of its two action columns) and
`components/admin/admin-audit-tab.tsx`. Annotating those would have moved a data value into
an action bar.

**45 columns across 42 files** were annotated, one line each:

```ts
{ key: "actions", mobileRole: "actions" as const, … }
```

`as const` because these column arrays are usually variables rather than inline literals, so
`"actions"` otherwise widens to `string` and fails the `Column<T>` union — the same fix
Phase 7B-0 used.

### Modules touched

accounting (14) · sales-revenue (4) · hrms (3) · visa (2) · it-operations (2) ·
applications · benefits · contacts · crm-activities · crm-tasks · dataroom · employees ·
investor-updates · leads · learning · legal · marketing-analytics · office · partners ·
payroll · performance.

### Measured result

Real `DataTable`, real column shapes, hostile data (67-char unbroken string, 80-char URL,
18-digit number, 29-char status), swept and un-swept side by side at **all twelve widths**:

| Width | Mode | Swept | Un-swept | Overflow | Uncontained |
|---|---|---|---|---|---|
| 320 · 375 · 390 · 430 | cards | **4 actions @ 44px** | **0 actions** | 0 | 0 |
| 768 · 834 · 900 · 1023 | table | 4 @ 24px | 4 @ 24px | 0 | 0 |
| 1024 · 1280 · 1440 · 1920 | table | 4 @ 24px | 4 @ 24px | 0 | 0 |

**Mobile: 0 → 4 reachable controls, at a 44px target. Desktop: byte-identical.** The 44px
comes from the floor Phase 7B-0 put on `RecordCard`'s action bar, so no call site needed
touching.

### Regression guard

`components/shared/__tests__/action-column-coverage.test.ts` walks every DataTable consumer
and fails if any control-rendering action column lacks `mobileRole`. It also asserts it
found **more than 30 columns**, so a broken detector fails loudly instead of reporting a
clean sweep over nothing.

---

## 4. Decisions taken, and not taken

| Area | Decision |
|---|---|
| **Tables** | Only the action-column role was changed. **No table was converted to card mode or given `cardBreakpoint`** — `DataTable`'s `auto` mode already produces cards below 768px, and moving a breakpoint needs measured per-module geometry, which needs a session. |
| **Sheets** | Untouched. Phase 7F-1 fixed the primitive so consumer widths win; nothing here needed a consumer change, and `sheet.tsx` was not modified. |
| **Forms** | Untouched. The pointer-aware 16px rule from Phase 7F already applies through the shared `Input`/`Textarea`. |
| **Toolbars / filters** | Untouched — needs authenticated measurement to know which actually overflow. |
| **Breakpoints** | **None invented, none moved.** |
| **Actions** | Same handlers, same permission checks; only where a cell renders. |
| **Touch** | No new `touch-action`, no new gesture surface. |
| **Desktop** | Provably unchanged — measured identical at 768→1920. |

---

## 5. Verification

| | Result |
|---|---|
| Unit / integration | **2,627 passed** (1,958 API + 669 web) — was 2,625 |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0** |
| Mobile 320 · 375 · 390 · 430 | **PASS** — cards, 4 actions @ 44px, 0 overflow |
| Tablet 768 · 834 · 900 · 1023 | **PASS** — table, 0 overflow |
| Desktop 1024 · 1280 · 1440 · 1920 | **PASS** — identical to un-swept |
| WebKit (iPhone 13 profile) | **PASS** — all measurement above ran on WebKit |
| Physical device | **NOT TESTED** |
| Accessibility | **NOT RE-RUN** — no accessible name, role or contrast changed |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

A measurement error of mine, worth recording: the first three runs reported "table" at every
width. `DataTable` resolves table-vs-cards from a `matchMedia` hook in an effect, so the
first painted frame is always a table — I was measuring before hydration. Fixed with a
deterministic wait on the settled state, not a sleep.

---

## 6. Authenticated verification

**PENDING DEV/STAGING VERIFICATION AFTER MERGE.**

Per this brief, authentication was not reopened. No credential was used, created or
searched for. The 45 annotated columns live on authenticated pages, so what is verified is
the **mechanism** — on the real component, at every width, with the same column shapes —
not each module's own page. The regression guard makes a silent revert impossible; only
per-module visual confirmation remains.

---

## 7. What remains — prioritised

**P1 — workflow risk, needs authenticated measurement**

- **accounting** (19 tables, 16 fixed-px grids, 19 forms) — by far the largest remaining
  surface, and the fixed grids are the most likely source of real overflow.
- **hrms** (10 tables) and **sales-revenue** (4 tables, 6 fixed grids).

**P2 — layout**

- **108 fixed pixel widths** and **48 fixed-px grid columns** repo-wide. Each is a candidate
  overflow at 320px; which actually overflow can only be settled by rendering them.
- **marketing-analytics** — 12 routes, 11 fixed widths, chart-heavy.
- **13 sheets widened by Phase 7F-1**, still never visually reviewed.

**P3**

- `directory/employee-detail-sheet` declares no `w-full`; `landmark-one-main` / `region` on
  public routes; the `table-layouts` flake from 7F-1.

---

## 8. Known limitations

1. **49 of 51 modules remain unconverted.** This phase deliberately completed one
   cross-cutting fix rather than starting many.
2. **No authenticated page was rendered** (§6).
3. **No physical device.**
4. **Chromium and Firefox Playwright binaries absent**, so browser measurement was WebKit
   only.
5. **The two excluded action columns** (§3) were judged from their cell bodies, not from
   seeing them; if either does need to be reachable on mobile, it is a one-line addition.
6. **Fixed-width and fixed-grid counts are static signals**, not confirmed defects. They
   rank work; they do not prove breakage.

---

## 9. Recommended next phase

**Accounting**, on its own, once the environment allows an authenticated session.

It carries a third of the remaining risk in this inventory: 19 DataTables, 16 fixed-px grid
columns and 19 forms across 2 routes and a large tab surface. It is also the module where a
static signal is least trustworthy — fixed-px accounting grids are frequently deliberate
(aligned money columns), so the work genuinely requires measuring before changing, exactly
the pattern Phases 7B–7D followed.

Doing accounting properly is a phase. Doing it alongside four other modules is how this
programme would start shipping unverified layout changes.
