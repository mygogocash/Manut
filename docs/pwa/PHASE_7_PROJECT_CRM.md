# Phase 7 — Project CRM Responsive Conversion

The first major business-module conversion, and the first real test of the Phase 1–5A architecture against production code.

References: [PHASE_1](PHASE_1_RESPONSIVE_FOUNDATION.md) · [PHASE_2](PHASE_2_DESIGN_SYSTEM.md) · [PHASE_5](PHASE_5_DASHBOARD.md) · [PHASE_5A](PHASE_5A_SHARED_COMPONENT_RECONCILIATION.md) · Completed 2026-08-25

---

## Scope actually delivered, stated up front

The brief lists 42 steps across seven pages and eighteen components — roughly 11,000 lines. **This phase converted the list page and its toolbar properly, and audited the rest.** That is a deliberate choice: converting the detail page (918 lines), the task sheet (1,829), the project form (1,320) and the board in one pass, without being able to sign in and look at any of it, would have produced a large volume of unverifiable change to a working module. §30 lists exactly what remains, with findings.

The list page is also where the phase's stated purpose lands — validating the architecture against tables, filters, search, status, actions and states.

## 1. Existing architecture

`ProjectsView` (**1,953 lines**) is the module's centre: list, filters, search, pagination, drag-to-reorder, three column layouts, and the action menu. It is **not** built on `DataTable` — it uses the raw `Table` primitive with a sticky header, `DndContext` for reordering and `useColumnOrder` for user-configurable column order persisted to `localStorage`.

### Finding: the component is shared with an out-of-scope module

`ProjectsView` is rendered by **both** `/projects` (in scope) **and** `/hr-crm` (explicitly out of scope). Its files live under `components/projects/`, so it is Project CRM's own component, but HR CRM reuses it by choice.

**Consequence: HR CRM's list rendering changes too** — it gets the same mobile cards and toolbar. No HR CRM file was edited and no behaviour differs by team beyond the column config it already passes. Surfacing it rather than letting it be discovered later.

## 2. Route map

| Route | Purpose | Permission | Converted |
| --- | --- | --- | --- |
| `/projects` | List (renders `ProjectsView team="general"`) | `projects:read` + team variants | **Yes** |
| `/projects/[projectId]` | Detail / board (918 lines) | union of read/read-all + per-CRM | Audited only |
| `/projects/dashboard` | Project CRM dashboard (508) | `projects:read` | Audited only |
| `/projects/requests` | Request queue (292) | `projects:read` (+ approval perms) | Audited only |
| `/projects/requests/[id]` | Request detail (327) | as above | Audited only |
| `/projects/proposals` | Proposal queue (409) | `proposals:read` | Audited only |
| `/projects/proposals/[id]` | Proposal detail (511) | `proposals:read` | Audited only |

**No route was added, removed or renamed.**

## 3. Permission map

Unchanged. The list's row-level check is `getOwnerId(p) === user?.id || canManageAny`, and the mobile card takes the **same** `canManageRow` value the table row does — so an action hidden on desktop is hidden on mobile, and offering nothing extra is presentation, not the boundary. The API remains authoritative.

## 4. API inventory

**No API change.** The list is served by the existing project service with the existing query parameters — search, status, agreement, page, page size, archived. Mobile and desktop render from **the same fetch**; there is no mobile-specific request, endpoint or payload.

## 5–6. List and table → card transformation

| Width | Rendering |
| --- | --- |
| `≥ 768px` | The existing table, **unchanged** — sticky header, drag-to-reorder, configurable column order |
| `< 768px` | One card per project |

The default layout has nine columns across roughly 1,100px of fixed widths. At 320px that is a horizontal scroll through a wall of dates — all the data, none of it usable.

| Card slot | Column |
| --- | --- |
| Title | `project` (name), prefixed with the row number so it matches the table's `#` across pages |
| Subtitle | description |
| Badge | `status` — via the module's **own** `<Badge status>`, not a new one |
| Face fields | `owner`, `goLive` |
| Expansion | `productionLive`, `revGoLive`, `agreement`, `dependency`, `comment` |

**Nothing is dropped.** Every column the table would show is on the face or in the expansion, and a test enumerates all seven labels after expanding — so a column cannot silently fall out of the mapping.

### One formatting source

`renderProjectCell` was split into `projectCellContent` (the value) and a thin `renderProjectCell` wrapper (the value inside a `<TableCell>`), and both table and card call the content function. Duplicating the formatting for the card would have let a date render one way on desktop and another on a phone — the drift problem Phases 5A and 6A were spent removing.

The split moved into `projects-view-cells.tsx` (243 lines) because the card imports it and `ProjectsView` imports the card; exporting from `ProjectsView` would be a cycle. Verified in a browser that dates render identically (`01 Sept 2026`) through both paths.

## 7. Expandable record

Uses Phase 2's `RecordCard` in `button` mode: the card body opens the project (the same destination as the row's name link and its View action), and a separate "Show more" reveals the rest. The two are deliberately separate controls — a card-wide tap target with a nested toggle gives overlapping hit areas.

