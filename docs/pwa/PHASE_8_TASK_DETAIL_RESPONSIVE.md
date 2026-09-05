# Phase 8 — Task Detail Sheet responsive conversion

**Status:** implementation complete. Authenticated verification **not performed** (§31).
**No API change. No database change. No migration. No new dependency.**
The 1,829-line component was **not rewritten** and **not split**; five targeted changes were made.

---

## 1. Existing architecture

`components/projects/task-detail-sheet.tsx` — 1,829 lines, one component, opened from the
board card, the mobile task card and the timeline. Shape:

```
<SheetContent>                     side="right", w-full max-w-none, sm:max-w-[min(1080px,100vw-24px)]!
  <SheetHeader class="sr-only">    accessible name only
  <div>                            breadcrumb bar — project / TASK-XXXX, shrink-0
  {detailLoading && !detail
    ? spinner
    : <div flex-col md:flex-row>    BODY
        <div>                       MAIN — title, description, assignees,
        │                                  dependencies, resources, subtasks,
        │                                  and the All/Comments/History tabs
        <aside>                     RAIL — status, priority, dates, assignee
      </div>}
```

Data: one `getTaskDetail(projectId, taskId)` call, with
`effectiveTask = detail?.task ?? task` — so a failed fetch still renders from the prop.
All mutations go through the existing `project.service` functions.

---

## 2. Section inventory

| Section | Data | Editable | Mobile issue found |
|---|---|---|---|
| Breadcrumb bar | `projectName`, task id | no | task key truncates away on a long project name (P3) |
| Title | `effectiveTask.title` | yes | — |
| Description | `effectiveTask.description` | yes (textarea) | **13px → iOS zoom** |
| Parent link | `effectiveTask.parent` | no | — |
| Assignees (multi) | `detail.assignees` | yes | select at `text-xs` (legibility only) |
| Dependencies | `detail.dependencies` | yes | select at `text-xs` |
| Resources | `detail.resources` | yes | **4-column add row unusable**; 2 inputs **13px** |
| Subtasks | `detail.subtasks` | yes | input **13px** |
| Tabs — All / Comments / History | `detail.comments` + `detail.activity` | comment composer | composer textarea **13px** |
| Rail — status | `effectiveTask.status` | yes | — |
| Rail — details grid | priority, dates, assignee | yes | `grid-cols-[88px_1fr]` fits |
| Close button | — | — | **28px**, from the primitive |
| Sheet itself | — | — | **75% width**, not full |

---

## 3. Existing responsive behaviour — what was already right

Most of the sheet was already responsive and was **left alone**:

- body is `flex-col md:flex-row` — already stacks
- rail is `w-full md:w-[300px] border-t md:border-l` — already full width below `md`
- field pairs are `grid-cols-1 md:grid-cols-2`
- the rail's own `grid-cols-[88px_1fr]` fits at 320px (88 + 8 + 192 in 288px of content)
- comments, activity, attachments, dependencies and subtasks all wrap correctly
- loading / empty states already exist and use the module's own idiom

The author had clearly done responsive work here. What was wrong was **geometry**, not markup.

---

## 4. Problems discovered — all measured, not inferred

### D1 — the sheet rendered at 75% width *(root cause worth reading)*

`SheetContent` is passed `w-full max-w-none`. The Sheet primitive sets
`data-[side=right]:w-3/4`. **An attribute-prefixed utility outranks a plain `w-full`
however `cn()` orders them**, so `w-3/4` won.

Evidence this had already bitten someone: the same className carries
`sm:max-w-[min(1080px,calc(100vw-24px))]**!**` — an `!` added to beat the primitive's
`sm:max-w-sm`. The max-width was fixed; the width itself was never noticed.

Measured: **292.5px in a 390px viewport** — a 98px dead strip, a quarter of the screen.

### D2 — at tablet width the sidebar was wider than the content

At 768px the two faults compounded: 75% width **and** the `md:flex-row` split.

| 768px, before | |
|---|---|
| sheet | 576px |
| **main content** | **275px** |
| metadata rail | 300px |

The content column was narrower than the metadata annotating it — and narrower than the
same content got on a 320px phone.

### D3 — two regions competing for a fixed height

Below `md`, main owned `overflow-y-auto flex-1` while the rail sat below it as `shrink-0`,
all inside an `overflow-hidden` sheet. Measured at 390 × 844:

- rail: **381px**, permanently, not scrollable and not collapsible
- main: **426px** of viewport for **1,815px** of content

There was no way to push the metadata out of the way to read the task.

### D4 — five text-entry fields at 13px

