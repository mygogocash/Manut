# Phase 8A — Accounting responsive conversion

**Zero API, database, Prisma, RBAC, auth, business-logic or dependency change.**
No breakpoint invented or moved. No component rewritten. No desktop layout altered —
measured byte-identical at 768 → 1920.

---

## 1. Headline

Phase 8 ranked accounting the highest-risk remaining module on static signals: 19 DataTables,
16 fixed-px grid templates, 37 `min-w-[]`, 14 `w-[]`, 19 forms, 25,374 lines.

**Every one of those signals turned out to be a false positive.** Accounting's layout is
substantially better built than the score implied, and this report says so rather than
manufacturing changes to justify the phase.

**The one real defect was invisible to every static signal**, because it is not a layout
problem at all: on a phone, an accounting list card showed the document number and two
descriptive columns and **hid the amount, the due date and the status behind a tap.** That is
a module-wide information-priority defect in the surface accountants actually scan.

---

## 2. Inventory

| | Count |
|---|---|
| Routes | 2 (`accounting/page.tsx`, `accounting/invoices/[id]/print/page.tsx`) |
| Components | 54 (25,374 lines) |
| DataTables | 19 · **15 action columns, all already annotated** by Phase 8 |
| Dialogs / sheets | 29 dialogs · 1 sheet |
| Forms | 19 |
| `w-[Npx]` | 14 |
| `min-w-[Npx]` | 37 |
| Fixed-px `grid-cols-[…]` | 16 |
| `overflow-x-auto` | 5 |

---

## 3. The five static signals that were not defects

Each was measured at **320 · 375 · 390 · 430 · 768 · 834 · 900 · 1023 · 1024 · 1280 · 1440 ·
1920** on WebKit, in a temporary harness reproducing the real class strings and templates
with hostile financial values. **Page overflow 0 and uncontained elements 0 at every width,
in every case.**

| Signal | Why it is not a defect |
|---|---|
| **16 fixed-px line-item grids** in the document dialogs — quote/credit-note/PO `1fr_70px_100px_70px_100px_32px` (372px fixed), invoice `…_80px_110px_110px_32px` (332px), journal (232px), opening-balances (272px), PO tab (180px) | At 320px the quote grid renders 434px wide inside a 288px dialog — and `DialogContent` **scrolls** it (`scrollWidth 467` vs `clientWidth 288`). Contained, reachable, and exactly the standard the brief set: a horizontally scrolling accounting table is acceptable. |
| `corporate-finance-overview` `grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]` | Prefixed `xl:` — never applies below 1280px. |
| Its toolbar: a 180px select and two 160px date inputs | `flex flex-wrap` — measured wrapping at 320px, container `288/288`, no overflow. |
| `invoices-tab` / `journals-tab` / `quotes-tab` toolbars | `flex flex-col gap-2 … md:flex-row` — stacks below 768px. Measured `288/286` at 320px. |
| The 37 `min-w-[]` | All on filter `SelectTrigger`s inside those wrapping/stacking toolbars — **none is a table column width**. |

Two further things were confirmed already correct rather than assumed: the shared `Table`
wrapper (`components/ui/table.tsx:22`) already carries `overflow-x-auto`, and `expense-tab`'s
one `grid grid-cols` is `grid-cols-1 … sm:grid-cols-2`.

### Money under hostile values

Rendered `0`, `1`, `999`, `999999`, `9999999`, `999999999`, `999999999999`,
`99999999999999`, `-999999999999`, `1234567890.12`, a 29-char status and a 54-char
counterparty through the real `DataTable`:

**`cutMoney = 0` at all twelve widths.** No money value is ever visually clipped — the
accounting-specific hazard, because a clipped figure reads as a *different number*. Wide
tables scroll; they do not truncate.

---

## 4. The real defect

### What was wrong

