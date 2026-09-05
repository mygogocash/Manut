# Phase 7D — Board interaction, keyboard, Timeline, accessibility

**Status:** implementation complete. Physical touch and authenticated verification **not performed** (§23–24).
**No API change. No database change. No migration. No new dependency.**

---

## 1. What was wrong

Three findings carried in from the Phase 7B audit, all confirmed against source before any
edit:

1. **The whole task card was the drag surface.** `{...listeners}` sat on the card root, so
   there was nowhere to put `touch-action: none` that did not also stop the board scrolling.
2. **No `KeyboardSensor`.** Board drag was pointer-only on every device, so it had never
   been keyboard-operable at all.
3. **The Gantt's reschedule is mouse-only** — `onMouseDown` plus window `mousemove` /
   `mouseup`, events a touch browser does not emit during a gesture. Its bars looked
   draggable and were not.

The mechanism behind (1), read out of `@dnd-kit/core@6.3.1` itself: dnd-kit sets
`touchAction: 'none'` **only on the DragOverlay**, never on draggables, and `PointerSensor`'s
cancel event is **`pointercancel`** — exactly what a browser fires when it claims a gesture
as a scroll. A card with default `touch-action` therefore raced the scroll and lost.

---

## 2. Task drag handle

`SortableTaskCard` now has a dedicated activator: a real `<button>` carrying
`setActivatorNodeRef`, `attributes` and `listeners`, with a `GripVertical` icon.

| | |
|---|---|
| `touch-action: none` | on the grip **only** — measured: exactly 3 elements on a 3-card board, all of them grips |
| Hit area | **44 × 44** via `.touch-target`; visual box stays 36 × 36, so nothing shifted |
| Accessible name | `Reorder task: <title>` — names the card, not just the control |
| Focus | `focus-visible:ring-2` |
| Nesting | grip and opener are **siblings**; neither contains the other |

**Why `.touch-target` rather than more padding.** Padding alone reached 36px, and the extra
padding needed for 44 would have pushed outside the card's own `p-3`. The utility expands
the hit area with a centred pseudo-element instead. Verified empirically rather than
assumed: `::after` computes to 44×44, and `elementFromPoint` 3px outside the visual left
edge returns the grip. The gap to the opener is 6px and the extension is 4px per side, so
the two hit areas do not overlap.

**The card body no longer drags,** which let the manual tap-vs-drag discriminator go — a
`pointerDownPos` ref plus a 5px threshold in `onClick`, only ever needed because a click and
a drag started on the same element.

**Opening the task is now its own `<button>`** wrapping the title and description, so it is
reachable and announced as an action. Previously the card was a `div` with a click handler:
no keyboard activation, no focus ring, no role.

---

## 3. Column drag

Preserved as it was — it already had the correct pattern, and it is the pattern the task
card now copies. Two additions only: `.touch-target` to bring its ~20px grip to 44px, and
the label changed from `"Reorder column"` to `` `Reorder column: ${column.label}` `` so a
screen-reader user hears which column. Behaviour, geometry and `touch-none` unchanged.

---

## 4. KeyboardSensor

```ts
useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)
```

Both are available in the installed versions (`@dnd-kit/core@6.3.1`,
`@dnd-kit/sortable@10.0.0`) — checked in the packages' own type declarations before use, not
assumed from another major version.

`sortableKeyboardCoordinates` is the sortable package's translator from key presses to the
coordinates the collision detector expects. Without it the arrow keys move a fixed 25px,
which is meaningless against 270px columns.

The workflow this yields — focus a grip, Space/Enter to lift, arrows to move within and
between columns, Space/Enter to drop, Escape to cancel — comes from dnd-kit, along with its
live-region announcements via the already-installed `@dnd-kit/accessibility`. Nothing was
hand-written.

**The pointer sensor's existing activation distance is unchanged** and a test pins it, so
desktop mouse behaviour is provably identical.

---

## 5. Move semantics — untouched

`applyTaskMove(id, status, beforeTaskId)` from Phase 7C remains the single mutation, and
this phase did not touch it:

```
desktop drag  ->  applyTaskMove(id, status, overTaskId ?? null)
keyboard drag ->  the same handleDragEnd, so the same call
MoveToSheet   ->  applyTaskMove(id, status, null)
```

Keyboard drags end in `onDragEnd` exactly as pointer drags do, so they inherit the same
ordering rules, the same optimistic update, the same snapshot rollback, the same toast, and
the same `reorderTasks` payload. Drop on a column still yields `beforeTaskId = null`
(append); drop on a task still yields that task's id. A cancelled drag never reaches
`onDragEnd`, so no mutation fires.

**Permissions unchanged.** No keyboard- or touch-specific permission exists; the server
remains authoritative and `assertWorkStarted` still gates the write.

---

## 6. Timeline — the problem, precisely

`timeline-view.tsx` (760 lines) is `flex max-h-[70vh] overflow-hidden` over two panes:

