# Phase 7B — Project Detail + Kanban UX Audit

**Status:** audit complete. **No production code was changed.** No API, database, migration,
RBAC, routing or dependency change. Output is findings and a decision.

---

## 0. The finding that reframes the phase

**Project Detail and the Kanban board are the same page.** There is no separate board
route. `/projects/[projectId]` renders the `DndContext`, the columns and the cards
directly, inline, alongside the project header.

The phase brief treats them as two subjects (Part A and Part B). They are one 918-line
client component. Every recommendation below is therefore about **one** page with two
view modes, not two pages.

---

## 1. Route

| | |
|---|---|
| Route | `/projects/[projectId]` — `app/(dashboard)/projects/[projectId]/page.tsx` |
| Rendering | `"use client"`, entirely client-fetched |
| Auth | dashboard layout guard |
| Permission (view) | route guard on the API; the page itself renders for anyone who can fetch |
| Deep links | **`?task=<id>` opens the task sheet** (read at line 224). The board/timeline view is **not** in the URL |

**Finding — view state is not addressable.** `useState<"board" \| "timeline">("board")`.
A refresh, a back-navigation or a shared link always lands on the board. The task deep
link exists; the view deep link does not.

---

## 2. Architecture and complexity

| File | Lines | Role |
|---|---|---|
| `projects/[projectId]/page.tsx` | 918 | page, board, DnD context, all dialogs |
| `projects/task-detail-sheet.tsx` | 1,829 | task detail — the largest component in the module |
| `projects/timeline-view.tsx` | 760 | Gantt |
| `projects/board-column.tsx` | 244 | droppable/sortable column |
| `projects/task-card.tsx` | 171 | sortable card |
| `projects/project-board-utils.ts` | 112 | default columns, initials |
| **Total in scope** | **~4,034** | plus 6 dialogs (create task, column, members, milestone, AI generate, delete confirm) |

Complexity: **high** — roughly 2× the Project CRM list converted in Phase 7, with a drag
interaction and a Gantt that the list did not have.

---

## 3. Page structure (actual)

```
PageHeader
  title      project.name  (legal/accounting: project.workstream || name)
  subtitle   project.description
  actions    Back · [Board | Timeline] toggle · Add Column* · Add Task · AI Generate
  ↓
Alert — approval lock          (only while workflowStatus is not approved/completed)
  ↓
Members strip                  8 avatars + "+N" · Manage*
  ↓
Custom fields strip            flex-wrap label/value pairs
  ↓
view === "timeline" ? TimelineView : DndContext → columns → cards
  ↓
Dialogs / TaskDetailSheet (?task=)
```

`*` owner-only.

---

## 4. Actions

| Action | Gate (UI) | API gate | Location | Class | Mobile importance |
|---|---|---|---|---|---|
| Back | none | — | header | secondary | low — nav chrome |
| Board / Timeline | none | — | header | **primary** | high |
| Add Column | `isOwner` + board view | `PROJECT_WRITE_PERMS` | header | secondary | low |
| Add Task | **none** | `PROJECT_WRITE_PERMS` + `assertWorkStarted` | header | **primary** | high |
| AI Generate | **none** | `PROJECT_WRITE_PERMS` | header | secondary | medium |
| Manage members / Add members | `isOwner` | `PROJECT_WRITE_PERMS` | members strip | secondary | low |
| Open task | none | read | card tap | **primary** | high |
| Move task (drag) | none | `PROJECT_WRITE_PERMS` + `assertWorkStarted` | card drag | **primary** | **high — see §11** |
| Reorder column (drag) | `isOwner` | `PROJECT_WRITE_PERMS` | column grip | secondary | low |
| Edit / delete column | `isOwner` | `PROJECT_WRITE_PERMS` | column menu | secondary | low |
| Reschedule task (Gantt drag) | none | `PROJECT_WRITE_PERMS` | timeline bar | secondary | medium |
| View the request | none | read | alert link | secondary | medium |

**Primary set for mobile:** Add Task · open task · move task · switch view.
**Destructive:** delete column (already behind an `AlertDialog` confirm).

