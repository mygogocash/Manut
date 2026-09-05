# Phase 7F-1 — Sheet width architecture

**Status:** root cause identified, architecture decided, primitive corrected, all 18
consumers accounted for. **No consumer file was edited.** No `!` was added anywhere.

**No API, database, migration, RBAC, auth, business-logic, breakpoint, token or dependency
change.**

---

## 1. Baseline and final

| | Before | After |
|---|---|---|
| Unit tests | 2,614 (1,958 API + 656 web) | **2,625** (1,958 + 667) — **+11** |
| type-check | 10/10 | **10/10** |
| lint | 0 errors | **0 errors** |
| Production build | exit 0 | **exit 0** — recompiled, 2.0 min |
| E2E (WebKit, both profiles) | 2 passed | **2 passed** |

---

## 2. Root cause

`cn()` is `twMerge(clsx(...))`. The primitive declared its geometry as **attribute-prefixed
variants**:

```
data-[side=right]:w-3/4     data-[side=right]:sm:max-w-sm
```

Two independent things then went wrong together:

1. **twMerge did not see a conflict.** It only drops an earlier class when it recognises a
   later one as the same property *with the same variants*. `data-[side=right]:w-3/4` and a
   consumer's plain `w-full` look unrelated to it, so **both survived into the CSS**.
2. **CSS specificity then picked the wrong one.** `[data-side="right"].w-3\/4` is (0,2,0);
   `.w-full` is (0,1,0). The default out-specified the consumer.

Proven directly rather than reasoned about:

```
twMerge("data-[side=right]:w-3/4 data-[side=right]:sm:max-w-sm", "w-full sm:max-w-xl")
  -> "data-[side=right]:w-3/4 data-[side=right]:sm:max-w-sm w-full sm:max-w-xl"   (both kept)

twMerge("w-3/4 sm:max-w-sm", "w-full sm:max-w-xl")
  -> "w-full sm:max-w-xl"                                                          (default dropped)
```

That second line is the whole fix.

---

## 3. Consumer inventory — 18 exactly

| # | File | Side | Width | Max-width | Class |
|---|---|---|---|---|---|
| 1 | accounting/journal-review-sheet | right | `w-full` | `sm:max-w-2xl` | G |
| 2 | accounts/account-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 3 | contacts/contact-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 4 | directory/employee-detail-sheet | right | — | `sm:max-w-md` | G (max-width only) |
| 5 | helpdesk/ticket-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 6 | investors/investor-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 7 | leads/lead-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 8 | opportunities/opportunity-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 9 | partners/partner-task-detail-sheet | right | `w-full` | `max-w-none`, `sm:max-w-[min(720px,…)]!` | E — already `!` |
| 10 | payroll/payroll-run-detail-sheet | right | `w-full` | `sm:max-w-2xl!`, `lg:max-w-5xl!`, `max-w-6xl!` | E — already `!` |
| 11 | projects/task-detail-sheet | right | `w-full` | `max-w-none`, `sm:max-w-[min(1080px,…)]!`, `max-lg:w-full!` | E — Phase 8 |
| 12 | sales-revenue/account-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 13 | sales-revenue/contact-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 14 | sales-revenue/lead-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 15 | sales-revenue/opportunity-detail-sheet | right | `w-full` | `sm:max-w-xl` | G |
| 16 | travel/travel-detail-sheet | right | `w-full` | `sm:max-w-2xl`, `lg:max-w-3xl` | G |
| 17 | **ui/sidebar** | right | — | — | **A — uses defaults deliberately** |
| 18 | visa/ninety-day-detail-sheet | right | `w-full` | `sm:max-w-md` | G |

**Every sheet is `side="right"`.** 16 declare a width, 1 declares only a max-width, 1
declares nothing. **No consumer declares `sm:max-w-sm`** — a fact that matters in §5.

### Declared intent

`w-full sm:max-w-xl` reads unambiguously: *full width on a phone, capped at 576px above*.
16 consumers wrote a variant of that sentence and none of them got it. Three
(`partner-task`, `payroll-run`, `task-detail`) had already reached for `!` to force the
max-width — three separate authors hitting the symptom and patching it locally, none
identifying the cause.

---

## 4. Architecture decision