- left: **`w-80 shrink-0 overflow-auto`** — a **320px label pane that cannot compress**
- right: `flex-1 overflow-auto`, grid width `totalDays × 32px`

So at a 320px viewport (288px of content) the label pane is wider than the entire content
area and the chart is left **zero pixels**. A quarter-long project is ~2,900px of grid. On
top of that, reschedule and resize are mouse-only (§1.3), and the resize handle still looked
interactive.

### Options and scoring

Scored 1–5; **Simplicity 5 = simplest**, so the total reads consistently.

| Option | Usability | Workflow | Touch | A11y | Discoverability | Perf | Simplicity | Consistency | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| **A** Responsive Gantt + h-scroll | 2 | 5 | 1 | 2 | 3 | 2 | 3 | 3 | **21** |
| **B** Read-only Gantt on mobile | 2 | 3 | 4 | 2 | 3 | 2 | 3 | 3 | **22** |
| **C** Chronological task list | 4 | 3 | 5 | 4 | 4 | 5 | 4 | 5 | **34** |
| **D** Schedule list + detail sheet | 5 | 4 | 5 | 4 | 4 | 5 | 4 | 5 | **36** |
| **E** Other | — | — | — | — | — | — | — | — | — |

Behind the numbers: **A and B both score 1–2 on usability** because the 320px `shrink-0`
pane leaves no chart, and making it shrink is a desktop geometry change the brief says to
avoid. **A scores 1 on touch** because it keeps a gesture that cannot complete. **D beats C**
because the tap-through costs nothing — the page already passes `onTaskClick` — and it keeps
dates editable.

### Selected: **Option D — read-only schedule list, tapping through to the task sheet**

**What users can do:** read the whole schedule top to bottom, grouped by month in date
order; see each task's date range, status and milestone; tap any row to open the task sheet
and edit its dates there.

**What users cannot do:** drag a bar to reschedule, or resize one to change duration.

**What changes from desktop:** the chart becomes a chronology. Bar lengths, the today
marker, and dependency arrows are desktop-only.

**Why this is preferable:** it is the only option where every control offered actually works.
Editing is not removed — it moves from a gesture that cannot fire to a form that can.

**What is preserved:** the same `snapshot`, the same tasks and milestones, the same
`onTaskClick`, the same task sheet, the same date formatter. **No new endpoint, no duplicated
date arithmetic.**

**What is deferred:** a genuinely interactive mobile Gantt. That needs the mouse handlers
rewritten to pointer events and the label pane made responsive — a rewrite of a 760-line
component, and the brief is explicit that it should be documented rather than attempted
here.

**No misleading affordance** (Step 24): the list renders no grip, no resize handle, and no
`touch-none` anywhere. Two tests assert exactly that.

---

## 7. Responsive model, final

| | Board | Timeline |
|---|---|---|
| **< 1024px** | status tabs → `TaskMobileCard` → `MoveToSheet` · **no DndContext** | `TimelineMobileList` (read-only) |
| **>= 1024px** | Kanban → dedicated grip → Pointer + Keyboard sensors | existing Gantt, unchanged |

Breakpoint **unchanged** at `lg` / 1024px. The Board/Timeline toggle is untouched; switching
views does not refetch the project, and a test asserts it.

---

## 8. Accessibility

- Task grip: named per task, focusable, visible focus, 44px, not nested
- Column grip: named per column, 44px
- Task opener: a real button, keyboard-activatable
- Keyboard drag: full lift/move/drop/cancel from dnd-kit, with its own announcements
- Schedule list: month headings are real `<h3>`s; rows are buttons only when a handler exists
- Touch targets: 44px verified in a browser for both grips, status tabs and card actions

**No accessibility scanner was run; no WCAG conformance is claimed.** The 44px figure is
WCAG 2.5.5 / Apple HIG, measured directly.

---

## 9. Files

**Created:** `components/projects/timeline-mobile-list.tsx` plus three test files
(`task-card-drag.test.tsx`, `timeline-mobile-list.test.tsx`, and additions to
`board-responsive.test.tsx`).

**Changed:** `task-card.tsx` (grip + opener), `board-column.tsx` (hit area + label),
`app/(dashboard)/projects/[projectId]/page.tsx` (KeyboardSensor + compact timeline branch).

`timeline-view.tsx` shows **zero diff** — the desktop Gantt was not touched.

---

## 10. Tests

**+26 this phase; 2,589 pass (1,958 API + 631 web); none weakened.**

