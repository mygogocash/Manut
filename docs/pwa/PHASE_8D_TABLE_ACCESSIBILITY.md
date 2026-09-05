# Phase 8D — Shared table accessibility and mobile hardening

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.**
No breakpoint invented or moved. No second table system. No consumer touched.
Desktop measured identical at 1280/1440/1920.

---

## 1. Shared table architecture

```
components/ui/table.tsx          Table · TableHeader · TableBody · TableFooter
                                 TableRow · TableHead · TableCell · TableCaption
      ↑ used by
components/shared/data-table.tsx DataTable — table path AND card path
      ↑ falls back to
components/shared/responsive/    RecordCard — the mobile card
```

`Table` renders a wrapper `<div data-slot="table-container">` that owns the horizontal
scroll context, with the `<table>` inside it. `DataTable` chooses between that path and the
`RecordCard` path from `mobileMode` + `cardBreakpoint`.

**All four changes in this phase are in `ui/table.tsx` and `shared/data-table.tsx`. No
consumer changed.** That is the point of the phase.

---

## 2. Root causes — measured, not assumed

| P3 finding | Origin | Evidence |
|---|---|---|
| Table actions 24px | **Consumers**, fixable in the primitive | `size="xs"` is `h-6` in `ui/button.tsx`, chosen at 75 call sites. Changing the size would resize every button everywhere; the *hit area* can be fixed once in `TableCell`. |
| Scroll container not focusable | **Table primitive** | `tabIndex: -1`, no `role`, no name |
| No `<caption>` | **DataTable** | `TableCaption` already exists and is exported — and unused. The real gap was different: `DataTable` renders `title` as a visible `<h3>` and **never associates it with the `<table>`**. `aria-labelledby: null`, `aria-label: null`, `caption: null`, `headingText: "Plain table"`. |

A fourth finding surfaced from the axe scan and is fixed here too: **the actions column's
`<th>` is empty**, which is an `empty-table-header` violation on every DataTable that has one.

---

## 3. Mobile action target

### Measured first

| | Card mode | Table mode |
|---|---|---|
| Painted control | 44px | **24px** |
| Row height | — | **46–47px** |
| Gap between consecutive rows' controls | — | **23px** |

**A 44px target fits inside a 46px row.** That single measurement is what makes the fix safe
and is why no row needed to get taller — the brief's explicit warning.

### The change — `TableCell`

A `::after` overlay grows the **hit area** to 44px without touching the painted size, applied
`max-md:` so desktop is untouched:

```
max-md:[&_button]:relative
max-md:[&_button]:after:absolute  max-md:[&_button]:after:inset-x-0
max-md:[&_button]:after:top-1/2   max-md:[&_button]:after:h-11
max-md:[&_button]:after:-translate-y-1/2
max-md:[&_button]:after:content-['']
```

(and the same for `a`). `inset-x-0` spans the control's own width, so two controls side by
side cannot overlap horizontally; 44px inside a 46px row means two rows cannot overlap
vertically.

### Verified

- Measured at 320/375/390/430: painted **24px**, hit area **44px**.
- **1280/1440/1920: `::after` content is `none`.** The `max-md:` rule does not leak, and the
  button is still exactly 24px.
- **Click safety, on WebKit:** clicking 8px *above* and 8px *below* the visual button both
  registered on **that** button — never a neighbour.

Phase 7F's lesson was live here: Tailwind will silently emit nothing for a variant it cannot
compose, so the overlay's height was **measured through `getComputedStyle(el, "::after")`**
rather than assumed from the class being present in the source.

---

## 4. Scroll region

`role="region"` + `tabIndex={0}` on every container would add a tab stop to all ~93 tables,
most of which never scroll. So the tab stop is added **only while the table is actually wider
than its container**, detected by one `ResizeObserver` per `Table` watching the container and
the table.

```ts
const next = container.scrollWidth > container.clientWidth + 1;
setScrollable((prev) => (prev === next ? prev : next));
```

`setScrollable` only ever receives a changed boolean, so a resize that does not cross the
threshold causes no re-render (Part N).

**`role="region"` is claimed only when the table has a name to borrow** — an unnamed region is
itself a violation. An unnamed scrolling table still becomes focusable; it just does not
pretend to be a landmark.

### Verified

