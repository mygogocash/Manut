# Phase 8C — Title derivation and `mobileMode="table"`

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.**
No breakpoint invented or moved. No new component. Desktop measured identical at 1280/1440/1920.

---

## 1. Objective

Two questions left open by Phase 8B:

1. Should `titleKey` skip control-only columns, given 8B measured five cards headed by a
   checkbox, a chevron or a row number?
2. When should a matrix-shaped table stay a **table** on mobile? `DataTable` has shipped
   `mobileMode="table"` since Phase 1 with **no production consumer** and no rule for using it.

---

## 2. Title derivation audit

`titleKey = explicit("title")[0] ?? usable[0]?.key ?? ""` — the first column in declaration
order, whatever it renders. `usable` excludes only `mobileRole: "hidden"`.

Every column array in the repository was classified before anything was changed:

| Case | Count | Finding |
|---|---|---|
| **Control-only first column** | **2** | `crm-tasks/tasks-tab`, `sales-revenue/tasks-tab` — both a `<Checkbox>`. Both already carry explicit roles from 8B. |
| **Actions column declared first** | **0** | Never used — but `usable[0]` *would* have taken it. Latent. |
| **`title === actions` collision** | **0** | |
| **Blank-header IDENTIFIER** | **2** | `it-operations` heads its request-number column **`"#"`**. This column *is* the record's identifier. |
| **Blank-header, other** | **4** | All parser false positives: an `ImportFieldSpec[]`, two tab-key arrays, and a `segments` array declared inside a render function. |

The `"#"` case is the one that decided the shape of the rule. Part B warned that a blank
header does not imply chrome, and the counter-example was already in the tree.

### The constraint

`deriveMobileRoles` receives column **descriptors**. It has no row data, so it cannot ask what
a cell renders. The only signal available is the header — which is exactly why a naive
"skip blank headers" rule would have broken `it-operations`.

---

## 3. Decision — implemented, and provably a no-op today

```ts
const titleCandidates = usable.filter((c) => c.key !== actionsKey);
const labelled = titleCandidates.find((c) => (c.header ?? "").trim() !== "");
const titleKey =
  explicit("title")[0] ?? labelled?.key ?? titleCandidates[0]?.key ?? usable[0]?.key ?? "";
```

Three properties, each deliberate:

- **Skip only a completely empty header.** `"#"` is not empty, so an identifier with a
  presentation-only header stays titleable.
- **Only while a labelled column remains.** A table whose headers are *all* blank keeps its old
  title rather than losing one.
- **Never the `actions` column.** An action control is not a heading under any reading.

**Measured across all 93 column arrays: zero titles change.** This is a guard against the next
table, not a migration. The skipped column is passed over for the *heading* only — it still
appears as a field or detail; only `mobileRole: "hidden"` removes a column.

**Phase 8B's conclusion is preserved untouched.** Positional promotion of columns 2 and 3 is
unchanged, and a test asserts it.

---

## 4. Title derivation tests

`components/shared/__tests__/title-derivation.test.tsx` — **12 tests** asserting the **rendered**
card heading, not the derivation's return value, because the defect was one a user could see.
A `data-slot="record-card-title"` attribute was added to `RecordCard` so the heading can be
asserted without matching on typography classes (attribute only — no role, no visual change).

Covered: checkbox first · row number first · chevron first · **actions first** · explicit title
first · explicit title last · identifier with a `"#"` header · all-headers-blank fallback ·
normal identifier first · skipped column still available as a field · `hidden` still honoured ·
8B's promotion rule intact.

**Verified against the old implementation.** Reverting `titleKey` produced exactly the defect:

```
× 1. a leading checkbox    AssertionError: expected ''     to be 'REQ-2026-0042'
× 2. a leading row number  AssertionError: expected '1'    to be 'REQ-2026-0042'
× 3. a leading chevron     AssertionError: expected '›'    to be 'REQ-2026-0042'
× 4. an actions column     AssertionError: expected 'Edit' to be 'REQ-2026-0042'
Tests  5 failed | 7 passed (12)
```

The seven that should be unaffected passed under both rules, so the change does not over-reach.
Test 4 is the interesting one: an actions-first column really would have rendered **"Edit"** as
the card heading.

---

## 5. `mobileMode` audit

`mobileMode: "table"` forces `asCards = false` at every width. The `Table` wrapper is
`relative w-full overflow-x-auto`, so the table scrolls **inside its own container**.