---

## 5. Permissions and RBAC

Every board mutation is gated at the route with `requirePermission(...PROJECT_WRITE_PERMS)`,
and the approval lock is enforced **server-side** by `assertWorkStarted` at four call sites
in `projects.service.ts`, with its own regression suite (`workflow-team-gate.test.ts`).

**No security discrepancy was found.** Two non-security discrepancies to record:

1. **`isOwner` is identity-only** — `project.owner.id === user.id`. A system Admin, who
   holds every permission code, is **not** an owner, so the UI hides Add Column / Manage
   Members from them although the API would allow it. The UI is *stricter* than the API —
   the safe direction — but an admin cannot fix a board's structure from the UI.
2. **Add Task and AI Generate render unconditionally.** A user without
   `PROJECT_WRITE_PERMS`, or on a request still awaiting approval, is offered a button
   whose API call will be refused. The approval case is partly mitigated by the alert
   banner; the permission case is not. Again UI-permissive, API-authoritative — a UX
   defect, not a hole.

---

## 6. Views (there are no tabs)

The brief anticipates tabs. **Project Detail has none** — it has a two-option segmented
toggle (`board` / `timeline`) built from plain `<button>`s with `aria-pressed`.

Tabs *do* exist one level down, inside the task sheet: **All / Comments / History**.

| | |
|---|---|
| Count | 2 (page) · 3 (task sheet) |
| Longest label | "Timeline" (8 chars) · "Comments" (8) |
| Horizontal scroll | not needed at any width |
| URL-driven | **no** |
| Deep links | no (page views) |

**Step 7 conclusion: no tab-model change is required.** Two 8-character labels fit at
320px. Option A/B/C/D from the brief all solve a problem this page does not have. The
recommendation is **keep the existing segmented toggle** and spend the effort on the
board instead. The one genuine improvement is putting the view in the URL (§25).

---

## 7. Fields

| Field | Where | Class |
|---|---|---|
| Project name / workstream | header title | critical |
| Description | header subtitle | important |
| Workflow status | alert banner, only when blocked | **critical when present** |
| Members (8 avatars + overflow) | strip | important |
| Custom fields (variable, `label`/`value`) | flex-wrap strip | secondary — varies per team |
| Column labels + task counts | board | critical |
| Task title, description, assignee, due date, priority | card | critical |

Nothing here is a candidate for removal. The custom-fields strip is the one variable-length
block: it is `flex-wrap`, so it grows downward rather than sideways, and at 320px a project
with many custom fields will push the board well below the fold.

---

## 8. Long content

| Field | Risk | Current handling |
|---|---|---|
| Project name | high | `PageHeader` — inherits Phase 5A treatment |
| Task title | high | `truncate` (single line, clipped) |
| Task description | medium | `line-clamp-2` |
| Custom field values | medium | none — free text in a flex row |
| Comment bodies | high | sheet body, wraps |
| Attachment names / URLs | high | sheet list |
| Column labels | medium | inside a fixed 270px column |

**Recommendation (not implemented):** task titles should wrap to two lines on a card rather
than `truncate`, because a card is the only place the title appears before opening the task.
`break-anywhere`, already used by `RecordCard`, is the established treatment.

---

## 9. Activity, history and comments

All inside the task sheet, not the page. Merged into one stream: `detail.comments` and
`detail.activity` are combined and sorted by `createdAt`, then split across three tabs —
**All**, **Comments**, **History**.

| | |
|---|---|
| Order | chronological, merged |
| Author + timestamp | shown (`formatDateLong`) |
| Pagination | **none** — the whole stream is fetched and rendered |
| Loading | sheet-level |
| Expandable | no |

**Mobile recommendation:** keep the merged stream and the three tabs; they already fit. The
absence of pagination is a performance risk on a long-lived task (§14), not a layout one.

---

## 10. Attachments and tasks