`deriveMobileRoles` promotes the first two unannotated columns to visible card fields and
puts the rest behind the expander. Accounting column orders are `identifier, descriptor,
descriptor, amount, dates, status` — so with only `mobileRole: "actions"` declared (the state
Phase 8's action sweep left them in), the amount and the status were always in the tail.

Measured on WebKit, real `DataTable`, real `invoices-tab` column order:

| Width | Visible on the card |
|---|---|
| 320 · 375 · 390 · 430 | `Invoice No` · `Type` · `Counterparty` |
| | **amount — absent. status — absent. due date — absent.** |

`Type` — the least useful of the seven columns — was the one promoted.

**16 column arrays across 15 files** were affected: invoices, expense, quotes, purchase
orders, credit notes, journals, bank, fixed assets, accounts, disposal queue, count panel
(×2), deferred tax (×2), remeasurement, transfer (×2), depreciation run.

### What changed

Declared roles on the existing columns — **no new capability, no new component, no
`cardBreakpoint`**, using only what Phase 7B-0 built:

```ts
{ key: "invoiceNo",    mobileRole: "title"    as const, … }
{ key: "counterparty", mobileRole: "subtitle" as const, … }
{ key: "status",       mobileRole: "badge"    as const, … }
{ key: "amount",       mobileRole: "field"    as const, … }
{ key: "dueDate",      mobileRole: "field"    as const, … }
{ key: "type",         mobileRole: "detail"   as const, … }
```

The shape applied throughout: **identifier is the title, the counterparty is the subtitle,
status is the badge, and the two visible fields are the amount plus the date that drives
action.** Everything else goes behind the tap.

Per-table judgements rather than a blanket rule:

- **bank** — `description` becomes the title, not `date`. A card headed "01 Sept 2026" tells
  you nothing; a bank line's identity is what the transaction was.
- **journals** — `totalDebit` is the visible figure. A balanced entry has debit === credit.
- **fixed assets** — `netBookValue`, not `purchasePrice`. NBV is live; cost is history.
- **disposal queue** — `gainLoss`, the number the disposal decision turns on.
- **count panel** — `variance`, which is the entire point of a physical count.
- **deferred tax** — `deferredTax` and `temporaryDifference`, the outputs. `bookCarrying` and
  `taxWdv` are the inputs: the card shows the answer, the tap shows the workings.

**127 insertions, 0 deletions across 17 files** (three of those are Phase 8's action
annotations already in the tree).

### Measured result

| Width | Mode | Before | After | Card height | Overflow |
|---|---|---|---|---|---|
| 320 | cards | amount – status – due – | **amount ✓ status ✓ due ✓** | 314 → **304** | 0 |
| 375 · 390 · 430 | cards | amount – status – due – | **amount ✓ status ✓ due ✓** | 274 → **268** | 0 |
| 768 → 1920 | table | all seven visible | all seven visible, **82px, identical** | — | 0 |

The card is **shorter** after the change: the promoted figures replaced expander scaffolding
rather than adding to it. Desktop is provably untouched — `mobileRole` has no effect above
the card breakpoint.

### Five figures deliberately left behind the tap

Named, with reasons, in `DELIBERATELY_BEHIND_THE_TAP` in the test — so the guard cannot
report them and a reader cannot mistake them for oversights: `totalCredit`, `purchasePrice`,
`bookCarrying`/`taxWdv`, `carryingBefore`/`balancesAfter`, `profitOrLoss`/`oci`,
`costTransferred`/`accumulatedTransferred`, `nbvDisposed`, `expectedQuantity`. Each is a
second copy of, or an input to, a figure the card already shows.

---

## 5. Regression guard

`components/accounting/__tests__/accounting-money-visibility.test.tsx` — 5 tests:

1. **Render**, real `DataTable` at 375px: amount, status and due date present without expanding.
2. **Render** at 1280px: `<table>` with all seven values.
3. **Not a tautology** — feeds the pre-fix shape to `deriveMobileRoles` and asserts the amount
   *does* land in `details`, so the test documents the defect it prevents.
4. **Guards the guard** — 16 arrays / 31 money columns found; fails loudly if the parser breaks.
5. **Source invariant** — every money column in every accounting DataTable must be surfaced or
   explicitly deferred with a reason.

It calls the **real exported `deriveMobileRoles`** rather than reimplementing its semantics, so
it cannot drift from the implementation.

**Verified by breaking it**: deleting the one `mobileRole` line from `invoices-tab`'s `amount`
column produced

```
invoices-tab.tsx [array 0] hides "amount" behind the expander
Tests  1 failed | 4 passed (5)
```

then restored.

---

## 6. Two errors of my own, recorded

1. **The first attempt to break the guard proved nothing.** My edit used six spaces of
   indentation where the file has eight, so it silently no-opped and the test "passed". I read
   that as the guard being broken; it was my probe. Re-done by line number, the guard fired
   correctly. A verification that cannot fail is not a verification.

2. **The guard was blind to two thirds of the module.** Its regex required `,\n`, and **37 of
   the 54 files in `components/accounting` are CRLF** — `,\r?\n` was needed. The thresholds
   passed anyway (15 arrays, 30 money columns), so nothing looked wrong. Fixed, and coverage
   went to 16 arrays / 31 columns / 15 files, picking up
   `fixed-asset-depreciation-run-panel.tsx`. The `\r?` now carries a comment saying why, since
   it looks like noise and is not.

Both are the same failure mode: a clean result from an instrument nobody checked.

---

## 7. Verification

| | Result |
|---|---|
| Unit / integration | **2,632 passed** (1,958 API + 674 web) — was 2,627; +5 new |
| type-check | **10/10 clean** |
| lint | **0 errors** (one import-order error in the new test, autofixed) |
| Production build | **exit 0**, 96 static pages |
| Mobile 320 · 375 · 390 · 430 | **PASS** — amount/status/due visible, 0 overflow, actions @ 44px |
| Tablet 768 · 834 · 900 · 1023 | **PASS** — table, 0 overflow |
| Desktop 1024 · 1280 · 1440 · 1920 | **PASS** — identical to pre-change |
| Money hostile values (10 magnitudes) | **PASS** — `cutMoney = 0` at all widths |
| Dialog line-item grids | **PASS** — contained and scrollable at 320px |
| WebKit (iPhone 13 / iPad profiles) | **PASS** — all measurement ran on WebKit |
| Physical device | **NOT TESTED** |
| Accessibility | **NOT RE-RUN** — no accessible name, role or contrast changed |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The temporary measurement harness (`app/acct-check/page.tsx` and two probe specs) was
**deleted**; `GET /acct-check` returns **404** and the route is absent from the build
manifests.

---

## 8. Authenticated verification

**PENDING DEV/STAGING VERIFICATION AFTER MERGE.**

No credential was used, created, or searched for; the rotated System Admin credential was not
touched. Accounting is entirely behind auth, so what is verified is the **mechanism** — the
real `DataTable`, the real column orders, at twelve widths — not each tab's own page. The
source invariant makes a silent revert impossible; per-tab visual confirmation remains.

---

## 9. Known limitations

1. **No authenticated accounting page was rendered** (§8). The column arrays were read from
   source and driven through the real component, not observed in situ.
2. **Card field selection is a product judgement.** Which two figures deserve the visible
   slots (§4) is defensible, not proven; an accountant reviewing the cards may reorder them.
   Each is a one-line change.
3. **No physical device.**
4. **Chromium and Firefox Playwright binaries absent** — browser measurement was WebKit only.
5. **The 19 forms and 29 dialogs were audited for containment, not for usability.** They
   overflow nowhere at any width, and the pointer-aware 16px input rule from Phase 7F applies
   through the shared `Input`/`Textarea`; whether a 372px line-item editor is *pleasant* to use
   on a 320px phone is a separate question from whether it is reachable.
6. **The guard covers `components/accounting` only.** The same defect almost certainly exists
   in hrms and sales-revenue — see below.

---

## 10. Recommended next phase

**The money-visibility defect is not an accounting defect.** It is what
`deriveMobileRoles`' default does to any column order that puts its identifier first and its
figures in the middle — which is every business list in this repository.

Phase 8 annotated 45 action columns across 25 modules and left every one of those tables with
`anyDeclared === false`, so all of them still promote columns 2 and 3 and bury the rest.
**hrms (10 tables) and sales-revenue (4 tables, 6 fixed grids)** are the largest remaining
cases and were already the next-ranked modules.

The cheaper structural option worth considering first: give `DataTable` a way to say "this
column carries the figure" rather than requiring five roles per table — or reconsider whether
promoting *the first two columns* is the right default at all, given that no module measured
so far has wanted it.
