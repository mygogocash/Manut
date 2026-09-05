# Phase 8B — DataTable mobile information hierarchy

**Zero API, database, Prisma, RBAC, auth, business-logic or dependency change.**
No breakpoint invented or moved. No second DataTable system. No component rewritten.
`deriveMobileRoles` itself is **unchanged**. Desktop measured identical at 768 → 1920.

---

## 1. Objective

Phase 8A found that accounting's mobile cards hid the amount and the status. This phase
asked whether that was an accounting problem or a systemic one.

**It is systemic.** It is also worse than 8A suggested, because there are *two* failure modes,
and the second one 8A never saw.

---

## 2. Inventory

| | Count |
|---|---|
| DataTable consumer files | **74** |
| Column arrays (≥3 columns) | **93** |
| Columns | **632** |
| Modules | **28** |
| Arrays with explicit roles, before | 18 (Phase 7A + 8A only) |
| Arrays relying on the default, before | **75** |

Per-module, the tables relying on the default and hiding decision-critical information:

| Module | Tables | Hiding critical info |
|---|---|---|
| accounting | 21 | 7 (all deliberate — see §6) |
| hrms | 11 | 6 |
| it-operations | 7 | 6 |
| marketing-analytics | 7 | 5 |
| payroll | 3 | 3 |
| sales-revenue · leads · crm-tasks | 6 | 4 |
| visa · travel · legal · benefits · office · expenses · employees · partners · projects | 14 | 13 |
| 12 further modules | 24 | 0 |

**44 of 93 tables (47%), across 20 modules.**

### An instrument that had to be fixed three times

The audit is only as good as its parser, and mine was wrong three times before it was right.
Each fix moved the numbers materially, so they are recorded rather than quietly corrected:

| Bug | Columns seen |
|---|---|
| `,\n` — missed every CRLF file (24 of 74) | 437 |
| `mobileRole: "x",` — missed `"x" as const,` | 437 → 576 |
| `^\s*key:` — missed single-line `{ key: "x", header: "y" }` | 576 → **632** |

The first regex saw **65%** of the columns and reported a clean-looking result. Array splitting
was also distance-based at first, which silently merged four pairs of separate tables
(it-operations renewals + access requests, benefits list + enrolments, attendance live/my/dept,
travel my/all); it is now boundary-based on `const x = [` / `useMemo(() => [` / `columns={[`.

Ground truth for every fix was Phase 8A's accounting annotations, whose correct output was
already known.

---

## 3. The two defects

### 3.1 Decision-critical values behind the expander

`deriveMobileRoles` promotes columns 2 and 3 and buries the rest. Business tables here order
their columns `identifier, descriptor, descriptor, amount, dates, status`, so the default
reliably surfaces the *least* useful columns.

Measured on WebKit, real `DataTable`, real `payroll-invoices-tab` column order:

```
320/390/430px   pay-shipped   money=- status=- due=-   head="PAY-INV-2026-…"
```

All three money columns (`amount`, `whtAmount`, `netAmount`) and the status: absent.

### 3.2 Cards headed by table chrome — new in this phase

`titleKey = explicit("title")[0] ?? usable[0].key`. When the first column is a checkbox, a
chevron or a row number, the card is headed by a control that renders **no text at all**:

```
320/390/430px   tasks-shipped   head=""      ← the title is a <Checkbox>
320/390/430px   emp-shipped     head="1"     ← the title is the row index
```

Five tables: `crm-tasks/tasks-tab` and `sales-revenue/tasks-tab` (checkbox),
`hrms/onboarding-tab` and `offboarding-tab` (chevron), `employees/employee-table` (row number).

A sixth is subtler. `hrms/esop-tab` fakes a rowspan by blanking the employee name on a
person's second and later grants (`↳`), which reads correctly only while the rows are adjacent
in one grid. As cards, each is its own visual unit, so those cards were titled with a bare
arrow.

---

## 4. What changed

**31 tables across 26 files — 180 role declarations**, plus five supporting lines (§4.3).

### 4.1 The shape applied