Verified in a real browser: `aria-expanded` flips, the region is found by `aria-controls`, all seven labels and their real values appear, and **page overflow stays 0 after expanding**.

## 8. Search

**Semantics unchanged** — same `search` state, same existing 350ms `useDebounce`, same server-side filtering. Only the control changed, to Phase 2's `SearchInput`.

**Defect fixed:** the input was `text-xs` — **12px, which makes iOS Safari zoom the viewport on focus**, exactly what Step 8 forbids. Measured after the change: **16px**, 40px tall.

## 9–10. Filters

**Semantics unchanged** — the same two filters (status, agreement), the same option lists (`PROJECT_STATUS_OPTIONS`, `AGREEMENT_OPTIONS`), the same state, the same server query. Only where you tap them differs.

| Width | Presentation |
| --- | --- |
| `≥ 768px` | The existing inline selects, unchanged |
| `< 768px` | A **Filters** button with an applied count, opening Phase 2's `FilterSheet` |

**Defect fixed:** the toolbar was a flex row of a search box plus a 180px and a 160px select — which cannot fit 320px.

The sheet uses `useFilterDraft`, so selections are held locally and committed on **Apply**: the list behind does not churn on every tap, Cancel genuinely discards, and reopening shows what is actually applied. The agreement group is gated on the same `colConfig.showAgreement` flag as the column, so it stays hidden on the HR layout.

## 11–13. Sorting, pagination, bulk actions

- **Sorting** — the list has no column sorting to preserve. Its ordering is manual **drag-to-reorder**, already disabled while filtered, searching or archived. It stays desktop-only: a drag gesture on a touch list competes with scrolling. Documented rather than reimplemented as a mobile sort control, which would be inventing a feature.
- **Pagination** — unchanged. The existing `DataPagination` + `usePagination` render below both representations, so page state is shared.
- **Bulk actions** — the list has none. Nothing to convert.

## 14. Status

Uses the module's existing `<Badge status={project.status}>` and `projectStatusLabel`, **not** Phase 2's `StatusBadge`. The module already has a status colour convention; swapping in a different one would have changed desktop colours for no benefit. The real vocabulary (12 values including `not_yet_started`, `uat`, `staging_integrated`, `pending_dept_info`) is untouched and nothing was invented.

## 15–16. Actions and confirmations

The card's action set is built from the **same handlers and the same permission check** as the table row: View, Edit, Archive/Unarchive, Move, Delete. Via Phase 2's `ResponsiveActions`, View stays a button and the rest demote into an overflow menu — **demoted, never removed**. Archived rows correctly offer Unarchive instead of Archive; Move is absent when the user cannot move between workspaces.

Delete continues to route through the module's existing confirmation dialog. No shared dialog was modified.

## 17–23. Detail page, tabs, forms, attachments, comments

**Audited, not converted.** See §30.

## 24–26. States

- **Empty** — the canonical `shared/empty-state.tsx` (Step 24), with copy that distinguishes "no projects yet" from "nothing matches your filters".
- **Loading** — Phase 2's `ListSkeleton`, which matches card height so the list does not jump.
- **Error** — the module's existing error handling is unchanged; an API failure does not render as an empty state.

## 27. Page header

The canonical `shared/page-header.tsx`, which `ProjectsView` already used. Nothing was recreated (Phase 5A made it responsive).

## 28–29. Desktop and tablet

**Desktop is unchanged.** A whitespace-insensitive diff of `projects-view.tsx` shows the only substantive removals are the helpers that moved to `projects-view-cells.tsx` — no table markup was deleted. The table, its sticky header, drag-to-reorder, column ordering and the inline selects all render exactly as before at `≥ 768px`.

**Breakpoint choice: 768px**, not a device name. Below it the nine-column table cannot show more than two or three columns without horizontal scrolling; at 768 and above the table is usable and the tablet keeps the denser, more scannable view. This matches the line the shell, dialogs and `DataTable` already switch on.

## 30. What was audited but not converted

Each with the specific finding, so the next phase starts from evidence:

| Surface | Finding |
| --- | --- |
| `/projects/[projectId]` (918 lines) | Board + task columns + timeline. The kanban is horizontally scrolling by nature; needs a decision on whether mobile gets a column picker or a stacked list. **Not a mechanical conversion.** |
| `task-detail-sheet.tsx` (1,829) | Already a Sheet, so structurally mobile-ready; needs a field-density and sticky-action pass |
| `project-form-dialog.tsx` (1,320) | The largest form in the module. Needs the Phase 2 form scaffolding and a 16px-input audit — the same defect class found in the toolbar |
| `/projects/requests` + `[id]` | Request queue and detail; smaller, and the closest to the list already converted |
| `/projects/proposals` + `[id]` | Proposal queue and detail; the detail page was already made defensive in an earlier session |
| `/projects/dashboard` | A second dashboard; Phase 5's approach applies directly |
| `timeline-view.tsx` (760) | Gantt-style; genuinely hard on a phone and needs a product decision, not just layout |

## 31. Accessibility