**MODEL A — the primitive owns defaults; consumers may override them.**

Chosen because the repository already votes for it: 17 of 18 consumers declare geometry, so
they plainly expect to be able to. Model B (primitive owns width entirely) would mean
deleting 17 consumers' intent; Model C is Model A with extra words.

**Implementation: branch the per-side geometry on the `side` prop** so the defaults are
emitted as **plain utilities**, which twMerge can resolve.

```diff
-  data-[side=right]:inset-y-0 data-[side=right]:right-0
-  data-[side=right]:h-full data-[side=right]:w-3/4
-  data-[side=right]:border-l data-[side=right]:sm:max-w-sm
+  side === "right" && "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
```

Why this over the alternatives:

- **vs adding `!` to 16 consumers:** it fixes the cause instead of the symptom, needs no
  consumer edits, and stops the next developer hitting the same trap. Step 11 explicitly
  prefers this.
- **vs leaving it:** the defect is measured, not theoretical.
- **Animation variants stay attribute-prefixed** — no consumer overrides them, so they
  cannot conflict, and moving them would be churn.

The one thing a reader must know is now written where the classes are: put the width back
behind a `data-[side=…]:` variant and the whole defect returns silently. A test asserts it
cannot.

---

## 5. Blast radius

Measured with a prototype that rendered the current and proposed primitives side by side,
**before** production code was touched.

| Consumer group | Desktop before | Desktop after | Mobile before | Mobile after |
|---|---|---|---|---|
| 10 × `sm:max-w-xl` | 384 | **576** | 75% | **100%** |
| 2 × `sm:max-w-2xl` (journal-review, travel) | 384 | **672** | 75% | **100%** |
| 2 × `sm:max-w-md` (employee, visa) | 384 | **448** | 75% / n-a | **100%** / unchanged |
| **ui/sidebar** (declares nothing) | 384 | **384** | 75% | **75%** |
| 3 × already `!` (partner-task, payroll, task-detail) | as declared | **unchanged** | as declared | **unchanged** |

**13 sheets get wider on desktop. 5 do not move at all.**

Two guards from Step 12, both verified rather than assumed:

- **A sheet that declares nothing must not move.** `ui/sidebar` measured 240 / 293 / 384 at
  320 / 390 / 768+ — identical before and after.
- **A deliberately narrow sheet must stay narrow.** A `sm:max-w-xs` consumer measured
  **320px at every desktop width**, not widened to the 384px default. And since **no real
  consumer declares `sm:max-w-sm`**, the change erases no intentional narrow choice — the
  only 384px sheets afterwards are the ones that asked for nothing.

---

## 6. Verification

### Geometry, live primitive, WebKit, all eight widths

| Width | `xl`→576 | `2xl`→672 | `md`→448 | no decl. | narrow | task detail |
|---|---|---|---|---|---|---|
| 320 | 320 | 320 | 320 | **240** | 320 | 320 |
| 390 | 390 | 390 | 390 | **293** | 390 | 390 |
| 768 | **576** | **672** | **448** | **384** | **320** | 744 |
| 834 | **576** | **672** | **448** | **384** | **320** | 810 |
| 1024 | **576** | **672** | **448** | **384** | **320** | 1000 |
| 1280 | **576** | **672** | **448** | **384** | **320** | 1080 |
| 1440 | **576** | **672** | **448** | **384** | **320** | 1080 |
| 1920 | **576** | **672** | **448** | **384** | **320** | 1080 |

Every cell matches the declaration. Page overflow was 0 throughout.

### Task Detail protection (Step 16)

Its Phase 8 scoped fix is untouched and behaves identically: 320/390 full width, **744 at
768, 810 at 834, 1000 at 1024, 1080 at 1280+** — the exact figures Phase 8 recorded. Its
`!` overrides still win, so the primitive change is invisible to it.

### Test matrix

| Width | Chromium | WebKit | Sheet geometry | Overflow |
|---|---|---|---|---|
| 320 | NOT TESTED¹ | PASS | PASS | 0 |
| 390 | NOT TESTED¹ | PASS | PASS | 0 |
| 768 | NOT TESTED¹ | PASS | PASS | 0 |
| 834 | NOT TESTED¹ | PASS | PASS | 0 |
| 1024 | NOT TESTED¹ | PASS | PASS | 0 |
| 1280 | NOT TESTED¹ | PASS | PASS | 0 |
| 1440 | NOT TESTED¹ | PASS | PASS | 0 |
| 1920 | NOT TESTED¹ | PASS | PASS | 0 |

