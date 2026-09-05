# Phase 7F — P2 remediation

**Status:** P2-A and P2-B fixed and verified. **P2-C reproduced, measured, and deliberately
not fixed** — consumer-scoped fixes are insufficient, so per the phase's own Step 17 it
stops here with evidence.

**No API, database, migration, RBAC, auth, business-logic or dependency change.**

---

## 1. Baseline and final

| | Before | After |
|---|---|---|
| Unit tests | 2,598 (1,958 API + 640 web) | **2,614** (1,958 + 656) — **+16** |
| type-check | 10/10 | **10/10** |
| lint | 0 errors | **0 errors** |
| E2E (WebKit) | 1 passed, 1 skipped | **2 passed, 0 skipped** |
| Production build | exit 0 (Phase 7E) | not re-run — no build-affecting change |

No test was weakened. One `test.skip` was **removed**, not added (§4).

---

## 2. P2-A — tablet input sizing · FIXED

### The finding

Both shared text-entry primitives carried `text-base md:text-sm`. That encodes
**"768px or wider is a desktop"** — an assumption an iPad Mini (768px, touch) disproves.
iOS Safari zooms the viewport whenever a focused field computes under 16px and never zooms
back out. Phase 7E measured **14px on sign-in and 13px in task detail** on the iPad profile.

### Inventory

| Component | Mobile | ≥768 (before) | 768px result | 16px required? |
|---|---|---|---|---|
| `ui/input.tsx` | `text-base` | `md:text-sm` | **14px** | yes — text entry |
| `ui/textarea.tsx` | `text-base` | `md:text-sm` | **14px** | yes — text entry |
| `SearchInput` | inherits `Input` | inherits | 14px | yes, via the primitive |
| `SelectTrigger` | `text-sm` | — | 14px | **no** — it is a `<button>`; iOS does not zoom on buttons (Step 4) |

Every text-entry control in the app routes through those two primitives, so the fix is one
central change, not a sweep.

### The fix

```diff
- md:text-sm
+ md:pointer-fine:text-sm
```

**Keyed to the pointer, not the width.** The condition that causes zoom is *touch*, and
`pointer: coarse` states it directly. This fixes every touch device at **every** width —
including iPad landscape at 1024+, which a breakpoint move to `lg` would have missed — and
changes nothing for a mouse at any width.

Compounded into one variant rather than layered as a separate `pointer-coarse:` utility, so
there is no source-order race between two same-specificity media queries.

`SelectTrigger` was left alone. Phase 7E flagged six of them at `text-xs`; they are buttons,
so the zoom claim does not apply, and no usability problem was demonstrated.

### Verification

| Context | Pointer | Before | After |
|---|---|---|---|
| WebKit iPhone 13, 390px | coarse | 16px | **16px** |
| **WebKit iPad Mini, 768px** | coarse | **14px** | **16px** |
| Chromium desktop, 1440px | fine | 14px | **14px — unchanged** |

Desktop typography is untouched, confirmed by measurement rather than assumption.

---

## 3. P2-B — global muted-text contrast · FIXED

### Contrast analysis

`--muted-foreground` is read against four backgrounds. Measured with the WCAG relative-
luminance formula:

| Theme | Token | background | surface | surface-2 | muted | Worst |
|---|---|---|---|---|---|---|
| **Light (before)** | `36 9% 65%` | 2.12 | 2.38 | 2.29 | 2.03 | **2.03 — fails** |
| **Light (after)** | `36 9% 41%` | 4.73 | 5.30 | 5.10 | 4.53 | **4.53 — passes** |
| **Dark (unchanged)** | `36 12% 68%` | 9.09 | 7.84 | 6.69 | 4.93 | **4.93 — already passed** |

**The dark theme already met AA and was deliberately not touched** (Step 10).

### Choosing the value

41% is the **lightest** lightness that clears 4.5:1 on all four light surfaces — 43% still
failed on `bg-muted` at 4.20. Hue (36) and saturation (9%) are unchanged, so it is the same
warm grey, just readable. `--foreground` is `36 33% 4%`, so muted text remains obviously
secondary; a test asserts that hierarchy so a future "fix" cannot darken muted text into
looking like primary text.

