# Phase 9A — Global accessibility hardening

**Two source files changed**: `components/ui/select.tsx` and
`app/(dashboard)/messages/page.tsx`, plus one test file.

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.** No consumer
edited. No visual change — select geometry measured identical at all twelve widths.

---

## 1. Baseline

Phase 9 carried two findings forward:

- **P1 candidate** — 444 `SelectTrigger` instances, only 1 with an `aria-label`. Explicitly
  recorded as an upper bound, not a defect count.
- **P2** — "97 of 104 dashboard routes do not expose an `<h1>`".

Both were re-measured before anything was changed. **One was much smaller than stated, and the
other was wrong.**

---

## 2. Select inventory — measured, not inferred

All 444 triggers were classified by naming mechanism, then each mechanism was **rendered from
the real primitives** and put through axe, because static classification cannot answer this: a
`<Label>` with no `htmlFor` sitting beside a Select looks like a label and names nothing.

| Pattern | Count | axe verdict |
|---|---|---|
| `FormControl` + `FormLabel` | **168** | **named** — `FormLabel htmlFor` → `FormControl id`, and `<button>` is a labelable element |
| `aria-label` | 13 | named |
| `aria-labelledby` | 0 | — |
| **visual `<Label>` sibling, no `htmlFor`** | **87** | **FAIL `button-name`** |
| **bare** | **176** | **FAIL `button-name`** |

**263 confirmed unnamed, not 443.** 181 were already correct — and the 168 form selects are the
ones a naive fix would have broken.

The root cause is not a missing attribute, it is a role rule: `role="combobox"` is **name from
author only**. It never takes its name from content, so a trigger displaying "All statuses" is
an unnamed control no matter how much text it shows.

---

## 3. Naming strategy

Part B's preference order was followed. The decisive observation:

**172 of the 265 unnamed triggers already carry the answer** — a `SelectValue placeholder`
reading "Status", "All departments", "Entity", "Type", "Role". That is the developer's own
description of the control, so it is used rather than a name being invented.

One change to `SelectTrigger`:

```ts
// aria-label, aria-labelledby or id present → do nothing
const placeholderLabel = React.useMemo(() => {
  if (props["aria-label"] ?? props["aria-labelledby"] ?? props.id) return undefined;
  …find the child SelectValue's string placeholder…
}, [children, props]);
```

Three properties, each load-bearing:

- **`aria-label` / `aria-labelledby` win.** They are spread after, so an explicit name is never
  overwritten. Verified: a trigger with `aria-label="Filter grants by status"` and
  `placeholder="All statuses"` announces the former.
- **A trigger with an `id` is skipped entirely.** This is the part that matters most.
  `FormControl` passes `id` so a visible `<FormLabel htmlFor>` resolves, and **`aria-label`
  outranks `label for`** in name computation. Without this condition the change would have
  silently replaced 168 real visible labels with their placeholders — "Department" becoming
  "Pick a department". Verified: the form pattern still announces "Department" and has **no**
  `aria-label` at all.
- **A placeholder is a weaker name than a real visible label.** It is far better than none, and
  it costs no consumer change and no visual change. Of the 172 derived names, **163 are specific**
  ("Status", "Entity", "All departments") and **6 are generic or dynamic** — listed in §10.

**Result: 172 of 265 named by one change to one file.**

### Controls intentionally unchanged

- The **168** `FormControl` selects — already named by their visible label, which is the better
  mechanism.
- The **13** with an explicit `aria-label`.
- **89 residual** (§10) — no placeholder, no label, no id. These need a per-site `htmlFor`/`id`
  association derived from the visible text next to them, which is 89 contextual judgements
  across 30 modules. Mass-editing them without reading each is exactly what Part O prohibits, so
  they are itemised rather than guessed at.

---

## 4. The `<h1>` finding was wrong

Phase 9 reported "97 of 104 dashboard routes have no `<h1>`". That count came from grepping for
the literal string `<h1` and **missed `PageHeader`, which renders an unconditional `<h1>`**
(`shared/page-header.tsx:50`).