| | Result |
|---|---|
| 390px: containers / scrolling / focusable | **4 / 3 / 3** — the narrow table gains **no** tab stop |
| 1280px | **7 / 6 / 6** |
| Focus | lands on `data-slot="table-container"`, `role="region"` |
| Arrow keys | scrolled the focused region `0 → 120` |
| Control inside | still reachable and scrolled into view |

The negative case is asserted explicitly in the probe, because a fixture where every table
scrolls would have proved nothing.

---

## 5. Caption / accessible name

**No `<caption>` was added.** The application already shows the table's name — `DataTable`
renders `title` as a visible `<h3>`. A caption would duplicate a heading the user can see,
which Part D warned against. The heading is given an id and the table points at it:

```tsx
<h3 id={titleId}>{title}</h3>
<Table aria-labelledby={title ? titleId : undefined}
       aria-label={title ? undefined : ariaLabel} />
```

Additive: no consumer changes, no visual change. A new optional `ariaLabel` prop names a table
that has no visible title; when `title` is set it is ignored rather than naming the table twice.
The scroll region borrows the same name.

### Blank headers

An empty `<th>` is an `empty-table-header` violation and leaves the actions column unnamed in
a screen reader's row walk. `DataTable` now emits an `sr-only` label when `header` is empty:
`mobileLabel` if the caller gave one, otherwise the key humanised (`actions` → "Actions",
`rowNo` → "Row No", `last_seen` → "Last seen"). **The header stays visually empty.**

---

## 6. Table semantics

Unchanged and re-verified: `<thead>` / `<tbody>` / `<tfoot>`, footer rows, sticky headers,
`aria-sort` on sortable headers, `aria-busy` on the body while loading, and Phase 8C's
`scope="col"` (confirmed present on all 19 headers at every desktop width).

**No ARIA role overrides native table semantics.** The only role added is `region`, on the
wrapper `<div>`, never on the table or its parts.

---

## 7. Accessibility scan

axe-core 4.13.0, on the table surface — plain table, table mode, actions, footer, sticky
header, horizontally scrolling table, and a table inside a Dialog — in **light and dark**, at
**390px and 1280px**.

| | Violations |
|---|---|
| **Before** | **1** in each of the four cases — `empty-table-header` (minor) |
| **After** | **0 in all four** |

Only the surfaces listed above were scanned. **No claim is made about the rest of the
application.**

Two of this phase's three fixes are improvements axe does not measure — it has no rule for
"a table has no accessible name" or "a scroll region cannot be focused" — so the 1 → 0 delta
understates the change. Said plainly rather than dressed up.

### A probe error, recorded

The first axe run reported **`color-contrast × 10` (serious) in mobile light**. It did not
reproduce. Running with `--workers=1` gave 1 violation in all four cases, consistently: four
Playwright workers sharing one dev server had caught the dialog mid-animation, so axe measured
text against a transitional overlay background. **Not a real finding.** It would have been
reported as a serious contrast regression on the strength of one run.

---

## 8. Keyboard and touch

| | Result |
|---|---|
| Tab to the scroll region | **PASS** — only when it scrolls |
| Arrow keys scroll it | **PASS** — `scrollLeft 0 → 120` |
| Tab to a control in an off-screen column | **PASS** — scrolled into view |
| Activate a control | **PASS** |
| Focus ring on the region | `focus-visible:ring-2` added |
| WebKit iPhone 13 | **PASS** — all of the above |
| WebKit iPad Mini | **PASS** — Phase 8C's runs, unchanged by this phase |

---

## 9. Hostile data and widths

53-char column header, 56-char employee name, 37-char reference, 41-char status, 78-char URL,
`9,999,999,999,999.00`, `-999,999,999.99`, and a 19-char action label, at
**320 · 375 · 390 · 430 · 768 · 834 · 900 · 1023 · 1024 · 1280 · 1440 · 1920**:

**`pageOverflow = 0`, `uncontained = 0`, `clipped = 0` at every width.** The `hit44` overlay
appears only below 768; the narrow table never gains a tab stop at any width.

---

## 10. Desktop regression

At 1280 / 1440 / 1920: header order, header widths, header height (33px), row height (47px),
action size (24px), sticky behaviour, footer and `scope` count all identical, and the
`::after` overlay is absent. Sorting and pagination are covered by the existing DataTable
suite, which passes unchanged.