| File | Tests | Covers |
|---|---|---|
| `task-card-drag.test.tsx` | 9 | grip exists and is named per task; **it is the only element carrying the listeners**; **it is the only element with `touch-none`**; focusable with a visible ring; opener is a real button that works from the keyboard; grip and opener are siblings; the grip does not open the task; the card still shows all five fields |
| `board-responsive.test.tsx` | +7 | Pointer **and** Keyboard sensors registered; keyboard sensor gets a `coordinateGetter`; pointer keeps `{distance: 8}`; no sensors on a phone; timeline is the schedule list on a phone and the Gantt on desktop; toggling views does not refetch |
| `timeline-mobile-list.test.tsx` | 10 | grouped by month earliest-first with undated last; date ranges; milestone named; status shown; **no drag handle**; **nothing opts out of scrolling**; tap opens the task; inert without a handler; empty state |

Three of my own assertions were wrong and were corrected rather than worked around:
a query matching both buttons on a card (both names contain the task title); a hardcoded
`"01 Sep"` when en-GB abbreviates September as **"Sept"**, four letters unlike every other
month; and asserting the desktop Gantt does *not* print "September 2026" when it legitimately
does, in its date grid — the real discriminator is the mobile list's `<h3>` role.

---

## 11. Browser verification

Real components in a real `DndContext`, temporary harness (deleted, confirmed **404**; no
data read or written). Hostile fixtures: a 133-character title, a 62-character unbroken
string, an 18-digit number, a null date range.

| Width | Page overflow | Uncontained | `touch-action:none` count | Grip visual / hit | Schedule offenders |
|---|---|---|---|---|---|
| 1440 | 0 | 0 | **3 — all grips** | 36×36 / **44×44** | 0 |
| 320 | 0 | 0 | 0 in the schedule | — | 0 |
| 390 | 0 | 0 | 0 in the schedule | — | 0 |

The key correctness result: on a three-card board **exactly three elements** compute
`touch-action: none`, and every one of them is a grip. Nothing else opts out of browser
scrolling, which is what makes the board still scrollable by touch.

**Not browser-verified:** the 1023/1024 branch and the desktop Gantt with real data — both
need a session. The branch is covered by unit test on both sides. **768, 834, 900, 1023,
1024, 1280, 1920 were not separately measured here**; the components hold no internal
breakpoint between them, and Phase 7C measured the mobile board across that range.

---

## 12. Touch verification — NOT PERFORMED

**No physical touch device or touch-emulating session was used.** The browser pane available
here drives synthetic pointer events, which cannot reproduce the browser's own decision to
claim a gesture as a scroll — the exact mechanism this phase addresses.

What *is* established: `touch-action: none` is present on the activators and absent
everywhere else, measured in a real browser. That is the documented precondition for dnd-kit
on touch. Whether a finger actually lifts a card on iOS Safari and Android Chrome **remains
unverified** and should be the first thing a tester checks.

---

## 13. Authenticated verification — NOT PERFORMED

No session was available. Nothing in this phase was exercised against a real project. Still
outstanding: real tasks and statuses, a real drag, a real keyboard drag, a real failed move,
the desktop Gantt, and the Board/Timeline toggle with real data.

---

## 14. API, database, dependencies, performance

**None changed.** `reorderTasks` remains the mutation path with the same payload. No new
requests were introduced — the schedule list renders from the `snapshot` the Gantt already
fetched, and switching views does not refetch.

---

## 15. Known limitations

1. **Touch drag unverified on a device** (§12) — the most important open item.
2. **No interactive mobile Gantt.** Deferred deliberately (§6); the rewrite is scoped there.
3. **Mobile schedule shows no bar lengths, today marker or dependency arrows.** A list cannot
   express them; that is the cost of Option D.
4. **The grip adds a 36px column to every desktop card**, shifting content right by ~22px.
   A visible desktop change, required by Step 3, and the smallest one that makes touch and
   keyboard drag possible.
5. **Keyboard drag was not exercised end-to-end** — the sensor and its coordinate getter are
   asserted, but a full lift/move/drop needs a real board and a session.
6. **No accessibility scanner, no performance profiler.**

---

## 16. Technical debt (recorded, not fixed)

Unchanged from Phase 7C, and deliberately untouched per Part H:

- `listAssignableUsers` fetches **200 users on every board open**, unconditionally.
- **No pagination** on tasks, comments or activity.
- **A failed move re-fetches the whole project.**
- `task-detail-sheet.tsx` has a `grid-cols-[120px_1fr_1fr_auto]` at line 1176 that has never
  been checked at 320px.
- The desktop Gantt remains untestable in jsdom, as does any `DndContext`.

---

## 17. Recommended next phase

**A verification phase, not another build.** Every phase from 1 to 7D now carries the same
two gaps — nothing authenticated has ever been rendered, and no touch device has been used —
and they compound: 7D's whole subject is a gesture that can only be confirmed with a finger.

Concretely: a session on a staging project, a phone and an iPad, and a pass through the
accumulated manual checklists (7A §29, 7C §20, 7D §12–13). That would either confirm the
touch fix or reopen it, and it is cheap compared with building on top of it.

If a build phase is preferred instead: **the task detail sheet** (1,829 lines) is the largest
unconverted surface in the module, is already partly responsive, and has one known suspect
grid at 320px.