```ts
{ key: "invoiceNo",  mobileRole: "title"    as const, … }   // what it is
{ key: "consultant", mobileRole: "subtitle" as const, … }   // who it is with
{ key: "status",     mobileRole: "badge"    as const, … }   // what state it is in
{ key: "netAmount",  mobileRole: "field"    as const, … }   // the number that decides
{ key: "period",     mobileRole: "field"    as const, … }   // the date that decides
{ key: "entity",     mobileRole: "detail"   as const, … }   // everything else
```

### 4.2 Per-table judgements, not a blanket rule

| Table | Decision |
|---|---|
| **bank / travel-detail-sheet** | `description` titles the card, not `date`. A card headed "01 Sept 2026" identifies nothing. |
| **payroll invoices** | `netAmount` is the visible figure; `amount` and `whtAmount` are its components. |
| **journals** | `totalDebit` only — a balanced entry has debit === credit. |
| **fixed assets** | `netBookValue`, not `purchasePrice`. NBV is live, cost is history. |
| **disposal queue** | `gainLoss` — the number the disposal decision turns on. |
| **count panel** | `variance` — the entire point of a physical count. |
| **deferred tax** | `deferredTax` + `temporaryDifference` (the outputs). `bookCarrying`/`taxWdv` are inputs: the card shows the answer, the tap shows the workings. |
| **IT seat utilisation** | `utilizationPercentage`, `monthlyCost`, `potentialMonthlySavings` — seat counts are the workings. |
| **leads** | `owner` + `age`. Triage runs on those, not on the email address. |
| **travel** | **No title declared.** `baseColumns` feeds both the "my" and "all" tables, and the default's first-column rule already resolves correctly for each (`code` for my, `employee` for the approver view). The default is *right* here; overriding it would have broken one of the two. |

### 4.3 Where a role declaration was not enough

Three cases needed a line of real code, all presentation-only:

1. **`crm-tasks` / `sales-revenue` tasks-tab** — the first column renders the *mark-done
   Checkbox*. Hiding it would have removed a control from mobile, so it became
   `mobileRole: "field"` with `mobileLabel: "Done"`. The control stays reachable; the card
   gains a heading.
2. **`hrms/esop-tab`** — `isGrouped = !sortBy` became `!sortBy && !isCompact` via the existing
   `useIsBelow("md")`. Group on the table, never on the cards.
3. **`onboarding` / `offboarding` / `employee-table`** — the chevron and row-number columns are
   `mobileRole: "hidden"`. Safe in both cases: the row itself is the expand affordance
   (`onRowClick`), RecordCard has its own expander, and a row number is derived from the page
   index rather than from data.

Type plumbing: `Column<T>` is now **exported** (it was already structurally public through
`DataTableProps`), the local `AssetCol` gained `mobileRole?: Column<Asset>["mobileRole"]`, and
the two `leads-tab` column arrays are annotated `Column<Lead>[]` so literal-union inference
stops fighting `concat()`.

---

## 5. Measured result

Real `DataTable`, real column shapes, hostile values per Step 8 (93-char title, 91-char
subtitle, 41-char status, 43-char person, `99,999,999,999,999.00`, `-999,999,999,999.00`,
37-char reference, 38-char date label), at **320 · 390 · 430 · 768 · 834 · 1024 · 1280 · 1440 ·
1920** on WebKit:

| Width | Mode | Before | After |
|---|---|---|---|
| 320 · 390 · 430 | cards | `head=""` / `head="1"`; money, status, due all absent | **heading identifies the record; money, status, due present** |
| 768 → 1920 | table | all values present | **identical — byte-for-byte the same output** |

**`pageOverflow = 0` and `uncontained = 0` at every width, before and after.**

Desktop is unaffected by construction: `mobileRole` is read only on the card path.

### Audit result

| | Before | After |
|---|---|---|
| Tables with explicit roles | 18 | **49** |
| Tables hiding decision-critical information | **44** | **19** (all accounted for — §6) |
| Cards headed by table chrome | **5** | **0** |

---

## 6. The 19 remaining, itemised