---

## 11. Tests

`components/shared/__tests__/table-accessibility.test.tsx` — **15 tests**: accessible name
wiring (4) · blank-header labels (4) · scroll region conditions (4) · preserved semantics (3).

jsdom cannot measure layout, so hit-area size, scroll thresholds and tab-stop counts are
asserted in the browser probe; the unit tests assert the wiring, the labels and the
conditions. `scrollWidth`/`clientWidth` are stubbed to simulate the overflow threshold.

**Every invariant verified by breaking it** (Part M):

| Break | Result |
|---|---|
| Remove `aria-labelledby` wiring | **2 failed** |
| Make the region always focusable | **1 failed** |
| Remove the `sr-only` blank-header label | **2 failed** |
| Remove the mobile hit overlay | **1 failed** |
| Restored | **15 passed** |

Phase 8's action-role guard, 8A's money-visibility guard, 8B's hierarchy guard and 8C's
title-derivation and `mobileMode` guards all still pass, unweakened — 274 tests across
`shared` + `accounting`.

### A latent bug in the test setup

`src/test/setup.ts` stubbed `ResizeObserver` as `vi.fn().mockImplementation(() => ({…}))`. A
mock whose implementation is an **arrow function cannot be called with `new`**, so the stub
threw *"is not a constructor"* the first time a component actually constructed one — this
phase's `Table`. Nothing had done that before, so the bug sat there harmlessly. Replaced with
a class.

---

## 12. Verification summary

| | Result |
|---|---|
| Unit / integration | **2,691 passed** (1,958 API + 733 web) — was 2,676; **+15** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| axe (table surface, 2 themes × 2 widths) | **1 → 0** |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The harness (`app/ta-check/page.tsx`) and four probe specs were **deleted**; no references
remain and the build emits the same 96 pages.

---

## 13. Known limitations

1. **No authenticated page rendered.** Every shape was reproduced faithfully in a harness and
   driven through the real primitives, but no module's own page was visited.
2. **Chromium and Firefox binaries absent** — all browser measurement was WebKit.
3. **The axe scan covers the table surface only**, on a synthetic harness page. It is not an
   application-wide result and no WCAG conformance claim is made.
4. **The 44px hit area applies to controls inside a `TableCell`.** A control rendered outside
   one — in a toolbar, a footer row, a custom cell wrapper that is not `TableCell` — is
   unaffected. Not surveyed.
5. **The overlay assumes rows stay ≥44px.** They are 46–47px today. A future denser row
   variant would put two targets in contact; the invariant is measured in the probe, not
   enforced in code.
6. **One `ResizeObserver` per `Table`.** Negligible in practice — only a handful of tables are
   mounted at once — but it is a new observer that did not exist before, and it was added
   rather than reusing an existing mechanism because none measured element overflow.
7. **`role="region"` on a scrolling table adds a landmark** to the page's landmark list.
   Correct per APG, but a page with several wide tables will list several regions.
8. **No physical device.**

---

## 14. Remaining table work

The shared table surface is now, to the extent it can be verified without a session, done:
semantics, names, targets, keyboard, contained scrolling and a clean axe scan on every shape.

What remains is **not the table primitive**:

- 49 of 51 modules are unconverted at the page level — toolbars, filters, forms, dialogs,
  charts and detail layouts. Phase 8's inventory is still the map.
- Three marketing-analytics report tables are matrix-shaped and deferred (Phase 8C §7).
- 13 sheets widened by Phase 7F-1, still never visually reviewed.

---

## 15. Recommended next phase

**Authenticated verification of everything Phases 8–8D changed.** This is the fifth consecutive
phase whose central caveat is the same sentence, and the backlog behind it is now substantial:
45 action columns, 31 information-hierarchy conversions, 2 matrix tables, and four shared
primitive changes — all verified on faithful reproductions, none seen on its own page with real
data and a real session.

Every one of those changes is guarded by a test, so the risk is not silent regression; it is
that a *product* judgement is wrong — a field promoted that an accountant would not have
chosen, a table that should have stayed cards. That cannot be settled from source.

It needs exactly what Phase 7G-1 §9 specified and never got: a dedicated non-admin account and
a safe dataset. Until then, further phases keep adding to a queue that only a session can
drain.