Re-measured, following each thin route to the component it delegates to:

| | Count |
|---|---|
| Routes | **104** |
| Literal `<h1>` | 7 |
| `PageHeader` in the route file | 85 |
| `PageHeader`/`<h1>` in a named delegate | 10 |
| Bare `redirect()` — renders no markup | 1 (`deals` → `/sales`) |
| **Genuinely missing** | **1** |

**The real gap is one route, `/messages`, not 97.** And the `page-has-heading-one` violation
Phase 9's axe run reported was a **harness artifact**: that scan ran against `/hr-check`, which
had no `PageHeader`. The real HRMS page renders `<PageHeader title="HRMS" …>` at line 731.

### The one fix

`/messages` is a full-height chat shell where a visible title would take space the conversation
needs. It received a screen-reader-only heading using **the sidebar's own label**, not new copy:

```tsx
<h1 className="sr-only">Messaging</h1>
```

### Exceptions, individually

- **`deals/page.tsx`** — a bare `redirect("/sales")`. It renders no markup at all, so it has
  nothing to head. Recorded in `NO_HEADING_EXPECTED` with that reason.

---

## 5. Accessibility scan

axe-core 4.13.0 against all six real Select patterns plus the page heading, **light and dark**,
run serially.

| | Before | After |
|---|---|---|
| `button-name` | **2 of 6 patterns FAIL** (bare, sibling-label) | **0** |
| `aria-input-field-name` · `label` · `heading-order` · `page-has-heading-one` · `color-contrast` | 0 | **0** |
| Total violations | 2 | **0** |

Only the surfaces listed were scanned. **No application-wide WCAG claim is made.** In
particular the 89 residual triggers were not rendered, so they remain unmeasured individually —
their pattern is what was measured.

---

## 6. Responsive and desktop verification

At **320 · 375 · 390 · 430 · 768 · 834 · 900 · 1023 · 1024 · 1280 · 1440 · 1920**:

| | Result |
|---|---|
| Page overflow | **0 at every width** |
| Uncontained elements | **0 at every width** |
| `<h1>` count | **exactly 1 at every width** — no duplicate visible heading |
| Select geometry | **160×32 at every width, identical** |

The change adds an attribute and nothing else, so there is nothing for layout to react to —
but it was measured rather than asserted. Desktop at 1280/1440/1920: title position, typography,
toolbar position, select dimensions and form geometry all unchanged.

**WebKit iPhone 13: PASS.** iPad Mini not re-run — no geometry changed, and Phase 8D's runs
cover the shared primitives.

---

## 7. Tests

`components/ui/__tests__/select-accessible-name.test.tsx` — **12 tests**.

The asserted invariant is **"every user-facing combobox has an accessible name"**, never "every
combobox has an `aria-label`" — an associated visible label is the better answer and must keep
passing. `nameOf()` implements the same precedence order axe uses:
`aria-labelledby` → `aria-label` → `label[for]` → **nothing** (never content).

Covered: bare filter · sibling-label · explicit `aria-label` wins · explicit `aria-labelledby`
wins · an associated visible label is **not** replaced · a form select keeps its `FormLabel` ·
a trigger with no placeholder is **still unnamed** (documenting the 89 the primitive cannot
reach, so the suite cannot be mistaken for full coverage) · the primitive keeps both the
fallback and the `id` condition · every route has a heading · every named delegate still renders
one.

**Verified by breaking it:**