**7 deliberate.** Each is a second copy of, or an input to, a figure the card already shows:
accounting's `ratePercent`, `balancesAfter`, `costTransferred`, `purchasePrice`, `totalCredit`
(all named in Phase 8A's `DELIBERATELY_BEHIND_THE_TAP`), payroll's `amount`/`whtAmount`, and IT
billing's seat counts.

**2 are not tables at all** — parser false positives worth naming so nobody re-investigates
them: `learning/page.tsx [3]` is an `ImportFieldSpec[]` (an import-template field list) and
`projects/proposals/page.tsx [0]` is a tab-key array. The compiler caught the first: eight
`mobileRole` insertions there failed type-check with *"'mobileRole' does not exist in type
'ImportFieldSpec'"*, and were reverted.

**10 deferred, per Step 2's lower-priority list** — configuration, lookup, administrative and
technical tables: accounting's category and tax-code managers, `admin/usage/activity-table`,
`hrms/attendance-settings-panel` (×2), marketing-analytics' partner metric/raw/report tables
(×4), and `payroll/payroll-run-detail-sheet`.

`payroll-run-detail-sheet` is the one genuine deferral rather than a low-stakes one: **19
columns** of payroll components inside a sheet. Card mode turns it into 19 labelled rows per
employee, and the right answer is probably `mobileMode: "table"` so the grid scrolls and stays
comparable — which is a design decision needing a real payroll run to judge, not a role
declaration.

---

## 7. Global default assessment (Step 18)

### **Decision: B — the default is acceptable as a fallback, but business tables should declare roles explicitly.**

Not C, and the evidence is worth stating precisely because 47% sounds like C.

The default has two independent rules, and they are not equally wrong:

- **"Title = first column"** is *correct* wherever the first column is the identifier, which is
  most tables — including `travel`, where it resolves differently and correctly for two tables
  sharing one column array (§4.2). It fails only against **table chrome**: 5 of 93.
- **"Promote columns 2 and 3"** has no information about which columns matter and cannot
  acquire any. It was wrong for 44 of 93 tables here, but replacing it with any other
  positional rule ("promote 4 and 5") would be equally blind. Step 6 rules this out and the
  evidence agrees.

So the default is a reasonable *fallback for a table nobody has thought about*, and the fix for
a table someone has thought about is one line per column. That is what this phase did.

### One global change is worth making, and is NOT made here

`titleKey` should skip columns that cannot produce a heading — a blank `header` on a
control-only cell. That would have fixed all five chrome-titled cards with no per-table work,
and there is no table where titling by a blank-header control column is desirable.

Per Step 18 this is **documented, not implemented**:

- **Affected:** the 5 chrome-titled tables (now fixed explicitly, so the change would be a
  no-op for them) plus any future table opening with a checkbox or expander.
- **Blast radius:** every one of the 93 arrays re-derives its title. Tables whose first column
  has a blank header *and* is a real value would shift heading — not enumerated here.
- **Desktop impact:** none. `deriveMobileRoles` is card-path only.
- **Mobile impact:** strictly better headings, or unchanged.
- **Tests required:** a `deriveMobileRoles` unit case per skip condition, plus a re-run of the
  93-array invariant in §8.

Recommended, out of scope for an audit phase.

---

## 8. Tests

`components/shared/__tests__/mobile-hierarchy.test.tsx` — **24 tests**:

1. **19 per-table expectations**, deliberately table-specific rather than "every table must show
   N fields": *a visa card must show the expiry date*, *a 90-day report must show the legal due
   date*, *a payroll invoice must show the net amount*, *a proposal must show its tier*.
2. **The chrome-title invariant** across all 93 arrays — no card may be headed by
   `expand`/`complete`/`select`/`rowNo`/`drag`.
3. **Guards the guard** — asserts the parser found >70 arrays, so a broken regex fails loudly
   instead of reporting a clean sweep (the exact failure mode §2 describes).
4. **Render tests** on the real component at 375px and 1280px.
5. **An anti-tautology test** that feeds the pre-fix shape to `deriveMobileRoles` and asserts
   the amount *does* land in the expander, so the file documents the defect it prevents.

Every assertion calls the **real exported `deriveMobileRoles`**, so it cannot drift from the
implementation.

**Verified by breaking it.** Deleting `employee-table`'s title role and its `hidden` role:

```
components/employees/employee-table.tsx [array 0]: "employee" is not visible on the
  card — it resolved to the expander. Card shows: rowNo, employeeId, status, department
components/employees/employee-table.tsx [array 0] is titled by "rowNo"
Tests  2 failed | 22 passed (24)
```

then restored to 24/24.

Phase 8's action-role guard and Phase 8A's money-visibility guard both still pass, unweakened.

---

## 9. Verification

| | Result |
|---|---|
| Unit / integration | **2,656 passed** (1,958 API + 698 web) — was 2,632; +24 |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| Mobile 320 · 390 · 430 | **PASS** — identity, money, status, due present; 0 overflow |
| Tablet 768 · 834 | **PASS** — table, 0 overflow |
| Desktop 1024 · 1280 · 1440 · 1920 | **PASS** — identical to pre-change |
| Hostile data (Step 8) | **PASS** — `pageOverflow = 0`, `uncontained = 0` at all 9 widths |
| WebKit iPhone 13 | **PASS** — all measurement ran on WebKit |
| WebKit iPad Mini | **NOT RUN** — see §11 |
| Empty state | **PASS** — "No invoices found" renders in card mode |
| Loading state | **PASS** — 6 skeletons render in card mode |
| Error / permission-denied | **NOT TESTED** — needs a session |
| Card expansion | **PASS** — `<button>`, `aria-expanded` false→true, labelled "Show more" |
| Keyboard | **PASS** — focusable, toggles on Enter |
| Accessibility scan | **NOT RE-RUN** — no accessible name, role or contrast changed |
| Performance | **No change** — roles are read during render from the existing `columns` array; no new fetch, no new state, no extra render pass |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The temporary harness (`app/dt-check/page.tsx` and two probe specs) was **deleted**; no
references remain and the build emits the same 96 pages as before it existed.

---

## 10. A mistake of mine worth recording

Reverting my bad `learning/page.tsx` edit with `git checkout --` discarded **Phase 8's action
annotation** in the same file, because nothing in this programme is committed. The
action-column guard caught it immediately and named the file. Restored to exactly one line,
matching the sweep.

`git checkout --` on a file with other uncommitted work reverts *all* of it. In this working
tree that is every phase since Phase 1.

---

## 11. Known limitations

1. **No authenticated page was rendered.** Column arrays were read from source and driven
   through the real component; the modules' own pages were not visited.
2. **iPad Mini WebKit was not run separately.** Tablet widths (768, 834) were measured on the
   iPhone 13 WebKit profile by resizing, which exercises the same engine and the same
   breakpoint but not iPad-specific input behaviour.
3. **Field selection is a product judgement.** Which two or three values deserve the visible
   slots (§4.2) is defensible, not proven. Each is a one-line change.
4. **Error and permission-denied states were not tested** — both need a session.
5. **Spread-composed column arrays fragment in the parser.** `[...baseColumns, {actions}]`
   appears as a separate one-column array. It affects the array *count*, not the role
   resolution, and `travel` (the main case) was read by hand.
6. **Chromium and Firefox Playwright binaries absent** — measurement was WebKit only.
7. **No physical device.**
8. **The card expander is 36px tall.** It passes WCAG 2.5.8 AA (24px minimum) but misses the
   44px floor this programme set for RecordCard's *action bar* in Phase 7B-0. Left alone
   deliberately: it is one class on a shared component, and it changes the height of every card
   in the app, which belongs in a pass that measures that rather than in an
   information-hierarchy phase. **P3, recommended.**

---

## 12. Remaining modules

Every DataTable consumer in the repository is now audited. What remains is not tables:

- **49 of 51 modules are still unconverted at the page level** — toolbars, filters, forms,
  dialogs, charts and detail layouts. Phase 8's inventory (§7 there) still stands as the map.
- **marketing-analytics** — 12 routes, chart-heavy, 5 of its 7 tables deliberately deferred here.
- **13 sheets widened by Phase 7F-1**, still never visually reviewed.

---

## 13. Recommended next phase

**`payroll-run-detail-sheet` and the `mobileMode: "table"` question** — small, and it settles a
category this programme has not yet decided. Some tables are genuinely matrix-shaped: a 19-column
payroll grid, a period comparison, a seat-utilisation roll-up. Turning those into cards destroys
the comparison the table exists to make, and `DataTable` already has `mobileMode: "table"` for
exactly this — but nothing in the codebase uses it, and no phase has established when it is the
right answer.

Doing that first gives the remaining deferrals in §6 a rule to follow, rather than each one
being argued from scratch.

The blank-header title fix (§7) is the other candidate, and is a smaller, well-specified change.