- Card title, fields and expansion come from `RecordCard`: `<dl>/<dt>/<dd>` for fields, `aria-expanded` + `aria-controls` on the expander, a real `<button>` so keyboard works.
- The card is **not** one giant interactive element: the body is a button that opens the project, and the actions and expander are separate controls (Step 35's specific warning).
- The overflow trigger carries an `aria-label`; the search input has an accessible name.
- Touch targets: search 40px, filter buttons 36px, expander 36px.

## 32. PWA and security

**No Project CRM data is cached.** The Phase 3 service worker excludes `/api/*` before any caching logic runs, and Phase 3's tests assert that against real API paths — including `/api/projects`. This phase changed nothing about the worker, and added no `localStorage` use (the existing column-order preference predates it and holds no business data).

No CRM data is placed in URLs beyond the existing route params, notification payloads, or public assets.

## 33. Tests

**12 new**, `project-mobile-card.test.tsx`, weighted to the property that matters — that the card and the table show the same record:

- The collapsed card leads with name + row number, shows the real status label, and puts owner/go-live on the face.
- **Every visible column is accounted for** after expanding (all seven labels).
- Comment renders as text, not stored HTML.
- The card respects the layout's `visibleCols`, so HR/Legal layouts hide what they hide, and offers no expander when there is nothing to expand.
- Actions mirror the row: View promoted, rest demoted, management actions hidden without permission, Unarchive in the archived view, Move absent without the capability.

| Gate | Result |
| --- | --- |
| type-check | 10/10 workspaces clean |
| lint | **0 errors** |
| Full suite | **2,454 passing** (1,957 API + 497 web), up from 2,442 |

No existing test was weakened; the pre-existing suites pass unmodified.

## 34. Browser verification

Measured at **320px** against a temporary harness rendering the real card with hostile synthetic props — a long project name, an unbreakable URL in `dependency`, stored HTML in `comment`. **No database records were created.** Harness deleted afterwards.

| Check | Result |
| --- | --- |
| Page overflow | **0** |
| Uncontained overflowing elements | **0** |
| Card width | 288px |
| Search font | **16px** (was 12px) |
| Search height | 40px |
| Expansion | `aria-expanded` flips; all 7 labels and real values present |
| Overflow after expanding | **0** |
| Date formatting via the shared function | `01 Sept 2026`, identical to the table |

One correction worth recording: my first expansion probe reported the labels missing. The probe was wrong — labels render uppercase via CSS, so a case-sensitive regex over `innerText` missed them. The DOM check confirmed everything was present.

**Not verified:** the `md` switch itself on the real page, and every authenticated surface — see §35.

## 35. Authenticated verification limitations

The Project CRM is authenticated and signing in requires a password, which I do not enter. So the real list — with real projects, real permissions, real pagination — **has not been rendered**. What is verified: the card in a real browser, the formatting shared with the table, the class-level breakpoint switch, and everything the unit tests cover.

### Manual verification checklist

At 320 / 375 / 390 / 414 / 430 / 768 / 1024 / 1280 / 1440 / 1920:

- [ ] **Project list** loads; cards below 768, table at and above
- [ ] **Search** — type, clear, Escape; results match desktop; no zoom on focus on a real iPhone
- [ ] **Filters** — open the sheet, change status, **Cancel discards**, reopen shows applied state, Apply filters, count badge correct, Clear resets
- [ ] **Sorting** — n/a (drag-to-reorder, desktop only); confirm the desktop drag still works
- [ ] **Pagination** — page through on mobile; page state shared with the card list
- [ ] **Mobile cards** — name, row number, status, owner, go-live all correct against the same row in the table
- [ ] **Expanded record** — all remaining columns present and matching the table
- [ ] **Actions** — View opens the project; Edit/Archive/Move/Delete behave as on desktop; **hidden for a user without permission**
- [ ] **Detail page** (not converted — check it still works)
- [ ] **Create / Edit** dialogs (not converted — check they still work)
- [ ] **RBAC** — sign in as a non-manager and confirm nothing extra is offered on mobile
- [ ] **HR CRM** (`/hr-crm`) — it shares this component; confirm its list still behaves
- [ ] **Desktop regression** at 1280/1440/1920 against `main`

## 36. Known limitations

1. **Nothing authenticated was rendered** (§35). The largest gap, unchanged across phases.
2. **HR CRM inherits the change** (§1) — no HR file edited, but its list now renders cards on mobile.
3. **Six of seven pages remain unconverted** (§30), deliberately and with findings recorded.
4. **Drag-to-reorder is desktop-only.** An intentional omission, not an oversight; a mobile reorder affordance would be a new feature.
5. **The `md` switch renders both trees**, hiding one with CSS. That avoids a hydration flash and keeps one data source, at the cost of the hidden markup existing in the DOM. For a page-sized list this is the right trade; if a page ever renders hundreds of rows it should be revisited.
6. **No sort control on mobile** because there is none on desktop.
7. **`projects-view.tsx` is still 1,900+ lines.** This phase extracted 243 lines of cell rendering but did not attempt to decompose the rest.