Measured on WebKit (iPhone 13 and iPad Mini) with the real 19-column payslip shape:

| | Result |
|---|---|
| Contained horizontal scroll | **YES** — 2781px inside a 356px container, `overflow-x: auto` |
| Page overflow | **0 at all 12 widths** |
| Sticky header, vertical | **YES** — 14 rows, scrolled 300px, header moved **0px** |
| Sticky header, horizontal | **YES** — after `scrollLeft = 400` the header cell stays **aligned with its column** (±1px) |
| Action columns | reachable; **24px** target (vs 44px in a card) |
| Keyboard | focusing the far-right action **scrolled it into view** (`scrollLeft` 0 → 2441, inside viewport) |
| Clipped values | **0** |

### The finding that generalises

`footer` is rendered at `data-table.tsx:782`, **inside the `<Table>` element**. The card path
never renders it.

**Any DataTable that passes a `footer` silently loses its totals row below 768px.** Not behind
the expander — absent. Two consumers do: the payroll payslip grid and the fixed-asset
depreciation run.

---

## 6. The matrix rule

A table stays a **table** on mobile when the row is a *measurement across columns* rather than a
*business record*, and specifically when either of these holds:

1. **It carries a `footer`.** A totals row is a statement about the columns, and the card path
   drops it. This one is objective and now enforced by a test.
2. **The comparison is down the columns, and the card cannot carry it.** Cross-check: would the
   user scan this to answer "is anything wrong across these?" rather than "what is this record?"

Supporting signals — none sufficient alone: many columns; column arithmetic that must be seen
(`base + allowances − deductions = total`); the row naming a category rather than a record.

**Column count alone is explicitly not sufficient.** A seven-column invoice list is still a
record list; a three-column depreciation roll-up is still a matrix.

---

## 7. Candidates and decisions

Seven candidates found by scanning for arrays where ≥50% of columns are measures, plus the
footer detector.

| Table | Why matrix-like | Card mode | Table mode | Decision |
|---|---|---|---|---|
| **payroll-run-detail-sheet** (19 cols, footer) | 13 measures; base + allowances − deductions = total; run is read down its columns | **0/12 figures visible**; expanded card 645px / 19 rows; **totals absent at any depth** | 12/12, totals present, 2781/356 contained, sticky OK | **TABLE** |
| **fixed-asset-depreciation-run-panel** (3 cols, footer) | Charge per category; footer is the run total | **totals MISSING** | totals YES, 417/286 contained | **TABLE** |
| attendance dept roll-up (7 cols) | 6 counts per department | department + headcount + **attendance % all visible**; counts are the workings | 775/286 — scroll for no gain | **CARDS — no change** |
| IT seat utilisation (9 cols) | 5 seat/cost measures | 8B surfaces utilisation %, monthly cost, potential savings | — | **CARDS — no change** |
| marketing reports ×3 (6 cols each) | expected vs actual vs performance % | **no footer**, so no information loss | not measured | **DEFER** |

Two of seven need table mode. The other five are the answer to "do not assume every candidate
needs it": the attendance roll-up's comparison metric is *already* on the card, and each seat-
utilisation row is a subscription somebody acts on individually.

---

## 8. Payroll analysis

The record-detail workflow for a payslip already exists — `onRowClick` opens the edit dialog.
The table is not that workflow; it is the reconciliation view for a **run**. Against the eight
criteria: all eight hold. Measured at 390px:

| | Cards | Table |
|---|---|---|
| Financial values visible | **0 / 12** | **12 / 12** |
| Run totals | **not rendered at all** | present |
| Height per employee | 272px collapsed → **645px expanded**, 19 labelled rows | one row |
| Clipped numbers | 0 | 0 |
| Action target | 44px | 24px |

Hostile values covered every case Part G asked for, including `9,999,999,999,999.00`,
`-999,999,999.99`, the Indian grouping `99,99,99,999.00`, `0.00`, `-0.01`, a 56-character
employee name and a 49-character position. **`cut = 0` everywhere** — no amount is ever
visually truncated, which matters more than any of it, because a clipped figure reads as a
different number.

---

## 9. Accessibility