**Attachments** live on the task, in the sheet, as one of three "resource" kinds —
`file | link | doc`. Upload is a hidden `<input type="file">` driven by a ref, through the
shared `uploadFile` service. On mobile, a file input opens the OS picker and the camera on
both iOS and Android with no extra work; **no new upload path is needed.**

**Tasks** are not a separate module — they *are* the board's cards, and the sheet is their
detail. They must stay embedded; there is nothing to link out to. The sheet also carries
**subtasks** (36 references) and **dependencies** (21 references), which makes it the
richest surface in the module.

---

## 11. Drag and drop — the decisive finding

### What is actually there

| | Task cards | Columns |
|---|---|---|
| Hook | `useSortable` on the card root | `useSortable` + `setActivatorNodeRef` |
| Handle | **the whole card** (`{...listeners}` on the root div) | a dedicated `<button>` grip |
| `touch-action` | **not set** | **`touch-none`** |
| Accessible name | — | `aria-label="Reorder column"` |
| Tap vs drag | manual: `pointerDownPos` + a 5px threshold in `onClick` | n/a |

Sensors: `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))`
— **one sensor, distance-only, no delay, and no `KeyboardSensor`.**

Library: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`.

### Why cards will not drag on touch

Two facts read directly from the installed bundle:

1. dnd-kit sets `touchAction: 'none'` **only on the DragOverlay** (`baseStyles` in
   `PositionedOverlay`). It does **not** set it on draggables — that is documented as the
   consumer's job.
2. `PointerSensor`'s cancel event is **`pointercancel`**.

So on a touchscreen: the card computes `touch-action: auto`, the browser is free to claim
the gesture as a scroll, and when it does it fires `pointercancel` — which is precisely the
event dnd-kit listens for to abort the drag. The 8px distance constraint is also the
distance at which a scroll begins, so the two race on every touch.

**Net effect: scrolling wins and the card drag aborts.** Columns, whose grip carries
`touch-none`, are the opposite — they *would* drag on touch and would not scroll.

**Uncertainty, stated honestly:** the exact point at which a browser claims a gesture
differs between iOS Safari and Android Chrome, so the failure may present as "never drags",
"drags occasionally", or "picks up a card and then drops it back". It was **not tested on a
real device** — this is read from the sensor contract and the CSS, not observed. What is not
uncertain is that the current configuration is not the touch-ready one.

**The correct pattern already exists in this repo** — the column grip is exactly dnd-kit's
documented touch setup. The task card simply does not use it.

### Keyboard

No `KeyboardSensor` is registered, so **board drag-and-drop is not keyboard-operable at all**,
on any device. Pre-existing; recorded, not fixed.

### The Timeline is worse

`timeline-view.tsx` drives its Gantt drag with `onMouseDown` plus
`window.addEventListener("mousemove" / "mouseup")` — **raw mouse events, no pointer or touch
handling anywhere.** Touch browsers do not emit `mousemove` during a touch gesture, so
**drag-to-reschedule is definitively non-functional on touch**, with no uncertainty.

---

## 12. Board geometry

Columns are `w-[270px] shrink-0` in a `flex w-max gap-4` row inside `overflow-x-auto`.

| Columns | Board width | Visible at 390px (≈358px content) |
|---|---|---|
| 5 (default) | **1,414px** | ~1.3 columns |
| 7 | 1,962px | ~1.3 columns |

Five default columns ship (`Backlog · To Do · In Progress · …`), but columns are
**user-configurable per project** — Add / edit / delete / reorder — so any mobile model must
handle a variable, unbounded column count.

At 390px a horizontal board shows roughly **one column at a time**, with the other four
off-screen and no indication of their contents.

---

## 13. API inventory

| Call | Route | Purpose | Mutation |
|---|---|---|---|
| `getProject` | `GET /projects/:id` | project + tasks + columns + members | no |
| `getMilestones` | `GET /projects/:id/milestones` | milestones | no |
| `getTimeline` | `GET /projects/:id/timeline` | Gantt snapshot | no |
| `listAssignableUsers` | `GET /directory/assignable?limit=200` | assignee picker | no |
| `reorderTasks` | `POST /projects/:id/tasks/reorder` | drag result | yes |
| `updateTask` | `PUT /projects/:id/tasks/:taskId` | inline + Gantt reschedule | yes |
| `deleteColumn` | `DELETE /projects/:id/columns/:columnId` | column | yes |
| task detail / comments / assignees / dependencies | `/projects/:id/tasks/:taskId/*` | sheet | mixed |

53 routes exist on the projects controller. **No mobile-specific API is required** — every
mobile model below is a presentation of `getProject`'s existing payload.

---

## 14. Data fetching

- All client-side, on mount, in `useEffect`.
- `getProject` is the single source for tasks, columns and members — one request, not three.
- `getTimeline` is **dependent and lazy**: fetched only when `view === "timeline"` (line 284).
- `listAssignableUsers` fetches **200 users on mount**, whether or not anybody opens a picker.
- Mutations are **optimistic with rollback**: local state updates first, and a failure calls
  `fetchProject()` to resnap to the server (lines 392–394, 466–469).

**Findings, documented not fixed:**

1. **The 200-user directory fetch is unconditional.** The requests queue already
   demonstrates the better pattern — fetch the directory when the picker opens. On a phone
   this is a wasted request on every board open.
2. **No pagination anywhere** — all tasks, all comments, all activity arrive in full.
3. **Rollback re-fetches the whole project** for a single failed card move.

---

## 15. Mobile Kanban options — scoring

Scored 1–5. **Complexity is scored so 5 = simplest**, so the total reads consistently.

| Option | Usability | Workflow | Touch DnD | Discoverability | A11y | Simplicity | Perf | Consistency | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| **A** Horizontal kanban (today's board) | 2 | 5 | 1 | 3 | 2 | 4 | 4 | 3 | **24** |
| **B** Status dropdown + card list | 4 | 4 | 4 | 3 | 4 | 3 | 5 | 3 | **30** |
| **C** Status tabs + card list | 4 | 4 | 4 | 4 | 4 | 3 | 5 | 5 | **33** |
| **D** Flat list + status filter | 4 | 2 | 3 | 3 | 4 | 4 | 5 | 4 | **29** |
| **E** Tabs + horizontal peek hybrid | 4 | 5 | 2 | 4 | 3 | 1 | 3 | 2 | **24** |

Notes behind the numbers, so they can be argued with:

- **A scores 1 on touch DnD** because it is today's behaviour, which §11 shows does not
  work — and "fix it with `touch-action: none`" makes the board unscrollable by touching a
  card, trading one broken gesture for another.
- **A scores 2 on usability** on the 1.3-columns-at-390px measurement, not on taste.
- **C beats B on discoverability** because a tab strip can carry each status's task count in
  the strip itself; a closed dropdown shows one status and hides the rest.
- **C scores 5 on consistency**: the scrolling tab strip with per-tab counts is *exactly*
  the pattern shipped for Project Requests in Phase 7A, `allow-x-scroll` and all.
- **D loses 3 points on workflow** because it discards the board metaphor rather than
  adapting it — a project manager loses "where is everything" at a glance.
- **E is honest about its cost**: best workflow fidelity, worst complexity, and it still
  inherits A's drag problem.

---

## 16. Recommendation

### Project Board, mobile: **Option C — status tabs + card list, with an explicit "Move to…" action replacing drag.**

**Why it fits.** Columns already *are* statuses (`tasksByStatus[col.key]`), so a tab per
column is a relabelling of the existing data structure, not a new one. The tab strip,
scrolling behaviour, count badges and `role="tablist"` semantics already exist in this
codebase and handle a variable column count — which this board needs, because columns are
user-configurable.

**What it preserves.** Same route, same `getProject` payload, same columns, same statuses,
same `reorderTasks` / `updateTask` mutations, same permissions, same approval lock, same
`?task=` deep link. The board metaphor survives as "which status am I looking at, and how
many are in each".

**What changes.** Moving a task becomes an explicit **"Move to…"** action on the card —
a bottom sheet listing the other columns — instead of a drag. It calls the *same*
`reorderTasks` endpoint the drag calls.

**What users gain.** A move that actually works on touch; a readable card instead of a
270px column fragment; per-status counts visible at a glance; keyboard and screen-reader
operability that the drag has never had on any device.

**What users lose.** Cross-column drag as a gesture, and seeing two statuses side by side.
For a project manager triaging on a laptop that matters; on a 390px screen showing 1.3
columns, it is already lost.

**Why the alternatives are weaker.** A keeps a gesture that does not work. B hides the
other statuses behind a closed control. D throws the board away. E costs the most and still
inherits A's defect.

### Project Detail, mobile

Keep the single-column stack, in this order: header + primary actions → approval alert →
board/timeline switch → status tabs → cards. Demote **Add Column**, **AI Generate** and
**Manage Members** into an overflow menu; keep **Add Task** and the view switch on the face.
Collapse the custom-fields strip behind a "Details" disclosure so it cannot push the board
below the fold.

### Tablet

| Width | Board |
|---|---|
| 768 | **mobile model** (tabs + list) — 1,414px of board in 768px is 2.8 columns |
| 834 | **mobile model** |
| 900 | **mobile model** |
| 1024 | **desktop board** — 3.8 columns visible, mouse/trackpad likely |
| 1280+ | **desktop board**, unchanged |

Breakpoint: **`lg` (1024px)** — the same value Phase 7B-0 added `cardBreakpoint` for and
Phase 7A adopted on the request queue. Consistent, and justified by the 270px column
arithmetic rather than by symmetry.

**Caveat to state plainly:** an iPad at 1024px in landscape gets the desktop board *and*
the broken touch drag. Either the touch fix in §18.1 lands with it, or the breakpoint goes
to `xl`. That is a real decision, not a detail.

### Desktop preservation

No change at ≥1024px: same board, same columns, same drag, same permissions, same
styling. The mobile model is an additional branch, not a replacement — the same shape as
Phase 7 and 7A.

### The decisions, stated without hedging

| | |
|---|---|
| **Project Detail mobile model** | Single-column stack; primary actions on the face, rest in an overflow |
| **Project Board mobile model** | **Option C** — status tabs + card list |
| **Tablet model** | Mobile model below `lg` (1024px); desktop board at and above |
| **Primary action location** | `Add Task` + view switch in the header; per-card actions on the card face (`RecordCard` action bar, per Phase 7B-0/7B-1) |
| **Tab model** | Page views: **keep the existing 2-option segmented toggle** (no change needed). Board statuses: the Phase 7A scrolling tab strip with count badges |
| **Drag/drop model** | **Desktop: unchanged drag. Mobile: explicit "Move to…" bottom sheet calling the same endpoint.** Fix the card's touch wiring to match the column grip so desktop-class touch devices are not left with a broken gesture |

---

## 17. Component reuse

**Reusable as-is:** `PageHeader`, `RecordCard` (title/badge/fields/details/**actions** —
hardened for exactly this in 7B-0/7B-1), `ResponsiveActions`, `BottomSheet`, `StatusBadge`,
`SearchInput`, `FilterSheet` / `useFilterDraft`, `EmptyState`, `StateView`, `ListSkeleton`,
`ResponsiveDialog`, `Sheet`, `AlertDialog`, and the Phase 7A tab-strip pattern.

**Genuine gaps — two, neither to be built in this phase:**

| Name | Purpose | Why nothing existing fits | Consumers |
|---|---|---|---|
| `MoveToSheet` | pick a destination status for a task | `BottomSheet` is a container; this needs the column list, the current status marked, and the `reorderTasks` call | board; any future status-moving list |
| `TaskMobileCard` | a task as a card | `RecordCard` handles the shape, but the task's assignee avatar, priority and due-date treatment need a wrapper — the same relationship `ProjectMobileCard` has to `RecordCard` | board tabs; possibly the timeline list |

`ProjectMobileCard` (Phase 7) is the precedent for both: a thin module-specific wrapper over
a shared primitive, not a new primitive.

---

## 18. Risks

### 18.1 Accessibility
- **No `KeyboardSensor`** — board DnD is keyboard-inoperable on every device. The "Move to…"
  action fixes this as a side effect, which is a genuine argument for Option C.
- Column grip is `size-4` + `p-0.5` ≈ **20px**, below the 44px minimum.
- Task card is a `<div>` with click handlers, not a button — no keyboard activation, no
  focus ring, no role.
- Custom-field strip uses `<span>` pairs with no semantic label association.
- Task title `truncate` removes information with no accessible full text.
- **No scanner was run; no WCAG conformance is claimed.**

### 18.2 Performance
- `listAssignableUsers` fetches **200 users on every board open**, unconditionally.
- No pagination on tasks, comments or activity.
- A single failed card move re-fetches the entire project.
- `getProject` returns tasks + columns + members in one payload; large projects render every
  card in every column at once, with no virtualisation.

### 18.3 Security
- No discrepancy found; the approval lock is server-enforced and tested (§5).
- `?task=` carries an id only — no sensitive data in the URL.
- Attachments go through the shared upload service; the `documents` bucket is private and
  served by signed URL (CLAUDE.md convention).
- **Nothing about the mobile model exposes a field the desktop does not.** Any conversion
  must render from the same payload and must not surface fields the API withholds.

### 18.4 PWA
- `/api/*` is never intercepted by the service worker (Phase 3 rule) — **project data must
  stay uncached**, and no offline board should be built.
- Push already deep-links to `/projects/requests/:id` (Phase 7A). If a task-level push is
  ever added, `?task=` is the existing, safe, root-relative target.
- View state is not in the URL, so a PWA cold start after a notification cannot restore the
  timeline (§25).

---

## 19. Implementation plan for the next phase

Nothing below is built in this phase.

| # | Work | Complexity |
|---|---|---|
| 1 | **Shared:** `TaskMobileCard` over `RecordCard`; `MoveToSheet` over `BottomSheet` | Medium |
| 2 | **Detail page:** responsive header, overflow menu for secondary actions, collapse the custom-fields strip, put the view in the URL | Medium |
| 3 | **Board:** status tab strip + card list below `lg`; desktop board untouched above | Medium |
| 4 | **Move interaction:** "Move to…" on each card calling the existing `reorderTasks` | Medium |
| 5 | **Touch drag repair:** give the task card an activator handle with `touch-none`, matching the column grip; add a `KeyboardSensor` | Medium |
| 6 | **Timeline:** decide whether the Gantt gets a mobile model at all, or is desktop-only with an honest message. Its drag is mouse-only and rewriting it is its own phase | High |
| 7 | **Task sheet:** already partly responsive; audit `grid-cols-[120px_1fr_1fr_auto]` (line 1176) and the sub-grids at 320px | Low |
| 8 | **Accessibility:** card as a real button, 44px column grip, field label association | Low |
| 9 | **Testing:** tab/card mapping, move-sheet calls the same endpoint, permission parity, approval lock still blocks, desktop regression | Medium |
| 10 | **Browser verification** at the standard width matrix | Low |
| 11 | **Authenticated verification** — still outstanding across every phase | Medium |

**Suggested split:** items 1–4 + 9–10 as Phase 7C (the board), items 5–8 as Phase 7D
(interaction and a11y repair), item 6 decided separately as a product question.

---

## 20. Known limitations of this audit

1. **Nothing was rendered.** The page needs a session and a real project; no authenticated
   pass was possible, so this is a source-and-bundle audit. No measurement of the real board
   with real data was taken.
2. **Touch drag was not tested on a device** (§11). The conclusion is derived from the
   sensor's cancel contract and the absence of `touch-action`, which is strong but not
   observation.
3. **Column counts in the wild are unknown.** Five ship by default; projects can add more.
   The 1,414px figure is the default, not the worst case.
4. **Task volume per column is unknown**, so the virtualisation question (§18.2) is flagged,
   not sized.
5. **The Gantt was audited only for its input model**, not its full layout behaviour.
6. **No accessibility scanner, no performance profiler** was run.
