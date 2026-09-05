# Phase 10B — Investor pipeline kanban

**Two files changed, three lines.** Plus one test file.

**Zero API, database, Prisma, RBAC, auth, dependency or business-logic change.** No breakpoint
invented. No shared primitive modified. **No move sheet added, and no status-tab rewrite** —
both were considered against measurement and rejected.

---

## 1. Baseline

Phase 10A: 2,744 tests, gates clean. The investors module was **untouched by this entire
programme** before today, so everything found here is pre-existing.

Three read-only audits ran in parallel (architecture, card/financial fields, toolbar/filters)
and every one of their findings was then measured before any code changed.

---

## 2. Routes, components, architecture

| | |
|---|---|
| Routes | **1** — `/investors`; the kanban is the **default tab** |
| Kanban implementations | **1** — `investor-pipeline-kanban.tsx`, 805 lines |
| Components in module | 10 (4,602 lines) |
| Duplication | **Not a copy.** ~20% shared with either sales kanban. The near-copies are `sales-revenue` ↔ `opportunities` (~80%), not this one. |

The kanban renders no dialogs or sheets of its own; stage add/delete use `window.prompt` and
`window.confirm`.

---

## 3. Stage model — API-driven, not a constant

```ts
const stageRes = await listInvestorStages();   // GET /investor/pipeline-stages
setStages(stageRes.data);
```

Stages are **rows in `investor_pipeline_stages`**, editable at runtime by anyone with
`investors:update` — created, renamed, reordered and deleted from the board itself. Eight are
seeded (`investors`, `lead`, `discovery_call`, `dd`, `verbal_commitment`, `agreement_signed`,
`funds_cleared`, `relationship_management`).

**This is the single most important fact in the audit**, because it is what made the obvious
Phase 10A-style fix wrong (§7).

A stale constant `INVESTOR_PIPELINE_STAGES` exists in `investor.service.ts` with only 7 entries
and the wrong colour format. **The kanban does not import it.** The Edit dialog does — see §9.

---

## 4. Desktop model

**Two independent DnD systems on different axes:**

- **Cards** move between stages by **native HTML5 drag** (`draggable`, `dataTransfer`). No touch
  implementation; not keyboard-operable.
- **Columns** reorder by **dnd-kit**, with a dedicated grip button, `touch-none`, and
  `PointerSensor` at distance 6 — **no `KeyboardSensor`**, so column reorder has no keyboard path
  either.

`moveInvestor(id, nextStage)` is one shared function: optimistic update of both columns and both
counts → `updateInvestor(id, { status })` → `refreshTotals()` → rollback + toast on failure. It
returns `void`.

Both `canMove` and `canManage` read the **same** permission, `investors:update`.

---

## 5. Mobile model — unchanged, and deliberately so

The board is `flex gap-3 overflow-x-auto pb-2` with columns at
`w-[min(100%,300px)] min-w-[260px] flex-shrink-0`. **No breakpoints anywhere** — it is a
horizontally scrolling rail at every width, unlike the sales kanbans' responsive grid.

Measured on WebKit at **all twelve widths** with hostile fixtures:

| | Result |
|---|---|
| Columns rendered | **8** at every width |
| Rail containment | `2484 / viewport`, `overflow-x-auto` — contained at every width |
| Page overflow | **0** (after §6.2) |
| Uncontained elements | **0** |
| Clipped numeric values | **0** |
| Card fields | estimated investment ✓ owner ✓ region ✓ last contact ✓ at every width |

Part D asks whether horizontal scrolling is itself a defect. **It is not here.** One column
nearly fills a phone, the rail scrolls, every card is fully legible, and nothing is lost. A
status-tab rewrite would have replaced a working board — **not applied**, and a test now asserts
that decision.

---

## 6. The three defects, all measured

### 6.1 — P1: the column body collapsed on short viewports

`max-h-[calc(100vh-360px)]`. The 360px subtrahend assumes a tall desktop viewport:

| Viewport | Column body — before | after |
|---|---|---|
| 375×667 portrait | 307px | 400px |
| 320×568 portrait | 208px | 341px |
| **844×390** | **30px** | **234px** |
| **667×375 — a phone in landscape** | **16px** | **225px** |

At 16px a user sees a sliver of a ~90px card. Fixed to `max-h-[60vh]` — **the value both sibling
kanbans already use**, not an invented number.

