# Phase 10A — Sales pipeline kanban

**Three files changed** (two kanban copies + one new sheet), plus one test file.

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.** No breakpoint
invented or moved. No shared primitive modified. **The status-tab rewrite the brief contemplated
was measured and deliberately NOT applied.**

---

## 1. Baseline

Phase 10: 2,729 tests, gates clean. Phase 10 flagged `pipeline-kanban` as the largest remaining
unmeasured Sales surface and recommended reusing the Project Board's mobile pattern.

**Measurement said not to.** §4 explains why.

---

## 2. Routes, components, implementations

| | |
|---|---|
| Routes rendering a pipeline kanban | **2** — `/sales-revenue`, `/sales` |
| Kanban implementations | **2** (near-duplicates, 1,036 and 991 lines, 659 diff lines) |
| A third kanban | `components/investors/investor-pipeline-kanban.tsx` via `/investors` — **out of scope**, noted |
| Shared move logic | **already one function per copy** — `moveOpportunity(id, nextStage)` |

Both copies were audited and both were changed. The duplication is a product question, flagged
in Phase 10 and not acted on here.

---

## 3. Architecture and the stage model

Columns are `OPPORTUNITY_STAGES` — genuine pipeline stages, six of them, in board order:

```
qualified → proposal → negotiation → closed_won → live → closed_lost
```

So the Project Board's status-tab pattern was **semantically** valid. It was rejected on
measurement, not on semantics.

### What happens on a move

`moveOpportunity(id, nextStage)` — one function, already extracted:

1. Guards `sourceStage === nextStage` (no-op).
2. Optimistically plucks the card from its column and prepends it to the destination, adjusting
   both counts.
3. `await updateOpportunity(id, { stage: nextStage })`.
4. `fetchPipeline()` to reconcile per-currency totals and the probability snap.
5. `onPipelineMutate?.()` so the Accounts tab's joined columns refresh.
6. On failure: `setColumns(previous)` + `toast.error`.

Part Q asks for the smallest shared function. **It already existed** — the only change is that
it now returns `Promise<boolean>` so a caller can tell whether the write landed.

### Desktop drag

**HTML5 native drag**, not dnd-kit: `draggable={canMove}`, `dataTransfer`, `onDragStart` /
`onDragOver` / `onDrop`, plus `handleDropOnCard` for within-column ordering. No sensors, no
`DragOverlay`, no `KeyboardSensor`. Gated on `canMove = hasPermission("sales-revenue:update")`.

It works on desktop and is **preserved untouched** — asserted by test.

---

## 4. The mobile decision: no status tabs

The board is **already responsive**: `grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6`.
Below 768px it is a vertical stack of all six stages, each `max-h-[60vh] overflow-y-auto`.

Measured on WebKit at all twelve widths, with hostile values:

| Width | Columns | Cards | Page overflow | Uncontained | Clipped |
|---|---|---|---|---|---|
| 320 · 375 · 390 · 430 | **1** | 18 @ 270–380px | **0** | **0** | **0** |
| 768 · 834 · 900 · 1023 · 1024 | **3** | 18 @ 219–305px | **0** | **0** | **0** |
| 1280 · 1440 · 1920 | **6** | 18 @ 180–287px | **0** | **0** | **0** |

Card content at **every** width: value ✓ probability ✓ owner ✓ close date ✓.

So there is **no layout defect, no overflow, no information loss and no financial clipping** —
including `USD 18,000,000,000,000`, `-4,500,000`, `100%` and `0%`. A status-tab rewrite would
have solved a problem this board does not have, replaced a working layout, and cost desktop
parity. **Not applied.**

**Mobile model: unchanged — the existing single-column stack.**

---

## 5. The real gap, and an overstatement corrected

The move is HTML5 native drag. That has **no touch implementation** in mobile Safari or Chrome,
and native drag is **not keyboard-operable**. `moveOpportunity` is reachable only from the two
drop handlers, and the only other `/move|stage/` control on the board is "Manage stages" — a
config dialog.

**My first reading of this was that a phone user cannot move an opportunity at all. That was
wrong, and I checked before reporting it.** The card's `onClick` opens the detail sheet, which
shows stage as a read-only badge — but the **Edit dialog carries a `stage` field**
(`z.enum(OPPORTUNITY_STAGES)`). So the capability exists.

The accurate finding is smaller and still real:

- **Desktop:** one gesture.
- **Touch:** card → detail sheet → Edit → form → save. Four steps and a full form.
- **Keyboard:** no direct path at all. Native drag cannot be operated by keyboard, so the form
  route is the *only* route.

That last line is an accessibility gap, not just an inconvenience, and Part H asks for exactly
this: keyboard users must be able to reach an explicit move.

---

## 6. What changed

**`components/sales-revenue/pipeline-move-sheet.tsx`** (new, ~105 lines) — a `BottomSheet`
listing the six stages in board order:

- current stage **shown and disabled**, marked "Current", so the list always reads as the whole
  pipeline and the card's position in it is obvious;
- every destination `min-h-11` (44px);
- an in-flight guard, so a second tap cannot start a second move;
- **closes only on success** — a failed move has already rolled the board back and toasted;
  closing would imply it worked.

**Both kanban copies** gained: a `Move to another stage` trigger on the card, inside the
existing `{canMove ? …}` gate — the *same* permission the drag path uses — and the sheet wired
with `onMove={moveOpportunity}`.

