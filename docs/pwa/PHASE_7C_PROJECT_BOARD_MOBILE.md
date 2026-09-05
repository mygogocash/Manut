# Phase 7C — Project Board, mobile and tablet

**Status:** implementation complete. Authenticated verification **not performed** (§20).
**No API change. No database change. No migration. No new dependency.**
Desktop Kanban, touch drag, `KeyboardSensor` and the Gantt were all left alone.

---

## 1. Existing board architecture (re-confirmed, not assumed)

Project Detail **is** the board — one route, `/projects/[projectId]`, 918 lines, rendering
the `DndContext`, columns and cards inline. Re-read at the start of this phase; the
Phase 7B audit held.

| Thing | Where it lives |
|---|---|
| Columns | `columns` state, seeded from `DEFAULT_COLUMNS` (5), then server-provided; user-editable per project |
| Tasks | `tasks` state from `getProject` |
| Grouping | `tasksByStatus` — `Record<columnKey, Task[]>` |
| Move | `reorderTasks(projectId, orderedIds, status?)` → `POST /projects/:id/tasks/reorder` |
| Card | `SortableTaskCard`, 270px column, `truncate` title |
| Views | `board` / `timeline` toggle, `aria-pressed`, local state |
| Read-only gate | `assertWorkStarted` server-side; a banner client-side |

---

## 2. Responsive decision and breakpoint

**`lg` = 1024px**, via `useIsBelow("lg")` — the same value Phase 7B recommended from the
column arithmetic (5 × 270px + 4 × 16px = **1,414px**, about 1.3 columns visible at 390px)
and the same one `cardBreakpoint` uses elsewhere.

```
< 1024px   status tab strip  →  TaskMobileCard list  →  Open / Move
>= 1024px  the existing DndContext board, untouched
```

**The `DndContext` is not rendered below `lg` at all.** Rendering one there would offer a
drag that cannot complete on touch (Phase 7B §11) — a control that looks available and
silently fails is worse than one that is absent. A test asserts its absence at 390px.

---

## 3. What the mobile branch does *not* duplicate

This was the main design risk: a mobile board that quietly becomes a second board.

| | |
|---|---|
| Data | the same `getProject` call. **No new request, and none per status.** |
| Grouping | the same `tasksByStatus` map the columns use |
| Statuses | the same `columns` array. No `MOBILE_STATUSES`, no second registry |
| Counts | `tasksByStatus[key].length` — data already on screen |
| Move | **the same `applyTaskMove` the drag handler calls**, to the same endpoint |
| Open | the same `handleOpenTask` → the same `TaskDetailSheet` |
| Permissions | unchanged; the server remains authoritative |

### The move path

`handleDragEnd` previously computed the destination order and called `reorderTasks` inline.
That block is now **`applyTaskMove(activeId, targetStatus, beforeTaskId)`**, and both callers
use it:

```
drag  ->  applyTaskMove(id, status, overTask?.id ?? null)   // insert at the drop point
tap   ->  applyTaskMove(id, status, null)                   // append
```

`beforeTaskId: null` means append — exactly what the drag already did when a card was
dropped on a column rather than on another card. So an explicit move is not a new
behaviour, it is the existing behaviour minus a drop point.

The extraction is faithful: same optimistic update, same `snapshot` rollback, same
`fetchProject()` resnap, same toast. The one addition is a `Promise<boolean>` return so the
sheet knows whether to close; it never rejects, and the drag path ignores it exactly as it
ignored the old promise.

---

## 4. Status tab strip

One tab per column, in board order, each carrying its colour dot, label and count.
`role="tablist"` / `role="tab"` / `aria-selected`, `allow-x-scroll` + `flex-nowrap` +
`min-w-0` so the strip scrolls **itself** rather than widening the page, and the selected
tab is scrolled into view on change (feature-checked, per the 7B-1 lesson).

`h-11` — 44px, measured.

**Default status (Step 8):** the board's **first column**. That is what a desktop user reads
first, left to right, and the board has no persisted or URL-encoded selection to honour.
The selection is re-derived whenever `columns` changes, not merely initialised — columns
arrive after first render and can be added, renamed or deleted while the page is open, and
a selection pointing at a deleted column would show a permanently empty list with no way
back.

**URL (Step 9):** the board has never encoded status, view, or anything else in the URL; only
`?task=<id>` exists, and it still works. **No routing state was invented.** A consequence,
recorded honestly: the selected status does not survive a refresh.

---

## 5. TaskMobileCard

A thin wrapper over `RecordCard`, the same relationship `ProjectMobileCard` has to it.

| Desktop card | Mobile card |
|---|---|
| title (`truncate`) | title (**wraps**) |
| description (`line-clamp-2`, stripped, 100 chars) | subtitle, same treatment |
| priority `Badge` | badge |
| due date + calendar icon | `Due` field |
| assignee avatar (initials) | `Assignee` field (**full name**) |
| — | `Open` · `Move` |