iOS Safari zooms the page when a focused `input`/`textarea` is under 16px, and does not
zoom back. The description and comment composers were both affected.

**A distinction worth keeping:** six `SelectTrigger`s also carry `text-xs`, and an initial
sweep flagged 11 controls. `SelectTrigger` renders a `<button>`, which iOS never zooms on.
Those six are a legibility question, not a zoom defect, and were left alone.

### D5 — the add-resource row

`grid-cols-[120px_1fr_1fr_auto]` needs ~400px. In a 293px sheet the two text inputs
compressed to roughly 50px each — no overflow, because `Input` carries `min-w-0`, and
entirely unusable.

### D6 — close button 28px

From the shared primitive, under the 44px minimum.

---

## 5. Changes made — five, all breakpoint-scoped

| # | Change | Scope |
|---|---|---|
| 1 | `max-lg:w-full!` on `SheetContent` | below 1024px |
| 2 | `max-md:[&_[data-slot=sheet-close]]:size-11` | below 768px |
| 3 | body `overflow-y-auto md:overflow-hidden`; main `md:min-h-0 md:flex-1 md:overflow-y-auto` | below 768px |
| 4 | five fields `text-[13px]` → `text-base md:text-[13px]` | below 768px |
| 5 | resource row `grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto]` | below 640px |

**Why `lg` for the width.** `sm` alone fixed the phone and left the 275px tablet column.
`lg` (1024px) is the boundary the board already uses (Phase 7C), so this is consistent with
the project's own strategy rather than a new breakpoint. Above it, the existing
`sm:max-w-…` cap governs exactly as before.

**Why `size-11` and not `.touch-target`.** The first attempt was
`[&_[data-slot=sheet-close]]:touch-target`. **Tailwind cannot re-emit a hand-written
`@layer utilities` class through an arbitrary variant**, so it produced nothing — caught by
measuring the pseudo-element, which stayed `auto`. `size-11` is a real utility and composes.
Worth remembering: the same mistake would silently no-op anywhere else in the codebase.

Change 3 also moved main's padding to `px-4 md:px-5`, recovering 8px of content width at
320px. That is the only spacing change in the phase.

**No component extraction was performed.** Step 35's conditions were not met: every fix is a
class change at an existing boundary, none of the sections needed independent responsive
logic, and splitting a working 1,829-line file would have produced a large, risky diff with
no behavioural benefit.

---

## 6. Verification — before and after, measured in a browser

Real component, temporary harness (deleted, confirmed **404**), hostile fixtures: a
155-character title, a 1,000-character description containing an 80-character URL and a
62-character unbroken string, a 55-character project name, a 39-character assignee.

| Width | Sheet | Main | Rail | Scrollers | Close | Fields <16px | Uncontained |
|---|---|---|---|---|---|---|---|
| 320 | **320** (was 240) | stacked | 319 | 1 | **44** | **0** | 0 |
| 390 | **390** (was 292.5) | stacked | 389 | 1 | **44** | **0** | 0 |
| 768 | **744** (was 576) | **443** (was 275) | 300 | 1 | 28 | 4 (desktop) | 0 |
| 834 | **810** | **509** | 300 | 1 | 28 | 4 | 0 |
| 1024 | 768 | 467 | 300 | 1 | 28 | 4 | 0 |
| 1440 | 1080 | 779 | 300 | 1 | 28 | 4 | 0 |
| 1920 | 1080 | 779 | 300 | 1 | 28 | 4 | 0 |

**Page overflow was 0 at every width.** 1024, 1440 and 1920 are byte-identical to the
pre-change behaviour: `w-3/4` capped by `sm:max-w-…` yields the same 1080px it always did.

### Two probe errors of mine, corrected rather than reported as defects

**The close button appeared to be off-screen at 390px.** It was not. This browser pane does
not composite frames, so the sheet's `enter` animation stayed `running` indefinitely and
left a residual 29.25px transform. Finishing the animation showed the sheet settling at
x=98 with the close button comfortably inside. Had I not checked `getAnimations()`, I would
have reported a serious defect that does not exist.

**43 "uncontained" elements at 390px** were the off-screen sheet itself, and the last
remaining one was the breadcrumb's task key — contained by `truncate` (`overflow-x: hidden`),
which my probe only treated as containment for `auto`/`scroll`. Probe corrected; the real
count is 0.

---

## 7. Scroll ownership (Step 26)

| | Owner |
|---|---|
| **< 768px** | the sheet **body** — one scroller. Main content then metadata, read top to bottom |
| **>= 768px** | main and the rail scroll independently, side by side, as before |