Candidates considered and rejected: 52%, 48%, 45%, 43% — all fail on at least one surface.

### axe results

`/sign-in`, real Chromium, axe-core 4.13.0:

| | Before | After |
|---|---|---|
| `color-contrast` (serious) | **4 nodes** | **0** |
| `landmark-one-main` (moderate) | 1 | 1 — unchanged, P3, structural |
| `region` (moderate) | 5 | 5 — unchanged, P3, structural |
| passes | 33 | 33 |

Both themes re-scanned: **no contrast violations in either.** The two remaining moderate
findings are about `/sign-in` lacking a `<main>` landmark — out of this phase's scope.

Because the token is global, this also fixes muted text across the dashboard, CRM, task
detail, forms and every surface built in Phases 7–8, which is why no consumer was edited.

---

## 4. P2-C — SheetContent width · REPRODUCED, NOT FIXED

### What was measured

A bare `SheetContent` declaring exactly what the affected consumers declare —
`w-full sm:max-w-xl`, nothing else — rendered in WebKit and measured at five widths:

| Viewport | Consumer asked for | Actually rendered | Candidate consumer fix |
|---|---|---|---|
| 390 | 390 (`w-full`) | **293** (75%) | **390** ✓ |
| 768 | 576 (`max-w-xl`) | **384** | **384** ✗ |
| 1024 | 576 | **384** | **384** ✗ |
| 1440 | 576 | **384** | **384** ✗ |
| 1920 | 576 | **384** | **384** ✗ |

### Two conflicts, not one

Phase 7E identified the width conflict. The measurement shows a **second, larger one**:

1. `data-[side=right]:w-3/4` out-specifies a consumer's `w-full` → **75% width on mobile**
2. `data-[side=right]:sm:max-w-sm` out-specifies a consumer's `sm:max-w-xl` → **384px on
   every tablet and desktop width**

Both are attribute-prefixed utilities, which outrank plain ones however `cn()` orders them.

**The second is the more consequential.** Every affected detail sheet renders at 384px on
desktop instead of the 576px (or 672px for `max-w-2xl`) its author declared — a third of the
intended reading width, on every CRM detail sheet in the application.

### Why this stops here

Phase 8's `max-lg:w-full!` fixes conflict 1 and **does nothing for conflict 2** — measured
above: 384 stays 384. So the "smallest consumer-scoped fix" is not one token but two per
consumer (`max-lg:w-full!` **and** `sm:max-w-*!`), across 16 files, to obtain the width each
already asked for.

That is Step 17's condition — consumer-scoped fixes are insufficient and the primitive is
the real defect — so this phase **stops and documents** rather than changing `sheet.tsx`
automatically or mass-migrating 16 files it cannot individually verify.

### Affected consumers (18 usages, 16 conflicted)

| Status | Files |
|---|---|
| Fixed for conflict 1 only (Phase 8) | `projects/task-detail-sheet` |
| Already carry `!` on max-width — three authors hit conflict 2 and patched it | `partners/partner-task-detail`, `payroll/payroll-run-detail`, `projects/task-detail` |
| **Conflicted, unfixed** | accounting/journal-review · accounts/account-detail · contacts/contact-detail · helpdesk/ticket-detail · investors/investor-detail · leads/lead-detail · opportunities/opportunity-detail · sales-revenue ×4 · travel/travel-detail · visa/ninety-day-detail |
| Declare no width | directory/employee-detail · ui/sidebar |

### Recommended fix, with blast radius

In `ui/sheet.tsx`, make the primitive's width and max-width **defaults rather than
overrides** — e.g. drop `data-[side=right]:w-3/4` and `data-[side=right]:sm:max-w-sm` in
favour of unprefixed `w-3/4 sm:max-w-sm`, which a consumer's own `w-full` / `sm:max-w-xl`
can then beat on source order.

- **Mobile impact:** the 15 unfixed sheets go 75% → 100%, which is what each already asked
  for. Task detail is unaffected (its `!` already wins).
- **Desktop impact:** the 15 go 384px → their declared 576/672px. This is the visible
  change and it needs a design sign-off, because those sheets have only ever been seen at
  384px.
- **Regression plan:** measure all 18 at 390/768/1024/1440 before and after; the three `!`
  consumers must not move at all.