¹ Playwright's Chromium build is still not installed (Phase 7E installed WebKit only), so
the sweep ran on WebKit. The cascade itself is engine-independent — it is resolved by
twMerge in JS before any CSS is involved — and is additionally covered by 11 unit tests.

---

## 7. Tests

**+11, all passing; 2,625 total.**

`components/ui/__tests__/sheet-width-cascade.test.tsx` asserts **resolution, not
appearance** — the class list on the rendered element is the finished answer to "which width
wins", computed by `cn` before any stylesheet exists, which is why it is checkable in jsdom
when the pixels are not.

| Group | Covers |
|---|---|
| consumer wins | the default width and max-width are **removed**, not merely outranked; `md`, `lg`, `2xl` all honoured |
| regression guard | **no `data-[side=…]:` width/max-width may reappear** — the exact shape that made twMerge blind |
| defaults survive | no declaration keeps `w-3/4 sm:max-w-sm`; width-only keeps the default max-width; per-side geometry correct; a `bottom` sheet does not inherit the horizontal width |
| narrow intent | `sm:max-w-xs` is not widened to the default |
| Phase 8 | the task-detail declaration keeps its `!` overrides and loses the default |

---

## 8. Interaction, accessibility, overflow

No behaviour changed: only which width class survives. Open, close, overlay, Escape, focus
trap and focus return are Radix's and untouched; `role="dialog"`, the accessible name and
the close button are unchanged. The two WebKit E2E specs (sign-in 16px floor, both profiles)
still pass. Page overflow measured 0 at all eight widths with the sheets open.

**No accessibility scanner was re-run this phase** — nothing that axe measures changed.

---

## 9. Regressions

**None.** 2,625 unit tests, type-check, lint and a production build all clean, and the
before/after geometry matrix is exhaustive.

**One flaky failure, investigated and dismissed:** `table-layouts.service.test.ts >
router wiring` failed once in a full-suite run and passed on re-run, both in isolation
(10/10) and in two subsequent full API runs (1,958/1,958). This phase changed no API code.
Recorded as pre-existing flake, not fixed — one observation is not a diagnosis.

---

## 10. Limitations and deferred

1. **13 sheets are now wider on desktop.** That is what their authors declared, but those
   screens have only ever been seen at 384px. **Somebody should look at them.** The most
   affected are `journal-review` and `travel` (384 → 672).
2. **Only `ui/sidebar` and the three `!` consumers were verified as unchanged by
   measurement.** The other 14 were verified through the shared declaration shapes, not
   individually — 15 of them need a session to reach.
3. **`directory/employee-detail-sheet` declares a max-width but no width**, so it keeps the
   75% default on mobile. That is probably an oversight by its author rather than intent,
   but adding `w-full` would be me deciding for them. Left alone and recorded.
4. **Authenticated verification: still none**, across the whole programme.
5. **Chromium not run** (§6 footnote); no physical device.

---

## 11. Release status

**READY WITH KNOWN LIMITATIONS.**

The architecture defect is fixed at its cause, with no consumer edits, no `!` proliferation
and no redesign. Every one of the 18 consumers is accounted for, the two "do not
over-correct" guards hold by measurement, and Phase 8's scoped fix is provably unaffected.

The limitation is visual review, not correctness: 13 sheets now render at the width they
asked for, and nobody has looked at them at that width. This is **not** "fully production
verified" — authentication remains unverified programme-wide and WebKit emulation is not a
physical device.

---

## 12. Recommended next phase

1. **Have somebody look at the 13 widened sheets.** It is a five-minute visual pass once a
   session exists, and it is the only open question this phase leaves.
2. **Then unblock authentication** — rotate the leaked credential and provision a non-admin
   test account. It has been the recommended next step since Phase 7E and it now gates the
   review above as well as everything behind a login.
3. Optionally, decide whether `directory/employee-detail-sheet` (§10.3) should get
   `w-full` like its 16 siblings.