### 6.2 — P2: the page header overflowed at 320px

`<div className="flex items-center gap-2">` holding Export / Import / Add investor, with no
wrap. It also defeated `PageHeader`'s own `flex-wrap` by being its single child, and the wrapper
carries `shrink-0`.

Measured at 320px: **12px of page overflow, 3 uncontained elements**, the action row 332px wide
reaching x=332 in a 320px viewport. Fixed with `flex-wrap`. **After: 0 / 0.**

### 6.3 — P2: the tab strip clipped its own wrapped rows

Seven `whitespace-nowrap` tabs wrapping to three rows inside a box pinned to 32px.
Measured `scrollHeight > clientHeight` at 320, 375, 390 and 430.

| Width | Strip height — before | after |
|---|---|---|
| 320 | 32, **clipped** | **84** (3 rows) |
| 375 · 390 · 430 | 32, **clipped** | **58** (2 rows) |
| 768 · 1280 · 1440 · 1920 | 32 | **32 — identical** |

**This fix took two attempts, and the first failure is worth recording.** `TabsList`'s height is
`group-data-[orientation=horizontal]/tabs:h-8` — variant-prefixed. A bare `h-auto` does **not**
conflict with it under twMerge, so both classes applied, the prefixed one won, and the
measurement was unchanged. It looked like the fix had not landed. The override has to carry the
same variant:

```
group-data-[orientation=horizontal]/tabs:h-auto
```

Same lesson as Phase 7F-1's sheet width: **twMerge only dedupes classes carrying the same
variant.** The test asserts the variant, not just the utility.

---

## 7. Why no "Move to…" sheet

Phase 10A added one to the sales board. Part H sets six conditions; here **condition 3 fails and
condition 4 is materially harder**:

- Stages are **runtime data**, not a constant. A sheet would have to consume the same fetched
  `stages` array and stay correct as stages are added, renamed and deleted from the board — real
  scope, not a thin sheet.
- `moveInvestor` returns `void`, so it would also need the boolean-return change to keep the
  sheet open on failure.
- Most decisive: **the board measured clean.** The move gap here is identical in kind to the
  sales board's — native drag, no touch, no keyboard — but this phase's brief is explicit that
  the Sales solution must not be copied without proving it applies, and the case for spending
  that scope on a board with no measured layout problem is weak.

So it is **reported, not built** (§11 P2). The keyboard/touch move gap is real and unresolved.

---

## 8. Financial data

Card money is `formatUsd(est)` in a `<span>` with **no className at all** — no `truncate`, no
`overflow-hidden`, no `whitespace-nowrap`, and it is a flex item so it is blockified. There is
nothing to clip it.

Hostile fixtures used the messy free-text forms `estInvestment` really holds — `"18000000000000"`,
`"$999,999,999"`, `"1.5M"`, `"250k"`, `"$999"`, `"TBD"` — parsed by `parseInvestmentAmount`.
**`clipped = 0` at all twelve widths**, `$18,000,000,000,000` rendered in full. Formatting
untouched.

---

## 9. Two pre-existing product inconsistencies, reported not fixed

Both were found by audit and confirmed in source. Neither is responsive, and fixing either is a
product decision:

1. **The Edit dialog cannot reach every stage.** Its Status select is populated from the stale
   `INVESTOR_STATUSES` constant (7 entries, missing the seeded `investors` intake column), while
   the board's columns come from the API and are runtime-editable. **A stage created on the board
   never appears in the dialog** — and since native drag is the only other way to move a card,
   that stage is unreachable for touch and keyboard users entirely.
2. **The detail sheet renders `estInvestment` / `actInvestment` raw and unformatted**, while the
   card formats the same field through `formatUsd`. The same investor shows `$200K` in one place
   and `$200,000` in the other.

---

## 10. Verification

| | Result |
|---|---|
| Unit / integration | **2,752 passed** (1,958 API + 794 web) — was 2,744; **+8** |
| type-check | **10/10 clean** |
| lint | **0 errors** |
| Production build | **exit 0**, 96 static pages |
| 320 · 375 · 390 · 430 | **PASS** — overflow 0, uncontained 0, clipped 0, tab strip no longer clipped |
| 768 · 834 · 900 · 1023 · 1024 | **PASS** |
| 1280 · 1440 · 1920 | **PASS** — tab strip still exactly 32px, board unchanged |
| Short viewports (667×375, 844×390) | **PASS** — 16px → 225px, 30px → 234px |
| Desktop drag | **PRESERVED** — asserted by test |
| **Authenticated E2E** | **PENDING DEV/STAGING VERIFICATION AFTER MERGE** |