**Not implemented here.** It needs a design decision and per-consumer verification, most of
which requires a session.

---

## 5. Tests

**+16, all passing; 2,614 total.**

`components/ui/__tests__/input-sizing-contrast.test.ts`:

| Group | Covers |
|---|---|
| P2-A | both primitives key the small size on `pointer-fine`; **neither carries a bare width-only `md:text-sm`**; both still start at `text-base` |
| P2-B | muted-foreground meets 4.5:1 on all four surfaces, in **both** themes (8 assertions), computed with the real WCAG formula from the actual token values in `globals.css` |
| P2-B | muted text stays visibly lighter than `--foreground`, so a future contrast "fix" cannot collapse the hierarchy |

Neither property is checkable by rendering — jsdom applies no stylesheet — so both are
asserted at source, with the browser measurements recorded here.

**A stale skip was removed, not added.** `e2e/webkit-verification.spec.ts` previously skipped
its 16px assertion at ≥768px because the contract genuinely stopped at `md`. After P2-A that
skip would have hidden the fix, so it now asserts unconditionally on a coarse pointer:
**2 passed, 0 skipped** across the iPhone and iPad profiles.

---

## 6. Results

| Area | Before | After | Status |
|---|---|---|---|
| Mobile inputs | 16px | 16px | unchanged ✓ |
| **iPad inputs** | **14px** | **16px** | **FIXED** |
| Desktop inputs | 14px | 14px | unchanged ✓ |
| **Light contrast** | **2.03–2.38:1** | **4.53–5.30:1** | **FIXED** |
| Dark contrast | 4.93–9.09:1 | unchanged | already passing ✓ |
| Sheet consumers | 16 conflicted | 16 conflicted | **documented, not fixed** |
| Overflow | 0 | 0 | unchanged ✓ |
| WebKit | 1 pass / 1 skip | **2 pass / 0 skip** | improved |
| axe (`/sign-in`) | 3 violations | **2** (both moderate, structural) | improved |

---

## 7. Regressions

None. 2,614 unit tests pass, type-check and lint are clean, and the two E2E specs pass on
both WebKit profiles.

**Two self-inflicted errors during the phase**, both caught and corrected:

1. I put a comment containing **backticks inside a template-literal className**, which
   terminated the string and 500'd the dev server — the same mistake as Phase 8. I initially
   misattributed the 500 to a `next build` / `next dev` conflict over `.next`, and the log
   showed otherwise.
2. Moving that comment into the class string then produced **28 lint errors**, because
   `readable-tailwind` parses every word in a class literal as a class name. Both comments
   now live above the component, where prose belongs.

---

## 8. Limitations and deferred

1. **P2-C is unfixed** (§4) — the largest open item, and it now looks worse than Phase 7E
   thought.
2. **Nothing authenticated was verified** — unchanged across the whole programme.
3. **No physical device.** WebKit emulation is the real engine with real touch events; it is
   not an iPhone or an iPad.
4. **axe ran on `/sign-in` only.** The contrast fix is a token change so it applies globally,
   but only one page has been scanned. Authenticated pages remain unscanned.
5. **`landmark-one-main` / `region`** on `/sign-in` — P3, structural, untouched.
6. **The `--muted-foreground` change is visible.** Muted text across the entire app is
   noticeably darker. It is correct and it is a visual change somebody should look at.

---

## 9. Release status

**READY WITH KNOWN P2/P3 LIMITATIONS.**

Two of the three P2s are closed and verified on the real iOS engine. The third is
reproduced, quantified and scoped, with a recommended fix and its blast radius — it is not
closed, and it is now understood to affect desktop sheet widths app-wide rather than only
mobile.

This is **not** "fully production verified": authentication remains unverified in every
phase, and physical-device testing remains separate from WebKit emulation.

---

## 10. Recommended next phase

**Decide P2-C, then unblock authentication.**

1. Take the design decision on §4's recommended `sheet.tsx` change — 15 detail sheets going
   from 384px to their declared width is a visible product change, not an engineering one.
2. Rotate the leaked credential and provision a non-admin test account, still outstanding
   since Phase 7E. Everything behind a session — login, approvals, the board, task moves,
   push, and axe on real pages — remains unverified without it.