The trigger keeps the existing icon-button size so **no layout changes at any width**, and
carries an invisible 44px hit overlay below `md` (the Phase 8D technique).

The `opportunities` copy needed its card wrapped in a `relative` div — the `sales-revenue` copy
already had one — so the trigger has a positioning parent.

### What was deliberately not changed

- **Within-column ordering stays drag-only.** A drag carries a drop point; a choice does not.
  The board's own column-drop handler already appends in that case, and inventing a mobile
  ordering UI is new product behaviour.
- **The card is still both drag surface and click target.** Part G flags this, and it is real —
  but desktop drag works, splitting the card into grip + body is a desktop UX change, and no
  measurement showed a conflict. **P2, reported.**

---

## 7. Financial data

Hostile values through the real card renderer: `18,000,000,000,000` · `999,999,999` ·
`999,999` · `999` · `-4,500,000`, across USD/THB/JPY, with `100%`/`0%`, an 80-character
opportunity name, a 70-character account name and a 56-character owner name.

**`clipped = 0` at all twelve widths**, value and probability both visible, no collision with
status. Formatting logic untouched.

---

## 8. Accessibility, filters, sheets

- **axe** — the board scan inherits Phase 10's clean result for this module (0 violations, both
  themes). The new sheet's destinations are real `<button>`s with text labels inside the shared
  `BottomSheet`, which Phase 7F-1/8D already cover; **it was not separately axe-scanned** (§10).
- **Toolbar / filters** — page overflow 0 at 320/375/390/430, measured. No `FilterSheet` change.
- **Detail sheet / form dialog** — declare no custom width, so they inherit the Phase 7F-1
  geometry. Audited structurally, not rendered.

---

## 9. Verification

| | Result |
|---|---|
| Unit / integration | **2,744 passed** (1,958 API + 786 web) — was 2,729; **+15** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| 320 · 375 · 390 · 430 | **PASS** — 1 column, overflow 0, clipped 0 |
| 768 · 834 · 900 · 1023 · 1024 | **PASS** — 3 columns |
| 1280 · 1440 · 1920 | **PASS** — 6 columns, unchanged |
| Desktop drag | **PRESERVED** — asserted by test on both copies |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

Harness (`app/pk-check/page.tsx`) and its probe **deleted**; `GET /pk-check` returns **404**;
build emits the same 96 pages.

### Tests — 15, every invariant broken and restored

`components/sales-revenue/__tests__/pipeline-move-sheet.test.tsx`: all six stages offered in
board order · current stage shown and disabled · calls the board's own move with the right stage
· closes only on success · **stays open on failure** · cannot start a second move in flight ·
44px destinations · plus four source invariants asserted against **both** kanban copies.

| Break | Result |
|---|---|
| Bypass the permission gate on the trigger | **1 failed** |
| Point the sheet at a second move path | **1 failed** |
| Remove the desktop drag path | **1 failed** |
| Let the sheet close on a failed move | **1 failed** |
| Stop disabling the current stage | **1 failed** |
| Restored | **15 passed** |

---

## 10. Known limitations

1. **The Move trigger was never seen in a browser.** `canMove` requires
   `hasPermission("sales-revenue:update")`, and I could not get the harness's `AuthProvider` to
   accept a stubbed `/auth/me` — two shapes were tried. Its rendering, permission gating and
   wiring are asserted by unit test and source invariant; its **painted position, 44px overlay
   and touch behaviour are not measured**. That is the largest gap in this phase.
2. **The touch-drag claim is a documented platform fact, not my measurement.** My probe tried to
   synthesise touch events and failed — `new Touch()` is not constructible in WebKit. What I
   *did* verify is that `moveOpportunity` is reachable only from the two HTML5 drop handlers.
3. **The new sheet was not axe-scanned separately** (§8).
4. **Within-column ordering remains drag-only** — deliberate (§6).
5. **The card is still both drag surface and click target** — P2 (§6).
6. **`investor-pipeline-kanban` was not touched** — a third kanban, out of scope.
7. **Two live copies** of the whole board; every change applied twice.
8. **No authenticated route rendered.** WebKit only; no physical device; iPad Mini not re-run.

---

## 11. Remaining work

- Render the Move trigger with a real session and verify its position, target and touch
  behaviour (§10.1) — the one thing this phase could not measure.
- The grip/body split for the card, if the dual-purpose target proves to be a real conflict.
- `accounts-tab`'s 23-column drag-resize grid, the four large Sales dialogs and two detail
  sheets — all still unrendered from Phase 10.
- `investor-pipeline-kanban`, never audited by this programme.

---

## 12. Recommended next phase

**Stop converting and start verifying.** This phase is the clearest case yet: the board needed
almost nothing, the one change I made cannot be fully verified without a session, and the
measurement effort went overwhelmingly into probe mechanics rather than product.

The queue now stands at 45 action columns, 31 information-hierarchy conversions, 4 matrix-table
decisions, 5 shared-primitive changes, 172 newly-named controls and one new move affordance —
every one guarded by a test, none seen on its own page with real data by a real user.

The prerequisite has not changed since Phase 7G-1 §9: **a dedicated non-admin account and a safe
dataset in dev or staging.** It has now blocked verification across nine consecutive phases, and
the honest position is that further source-measurable work has diminishing value against it.
If a session genuinely cannot be provisioned, the next most useful phase is
`investor-pipeline-kanban` — the last unaudited board — but it will end with the same caveat.