Every value comes from the **same helpers** in `project-board-utils` —
`formatTaskPriority`, `taskPriorityBadge`, `formatDateShort`, `getAssigneeName` — so a
priority or a date cannot render differently between the two views.

**Nothing is behind an expander,** because there is nothing left over: the desktop card has
five things on it and so does this. A test asserts no expander exists.

**Two deliberate differences, both improvements rather than reductions:**

1. The title **wraps** instead of truncating. The desktop card truncates because it lives in
   a fixed 270px column; a card is the only place the title appears before opening the task,
   and clipping it is how somebody taps the wrong one.
2. The assignee is a **name**, not initials. A 20px avatar is a reasonable density trade in a
   270px column and a poor one in a full-width card.

---

## 6. MoveToSheet

Built on the existing `BottomSheet`. Destinations are the `columns` array passed straight
in — no private status list. Behaviour:

- the task's current status is **shown but disabled**, with `aria-current="true"` and a
  "Current" marker, so the list still reads as the whole board
- each destination is 44px tall
- one move in flight at a time: `movingTo` disables every destination, the Cancel button,
  and dismissal — a second tap, or a tap on a *different* destination, cannot start a second
  write
- **closes only on success.** A failed move has already rolled the board back and shown its
  error; closing would read as "moved"
- Cancel, Escape and the overlay all dismiss when idle

---

## 7. Loading, empty, error

| State | Handling |
|---|---|
| Loading | unchanged — the page's existing skeleton, which already renders before either branch |
| Empty | canonical `StateView kind="empty"`, naming the selected status: *"No tasks are in Done right now."* Not a global project-empty state |
| Error | unchanged — `reorderTasks` failures toast and roll back, exactly as the drag did. `StateView` is never used to represent a failure |

---

## 8. Filters, search, Timeline

**The board has no filters and no search** — verified, not assumed. None was invented.

**Timeline is untouched.** Selecting it below `lg` renders exactly what it rendered before.
Its Gantt drag is mouse-only and non-functional on touch (Phase 7B §11); that is recorded
for a later phase and was deliberately not addressed here.

---

## 9. Accessibility

- Tabs: `tablist` / `tab` / `aria-selected`, 44px, colour dot is `aria-hidden` so the label
  carries the meaning
- Cards: `Open` and `Move` are real buttons with real names, neither nested inside the
  card's own control (asserted)
- Sheet: accessible name from `BottomSheet`'s title, focus managed by the primitive,
  destinations focusable, Escape closes when idle
- Touch targets: 44px on tabs, card actions and destinations — measured in a browser

**No accessibility scanner was run; no WCAG conformance is claimed.** The board's
pre-existing gaps — no `KeyboardSensor`, a 20px column grip, the card being a `div` — are
out of this phase's scope and remain open.

---

## 10. Files

**Created (2 components, 3 test files):**

```
components/projects/task-mobile-card.tsx
components/projects/move-to-sheet.tsx
components/projects/__tests__/task-mobile-card.test.tsx
components/projects/__tests__/move-to-sheet.test.tsx
app/(dashboard)/projects/[projectId]/__tests__/board-responsive.test.tsx
```

**Changed (1):** `app/(dashboard)/projects/[projectId]/page.tsx` — the `applyTaskMove`
extraction, the compact branch, the status/move state, and the mounted sheet.

---

## 11. Tests

**+37 this phase; 2,563 pass (1,958 API + 605 web); none weakened.**

| File | Tests | Covers |
|---|---|---|
| `board-responsive.test.tsx` | 13 | the 1023/1024 boundary in both directions; phone and desktop; no `DndContext` on a phone; one tab per column in board order; counts from existing data; default = first column; only the selected status's tasks; empty state naming the status; **no refetch on status change**; the move calling `reorderTasks` with `["t-3","t-1"]` and `"in_progress"`; the counts moving after |
| `move-to-sheet.test.tsx` | 12 | destinations from columns; renamed columns follow; current status disabled + `aria-current`; the **key** not the label reaches the mover; closes on success; **stays open on failure**; double-tap and cross-destination tap both blocked; everything disabled in flight; no dismissal mid-write; Cancel moves nothing; accessible name |
| `task-mobile-card.test.tsx` | 12 | title, stripped description, module's own priority label, assignee, due; nothing behind an expander; missing fields omitted not blanked; long title wraps and does not truncate; Open/Move both on the face; Move omitted when read-only; no nested interactive |