Measured after the change at 390px: **one** scroller, 807px tall over 2,032px of content —
the whole record, including metadata, in a single gesture.

No sticky action bar was added. The sheet has no footer action row, and Step 27 is explicit
that one should not be invented because it is a common mobile pattern.

---

## 8. Preserved untouched

Route, API, data model, RBAC, mutation semantics, optimistic updates, workflow rules,
notifications, comments, attachments (including the signed-URL path), dependencies,
subtasks, the tab structure, loading and empty states, and every entry point. No permission
logic branches on width anywhere in the file — verified by reading, and unchanged.

---

## 9. Accessibility

- sheet keeps its accessible name from `SheetHeader` (`sr-only`) — asserted by test
- close button reaches 44px below `md`
- all four visible text fields reach 16px below `md`
- no nested interactive elements were introduced; no element's role changed
- focus management is Radix's, untouched

**No accessibility scanner was run; no WCAG conformance is claimed.** The 44px and 16px
figures are WCAG 2.5.5 and the iOS zoom threshold, measured directly.

---

## 10. Tests

**+9; 2,598 pass (1,958 API + 640 web); none weakened.**

`__tests__/task-detail-sheet-responsive.test.tsx`:

| Group | Covers |
|---|---|
| rendering | falls back to the passed task when the detail fetch returns nothing; has an accessible name |
| geometry contract | `max-lg:w-full!` present; the desktop max-width cap intact; the close-size rule scoped to `max-md` |
| scroll ownership | body scrolls and main does **not** below `md`; both flip at `md`; rail stays `w-full md:w-[300px]` |
| text entry | no visible field carries an unprefixed `text-[13px]`/`text-sm`/`text-xs`; the hidden file input is deliberately left alone |

**On instrument choice:** jsdom computes no layout, so none of the six defects could be
caught here by measuring. They were found and verified in a browser; these tests pin the
class contracts that produce those geometries — each of which was silently wrong before and
would be silently wrong again if someone tidied them. The file says so at the top, so a
future reader does not mistake them for a geometry check.

**One test-authoring mistake:** four tests failed initially because the sheet's first paint
is its loading branch (`detailLoading` is set synchronously in an effect), so `aside` did not
exist yet. Fixed with a `renderSettled()` helper, not by loosening assertions.

---

## 11. Known limitations

1. **Authenticated verification not performed.** No session is available (and the only
   credential in the repo is the one Phase 7E reported as a P0 leak, which I will not use).
   Real tasks, real comments, real attachments and real permissions remain unexercised.
2. **Physical-device verification not performed.** Measurements come from a desktop browser
   at emulated widths — not an iPhone, and not WebKit. Notably, the iOS zoom fix is verified
   as *"the field computes 16px"*, not as *"Safari did not zoom."*
3. **The task key truncates away** in the breadcrumb when the project name is long (P3).
   Left alone: Step 8 forbids hiding header information to save space, and it is existing
   behaviour.
4. **Six `SelectTrigger`s remain at `text-xs`** (§4, D4). Legibility, not zoom. Left alone
   for want of evidence.
5. **`h-9` controls are 36px**, under 44px. Raising them would change desktop density; not
   done without evidence.
6. **No accessibility scanner, no performance profiling.**

---

## 12. Technical debt (recorded, not fixed)

- `listAssignableUsers` fetches 200 users on every board open (carried from 7B).
- No pagination on comments or activity — the whole stream renders.
- `Sheet`'s `data-[side=right]:w-3/4` will keep out-specifying consumers' `w-full`. Every
  consumer of `SheetContent` that thinks it set a width is worth auditing; this phase fixed
  only the task sheet.
- `.touch-target` cannot be used through an arbitrary variant (§5). It is currently applied
  directly on two elements and works there; anyone reaching for `[&_…]:touch-target` will
  get silence.

---

## 13. Recommended next phase

**Phase 7E, unblocked.** Nothing in this programme has been rendered with a real session,
and Phase 8 has now added a fix whose whole point — iOS not zooming — can only be confirmed
on WebKit. The environment inventory from 7E found the tooling already present:
`webkit-2311` is installed and `playwright.config.ts` already defines iPhone 13 and iPad
Mini profiles.

So the highest-value next step is unchanged and now cheaper: rotate the leaked admin
password, add a properly-handled test credential, and run the accumulated checklists
(7A §29, 7C §20, 7D §12–13, 8 §11) against WebKit and a real session.

If a build phase is preferred, the remaining unconverted Project CRM surfaces are the
project form dialog (1,320 lines) and the six pages listed in Phase 7 §30.