The harness (`app/iv-check/page.tsx`, which mounted the **real** `InvestorsPage`) and two probe
specs were **deleted**; `GET /iv-check` returns **404**; the build emits the same 96 pages.

### Tests — 8, every invariant broken and restored

`components/investors/__tests__/investor-pipeline-responsive.test.ts`: no fixed-pixel viewport
subtraction · a proportional max height · the body stays scrollable · the header row wraps · the
tab override carries the matching variant · the board is still a scrolling rail and **not** a
status-tab rewrite · the move still runs through one function with a rollback · the move is still
gated on `investors:update`.

| Break | Result |
|---|---|
| Restore the collapsing `calc` height | **3 failed** |
| Un-wrap the header action row | **1 failed** |
| Drop the variant from the tab override (the subtle one) | **1 failed** |
| Remove the move rollback | **1 failed** |
| Restored | **8 passed** |

---

## 11. P0/P1 · P2/P3

**P1 (fixed)** — column body 16px on a phone in landscape.
**P2 (fixed)** — 12px page overflow at 320px; tab strip clipping its wrapped rows.

**P2 (reported, not fixed):**
- No touch or keyboard path to move a card (§7). Native HTML5 drag only.
- Column reorder has no `KeyboardSensor` despite dnd-kit supporting one.
- The Edit dialog's stale stage list (§9.1) — which makes the move gap worse for any stage added
  on the board.
- Detail-sheet money is unformatted (§9.2).
- The card is both drag surface and click target — though unlike the sales board it has **no**
  nested interactive elements, so there is no gesture conflict to measure.

**P3:** no empty-board state when a tenant has zero stages; `onMutate` is declared and invoked
but never passed by the parent; `canMove`/`canManage` are two names for one permission.

No security issue. Server-side permission enforcement was confirmed present on every stage route.

---

## 12. Known limitations

1. **The investors *list* tab was not measured.** The audit flagged `min-w-[140px]` and
   `min-w-[130px]` selects inside a `grid-cols-2` whose tracks are ~128px at 320px. The pipeline
   is the default tab, so the list tab never rendered in the probe. **Not proven safe — not
   measured.**
2. **No authenticated route rendered.** The harness mounted the real page with stubbed endpoints;
   permissions resolved as denied, so `PermissionButton` rendered disabled-but-present (which is
   the worst case for the overflow measured in §6.2, so that finding holds) — but the
   `canManage`-gated stage controls never rendered and were not measured.
3. **Touch drag was not exercised.** That native HTML5 drag has no touch implementation is a
   documented platform fact, not something this phase measured. What was verified is that
   `moveInvestor` is reachable only from the drop handler.
4. **axe was not re-run** on this surface. Nothing about the three fixes changes an accessible
   name, role or contrast, and Phase 9A's `SelectTrigger` fallback already names this module's
   filters — but that is reasoning, not a scan.
5. **Stage add/delete use `window.prompt` / `window.confirm`** — unstyled, unlocalised, and not
   assessed here.
6. WebKit only; iPad Mini not re-run; no physical device.

---

## 13. Remaining work

- The investors list tab (§12.1) — the one unmeasured surface in this module.
- The five P2s in §11, of which the Edit dialog's stale stage list is the most consequential
  because it compounds the move gap.
- `accounts-tab`, the Sales dialogs and detail sheets still unrendered from Phase 10.

---

## 14. Recommended next phase

**Verification, not more conversion.** This phase found and fixed three real defects in three
lines, and the most severe — a 16px column in landscape — was invisible to every static signal
and only appeared when the viewport was made short. That is the argument for a session, not
against it: the defects that remain are the ones only real use will surface.

The queue is now 45 action columns, 31 hierarchy conversions, 4 matrix decisions, 5
shared-primitive changes, 172 newly-named controls, one move affordance and these three fixes —
all test-guarded, none seen by a real user on a real page.

The prerequisite has not changed since Phase 7G-1 §9: **a dedicated non-admin account and a safe
dataset**. It has now blocked verification across ten consecutive phases. If it genuinely cannot
be provisioned, the honest next step is not another module — it is to stop and say so.