**Two of my own fixtures were wrong and the tests caught it:** I invented a `task.assignee`
field (the real shape is `owner.name` / `assigneeName`) and expected a priority label of
`"High"` (the module's vocabulary is `"P0-High"`). Both were corrected in the fixture, not
papered over in the assertion — a fixture that invents fields tests the fixture.

**A note on dnd-kit in tests.** `DndContext` throws under jsdom, and an unhandled error from
it fails the whole vitest run even when every assertion passes — which is why the desktop
board has never had unit tests. In `board-responsive.test.tsx` the library is stubbed to
passthroughs, because these tests are about which branch renders and what the mobile branch
does with the data, not about dnd-kit. Real drag behaviour is a browser concern.

---

## 12. Browser verification

Real components, temporary harness (deleted, confirmed **404**; no data read or written).
Hostile fixtures throughout: a 62-character unbroken title, an 80-character URL as an
assignee name, an 18-digit number, a 29-character status label, and an empty due date.

| Width | Page overflow | Uncontained | Strip scrolls itself | Tab height | Card actions | Card width |
|---|---|---|---|---|---|---|
| 320 | 0 | 0 | yes | 44 | 6 @ 44px | 288 |
| 390 | 0 | 0 | yes | 44 | 6 @ 44px | 358 |
| 430 | 0 | 0 | yes | 44 | 6 @ 44px | 398 |
| 834 | 0 | 0 | **no** (all five fit) | 44 | 6 @ 44px | 786 |
| 1023 | 0 | 0 | no | 44 | 6 @ 44px | 975 |

`MoveToSheet` at 320px: 320×444, fits both axes, five destinations all 44px, current status
disabled and marked, the 29-character label intact, 0 page overflow, accessible name present.

**The horizontal scroll is only ever inside the status strip**, and only when the tabs do
not fit — at 834px and above it stops scrolling. The document never scrolls sideways at any
width.

**What was NOT browser-verified, and why:** the 1023/1024 branch itself, and the desktop
board at 1024/1280/1440/1920. Both need a session and a real project. The branch is covered
by unit test at both sides of the boundary; the desktop board is unchanged by construction
(the compact branch is a new `else if` above it, and the mobile controls are asserted absent
at 1440). **375, 768, 900 were not separately measured** — these components hold no internal
breakpoint, so width only changes their container, and the five widths above bracket the
range. Claiming eleven distinct results would overstate it.

---

## 13. Desktop preservation

The compact branch is a new `isCompact ?` arm inserted **before** the existing `DndContext`
arm. At `lg` and above the same JSX renders as before: same columns, same cards, same
sensors, same collision detection, same overlay, same mutations, same permissions, same
spacing.

The one shared change is `applyTaskMove`, and it is a pure extraction — the drag path passes
the values it already computed and gets the same behaviour. A test asserts the drag's exact
payload shape through it.

---

## 14. API, database, dependencies

**None changed.** No endpoint, contract, schema, migration, seed, permission, push or
notification touched. `reorderTasks` is called with the payload it already accepted. No
dependency added — `BottomSheet`, `RecordCard`, `ResponsiveActions`, `StateView`, `Badge`
and the board's own helpers all already existed.

---

## 15. Known limitations

1. **The selected status does not survive a refresh.** The board has never had URL state and
   this phase deliberately did not invent it (Step 9).
2. **An explicit move always appends** to the destination. Mobile has no reordering *within* a
   status — the drag can do that and a tap cannot express it. The desktop board is unchanged.
3. **A read-only board still offers Move.** On desktop, dragging a card on an unapproved
   request is attempted and refused by `assertWorkStarted` with a toast; mobile now behaves
   identically, because Step 17 requires the two to match. Both are honest about the outcome
   and neither is a security gap, but offering a control that will be refused is a UX defect
   the desktop already had. Recorded rather than diverged from.
4. **Timeline is unchanged on mobile** (§8) and its drag remains mouse-only.
5. **No virtualisation.** Every task in the selected status renders. Tested to 3; real
   volumes are unknown, so nothing was optimised without evidence.
6. **No accessibility scanner, no device testing.**

---

## 16. Existing technical debt (found earlier, deliberately not fixed here)

- **`listAssignableUsers` fetches 200 users on every board open**, unconditionally, whether
  or not a picker is opened. Untouched: the mobile branch does not need it to work, and
  Step 34 says to document rather than fix.
- **No pagination** on tasks, comments or activity.
- **A single failed move re-fetches the whole project.** Preserved deliberately — it is the
  existing rollback and changing it was out of scope.
- **Board drag has no `KeyboardSensor`** on any device.
- **The task card is a `div`** with click handlers, not a button.
- **The column grip is ~20px**, under the touch minimum.

---

## 17. Recommended Phase 7D

**Interaction and accessibility repair on the desktop/tablet board**, which is now the
remaining gap and is well-scoped:

1. Give the task card a **drag activator handle with `touch-none`**, copying the pattern the
   column grip already demonstrates — this is what makes drag work on a touch-capable
   laptop or an iPad at ≥1024px, which today gets the desktop board and a broken gesture.
2. Add a **`KeyboardSensor`**, closing a gap that predates all of this.
3. Make the task card a real button; raise the column grip to 44px.
4. Decide the **Gantt's** mobile fate as a product question — its drag is mouse-only, so it
   is a rewrite rather than a conversion.

Items 1–3 are Low/Medium and testable. Item 4 should be decided before it is scheduled.