| Break | Result |
|---|---|
| Remove the select naming fallback | **3 failed** |
| Remove the `id` condition (would clobber 168 real labels) | **3 failed** |
| Remove the `/messages` `<h1>` | **1 failed**, naming the route |
| Break a named delegate (`projects-view`'s PageHeader) | **1 failed** |
| Restored | **12 passed** |

### Three drafts of the heading guard, recorded

The heading guard passed `/messages` with its `<h1>` deleted **twice** before it worked:

1. **Draft 1** followed every imported component looking for an `<h1>`, and found one inside a
   chat *sidebar widget*. A nested widget heading is not a page heading. Replaced with an
   explicit `HEADING_FROM_DELEGATE` allowlist — ten entries, each naming the component, which
   cannot be fooled and has to be read to be extended.
2. **Draft 2** matched `/\bPageHeader\b/`, which matched **my own prose comment** in the
   messages file explaining why the `sr-only` heading was there. Now matches the rendered
   element: `/<PageHeader[\s/>]/`.

Same lesson as the last three phases, in a new costume: the instrument was wrong before the code
was, and a guard that cannot fail is not a guard.

---

## 8. Verification summary

| | Result |
|---|---|
| Unit / integration | **2,721 passed** (1,958 API + 763 web) — was 2,709; **+12** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| axe (6 patterns × 2 themes) | **2 → 0** |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The harness (`app/a11y-check/page.tsx`) and two probe specs were **deleted**; no references
remain and the build emits the same 96 pages.

---

## 9. API / Database / RBAC / Dependencies

**NONE**, all four. The `SelectTrigger` change reads its own props and children and adds one
attribute; the `/messages` change adds one element.

---

## 10. Known limitations

1. **89 triggers remain unnamed** — no placeholder, no label, no id. By module: accounting 14,
   it-operations 6, marketing-analytics 6, leave 5, legal 4, projects 4, helpdesk 4, qa-crm 4,
   settings 4, admin 3, accounting-crm 3, legal-announcements 3, legal-crm 3, partners 3,
   sales-revenue 3, visa 3, it-crm 2, leads 2, product-crm 2, and 11 modules with 1 each.
   Most sit next to visible text that *is* the label ("Status", "Entity", "Kind", "Payout Mode",
   "Answer type"); the correct fix is `htmlFor`/`id` association per site.
2. **6 derived names are generic or dynamic**: `"Select"`, `"None"`,
   `"Select a reason (optional)"` (×2), a `label ?? "Select rating"` expression, and
   `shared/input-group.tsx`'s `placeholder ?? "Select…"`. These pass `button-name` but are weak
   names — better than unnamed, worse than a real label.
3. **The 89 were not individually rendered.** Their *pattern* was measured; they were not.
4. **axe covered the six Select patterns and the heading only** — not whole authenticated pages.
5. **No authenticated route was rendered.** The heading inventory is source-derived, following
   delegation by hand and then encoding it in an allowlist.
6. **`HEADING_FROM_DELEGATE` is maintenance.** Ten routes now depend on a hand-written mapping;
   a new thin route will fail the guard until it is added. That is deliberate — the alternative
   draft could not detect a deleted heading — but it is a cost.
7. **Chromium and Firefox binaries absent**; WebKit only. No physical device.

---

## 11. Remaining work

- The 89 residual triggers (§10.1) and the 6 weak derived names (§10.2).
- Everything else on this programme's list now needs an authenticated session.

---

## 12. Recommended next phase

**Authenticated verification.** This is now the seventh consecutive phase to end on the same
prerequisite, and the queue behind it has not stopped growing: 45 action columns, 31
information-hierarchy conversions, 4 matrix-table decisions, 5 shared-primitive changes, and
this phase's 172 newly-named controls — every one verified against faithful reproductions, none
seen on its own page with real data and a real session.

Every change is guarded by a test, so the exposure is not silent regression. It is that a
**product judgement** is wrong in a way no test can catch: a promoted field an accountant would
not have chosen, a placeholder that reads oddly as a screen-reader name, a table that should
have stayed cards.

The prerequisite has not changed since Phase 7G-1 §9: **a dedicated non-admin account and a safe
dataset in dev or staging.** Both are decisions for whoever owns the tenant. Until they exist,
further phases can keep improving what is measurable from source — and the measurable surface is
now close to exhausted.