| | Result |
|---|---|
| Table semantics in table mode at 390px | `role=table`, 19 header cells, 18 with text (the 19th is the actions column) |
| Keyboard reach to scrolled-off columns | **PASS** — focusing the far-right control scrolls it into view |
| `aria-sort` on sortable headers | present (unchanged) |
| `aria-busy` on the body while loading | present (unchanged) |
| Card expander | unchanged from 8B: `<button>`, `aria-expanded`, toggles on Enter |
| **`scope="col"` on `<th>`** | **was missing — added** |

`scope="col"` is the one accessibility change. Nineteen unlabelled cells per row is not readable
by screen reader, and this phase put exactly that on a phone. Verified safe: none of the 260
`TableHead` usages sits inside a `TableBody`, so every one is a column header. Declared before
`{...props}` so a caller can override. Confirmed applied — `scopes=19` at all desktop widths.

**No WCAG compliance claim is made** — no automated scanner was run in this phase.

---

## 10. Verification

| | Result |
|---|---|
| Unit / integration | **2,676 passed** (1,958 API + 718 web) — was 2,656; **+20** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| Mobile 320 · 375 · 390 · 430 | **PASS** — page overflow 0, scroll contained, 12/12 values |
| Tablet 768 · 834 · 900 · 1023 | **PASS** |
| Desktop 1024 · 1280 · 1440 · 1920 | **PASS** — header order and widths identical; `mobileMode` provably mobile-only |
| WebKit iPhone 13 | **PASS** |
| WebKit iPad Mini | **PASS** |
| Chromium | **NOT RUN** — binary absent |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The harness (`app/mm-check/page.tsx`) and four probe specs were **deleted**; no references
remain and the build emits the same 96 pages.

---

## 11. Tests added

- `title-derivation.test.tsx` — 12 (§4)
- `mobile-mode-table.test.tsx` — 8: table renders at 320px · all financial values visible ·
  totals row kept · action reachable · **card mode drops the totals row** (the measured defect,
  asserted so the file documents what it prevents) · desktop byte-identical between modes ·
  guards-the-guard · **the invariant: a `footer` implies `mobileMode="table"`**

Both new guards were verified by breaking them. Phase 8's action-role guard, 8A's
money-visibility guard and 8B's hierarchy guard all still pass, unweakened.

---

## 12. Known limitations

1. **No authenticated page rendered.** Column shapes were reproduced faithfully from source and
   driven through the real component; the payroll sheet's own page was not visited.
2. **Chromium and Firefox binaries absent** — all measurement was WebKit.
3. **Table rows give actions a 24px target**, against 44px in a card. It is the same size the
   control is on desktop, and the alternative loses the totals row entirely — but on a phone it
   is smaller than the programme's own floor. **P3.**
4. **The scroll container is not itself focusable** (`tabIndex = -1`, no `role="region"`). Every
   *control* is reachable (measured), but a keyboard user cannot scroll the container to *read*
   a column that contains no focusable element. Adding `tabIndex={0}` would add a tab stop to
   ~93 tables, which is a global behaviour change and is therefore reported, not made. **P3.**
5. **No `<caption>` on any table.** Pre-existing. **P3.**
6. **Three marketing-analytics report tables are matrix-shaped and deferred** (§7), unmeasured.
7. **No physical device.**
8. **Parser false positives are a recurring cost.** Four of the six blank-header candidates were
   not column arrays at all. The heuristic (`const x = [` / `columns={[`) cannot distinguish a
   column array from any other array of objects with a `key`. Every finding in this phase was
   confirmed by reading the file before acting on it.

---

## 13. Remaining work

- The three deferred marketing-analytics report tables (§7), now with a rule to judge them by.
- The three P3 accessibility items (§12.3–5), which are shared-`Table` concerns rather than
  DataTable ones.
- 49 of 51 modules remain unconverted at the page level — toolbars, filters, forms, dialogs,
  charts and detail layouts. Phase 8's inventory is still the map.

---

## 14. Recommended next phase

**The shared `Table` accessibility pass** — `scope="col"` landed here because a 19-column matrix
forced it, but the same table primitive still has no `<caption>`, no focusable scroll region,
and a 24px action target on mobile. All three affect every table in the application, all three
are cheap, and all three are exactly the kind of global change that needs its own measured pass
rather than being smuggled into a feature phase. It would also be the first phase in this
programme to run an actual accessibility scanner against the table surface, which would replace
several "NOT RE-RUN" rows with evidence.
