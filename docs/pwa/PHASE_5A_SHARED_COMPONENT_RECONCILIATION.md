# Phase 5A — Shared Component Reconciliation

A small architectural cleanup. **No features, no business logic, no redesign.**

References: [PHASE_1](PHASE_1_RESPONSIVE_FOUNDATION.md) · [PHASE_2](PHASE_2_DESIGN_SYSTEM.md) · [PHASE_5](PHASE_5_DASHBOARD.md) · Completed 2026-08-24

---

## 1. Duplicate components identified

Both introduced by me in Phase 2, and both flagged in the Phase 5 report:

| Concept | Pre-existing | Phase 2 addition | Real consumers of the addition |
| --- | --- | --- | --- |
| Page title row | `shared/page-header.tsx` (**99 consumers**) | `PageHeader` inside `responsive/page-container.tsx` | **0** — only the barrel re-exported it |
| Empty state | `shared/empty-state.tsx` (8 consumers, built on `ui/empty`) | `StateView` (5 states) | **0** — only its own test |

That neither duplicate had a single real consumer is what made this phase cheap and low-risk: no page had to be migrated.

## 2. PageHeader audit

| | `shared/page-header.tsx` | `responsive/PageHeader` (Phase 2) |
| --- | --- | --- |
| Props | `title: string`, `subtitle?`, `children` (actions), `className` | `title: ReactNode`, `description?`, `actions?`, div props |
| Title | `font-serif text-3xl font-normal` | `text-lg sm:text-xl font-semibold` |
| Layout | `mb-6 flex items-start justify-between` | `flex-col gap-3 sm:flex-row sm:justify-between` |
| Responsive | **none** | yes |
| `min-w-0` | **no** | yes |
| Action wrapping | **no** | yes |
| Consumers | **99** | 0 |
| Tests | **none** | none |

**Overlap:** the entire concept.
**Unique to the existing one:** the app's actual page-title identity, and 99 consumers.
**Unique to the Phase 2 one:** the responsive layout.

Used by the dashboard: the **existing** one. Used by every other page: the **existing** one.

## 3. PageHeader canonical decision

**`shared/page-header.tsx` is canonical.** The Phase 2 duplicate was deleted.

The decisive point is visual identity, not consumer count. The existing component renders a **serif, 30px, weight-400** page title — that is the product's established look. The Phase 2 component rendered a **sans, 20px, semibold** title, which was a different design invented for a component nobody had adopted yet. Making that canonical would have restyled all 99 pages under the banner of "removing duplication", which is precisely the broad refactor the brief forbids.

So the canonical component gained **only the responsive layout it lacked**, and nothing else:

| Property | Before | After |
| --- | --- | --- |
| Row | `flex items-start justify-between` | `flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4` |
| Text column | *(no min-width reset)* | `min-w-0` |
| Title | `text-3xl` | `text-2xl sm:text-3xl` + `text-balance` |
| Actions | `flex items-center gap-2 pt-0.5` | `flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5` |
| Bottom margin | `mb-6` | `mb-4 sm:mb-6` |

Font family, weight, tracking, subtitle treatment and desktop size are untouched.

## 4. PageHeader migration

**None required** — the duplicate had zero consumers. Nothing was rewritten, no prop was renamed, no import in any of the 99 consumers changed. Consumer count re-counted after the change: still 99.

## 5. StateView / EmptyState audit

These are **not** the same concept.

| Capability | `EmptyState` | `StateView` |
| --- | --- | --- |
| Empty | yes (canonical look, `ui/empty` primitives) | yes — **the overlap** |
| Loading skeletons | no | yes |
| Error + retry | no | yes |
| Permission denied | no | yes |
| Success | no | yes |
| `role="status"` / `role="alert"` | no | yes |
| Compact variant | yes | yes |
| Consumers | 8 | 0 |
| Tests | yes (pre-existing) | yes (Phase 2) |

The overlap is exactly one case: *empty*.

## 6. Canonical state decision

**Both retained, with the overlap removed.**

- `EmptyState` is canonical for "there is nothing here". It has the consumers, the established typography, and is built on the `ui/empty` primitives.
- `StateView` keeps the broader role — loading, error, permission-denied, success — which `EmptyState` does not model and should not be stretched to.
- **`StateView kind="empty"` now delegates to `EmptyState`.** Its `title`/`message` map to `title`/`description`, and `action` + `secondaryAction` become its children.

This satisfies the brief's actual instruction — *eliminate duplication, not useful abstraction*. Collapsing loading skeletons and retry semantics into `EmptyState` would have produced one component doing four jobs; leaving two renderings of "empty" would have left the duplication in place. Delegation removes the duplicate rendering and keeps the distinction.

Verified at runtime: on the check page, the direct `EmptyState` and the delegated `StateView` both produce `[data-slot="empty"]` — **one implementation, two entry points**.

## 7. Migration performed

| Change | Consumers affected |
| --- | --- |
| Deleted `PageHeader` from `responsive/page-container.tsx` | 0 |
| Removed it from the responsive barrel | 0 |
| Made `shared/page-header.tsx` responsive | 99 — layout only, desktop unchanged |
| `StateView kind="empty"` → delegates to `EmptyState` | 0 |
| Removed the now-unused `Inbox` import and `empty` preset from `StateView` | 0 |

No consumer of either component had to be edited.

## 8. Components intentionally retained

| Component | Why |
| --- | --- |
| `StateView` | Models loading / error / permission-denied / success, which `EmptyState` does not. Ready for Project CRM's list states |
| `EmptyState` | Canonical empty rendering, 8 consumers, correct typography |
| `PageContainer`, `ResponsiveGrid`, etc. | No duplicate exists; unrelated to this reconciliation |
| `ui/empty` primitives | The substrate `EmptyState` composes |

## 9. Dead code removed

Confirmed unused before deletion, by grep **and** by type-check, lint and the full suite passing afterwards:

- `PageHeader` and `PageHeaderProps` from `responsive/page-container.tsx`
- its barrel export
- the `Inbox` icon import and the `empty` entry in `StateView`'s preset map

Nothing was removed on the strength of a search alone.

## 10. Components ready for Project CRM

| Need | Component | Status |
| --- | --- | --- |
| PageHeader | `shared/page-header` | canonical, responsive, tested |
| DataTable | `shared/data-table` | card mode below 768px (Phase 1) |
| DataCard | `responsive/DataCard` | Phase 2 |
| Expandable records | `responsive/RecordCard` | `expandMode="row"` (Phase 2) |
| StatusBadge | `responsive/StatusBadge` | semantic map, Phase 2 |
| SearchInput | `responsive/SearchInput` | Phase 2 |
| FilterChip / FilterBar / FilterSheet / FilterGroup | `responsive/filters` | Phase 2, with `useFilterDraft` |
| Action strips | `responsive/ResponsiveActions`, `ActionStrip` | Phase 2 |
| Loading | `StateView kind="loading"`, `ListSkeleton`, `CardSkeleton`, `PageSkeleton`, `LoadingButton` | Phase 2 |
| Empty | `EmptyState` (canonical) | via `StateView` or directly |
| Error | `StateView kind="error"` | with retry |

**No further duplication expected.** The one trap Project CRM should avoid is importing `PageHeader` from the responsive barrel — it is not there any more, and `shared/page-header` is the only one.

## 11. Tests

**13 new tests**, `shared/page-header.test.tsx` — the component had **none**, which was uncomfortable for something with 99 consumers.

They lock down both halves of the decision: the **visual identity** (serif, `sm:text-3xl`, `font-normal`, subtitle treatment) so nobody "modernises" it and silently restyles the product, and the **responsive layout** (stacking, `min-w-0`, action wrapping, title step-down, `text-balance`, no truncation). Plus content behaviour: h1 semantics, conditional subtitle, actions, no empty action container, and className merging.

Existing coverage was not reduced: the pre-existing `empty-state.test.tsx` and the Phase 2 `design-system.test.tsx` StateView tests both still pass unchanged — the delegation kept them green, which is itself evidence the behaviour is preserved.

| Gate | Result |
| --- | --- |
| type-check | 10/10 workspaces clean |
| lint | **0 errors** |
| Full suite | **2,392 passing** (1,911 API + 481 web), up from 2,379 |

## 12. Regression verification

Measured in a real browser against a temporary route rendering the canonical `PageHeader` in three shapes (title only; title + subtitle + one action; long title + long subtitle + four actions) plus all four state components. Route created, measured, **deleted** (confirmed 404).

**Desktop, 1280px — identical to before:**

| Property | Value | Matches original |
| --- | --- | --- |
| `flex-direction` | `row` | yes |
| `justify-content` | `space-between` | yes |
| `margin-bottom` | `24px` (`mb-6`) | yes |
| Title size | `30px` (`text-3xl`) | yes |
| Title family | `DM Serif Display` | yes |
| Title weight | `400` | yes |

**Mobile, 320px:**

| Case | Direction | Title | Lines | Actions | Overflowing elements |
| --- | --- | --- | --- | --- | --- |
| Title only | column | 24px | 1 | — | **0** |
| Typical | column | 24px | 1 | wrap | **0** |
| Long title + 4 actions | column | 24px | 3 | wrap | **0** |

Page-level horizontal overflow: **0** at both widths.

Not verified here: the 99 real consumer pages, which are authenticated. The component is what changed, and it was measured directly — but see §13.

## 13. Known limitations

1. **No authenticated page was rendered.** Same constraint as Phases 1–5: signing in needs a password. The component was measured in isolation in the configurations its consumers use, which is a proxy, not the real thing. A human pass over a handful of real pages — Dashboard, Messages, a list page, a form page, a page with four toolbar buttons — is still wanted, and Step 12's list is the right sample.
2. **Widths 375 / 390 / 414 / 430 / 768 / 834 / 1024 / 1440 were not individually measured** for this component; 320 and 1280 bracket the two behaviours (stacked vs row) and the breakpoint between them is a single `sm:` boundary already exercised across earlier phases.
3. **`StateView`'s empty delegation narrows the API slightly**: `title` and `message` must be strings to reach `EmptyState`, where `StateView` otherwise accepts `ReactNode`. A non-string falls back to `EmptyState`'s own default rather than throwing. Acceptable — no consumer passes nodes — but it is a real difference, recorded rather than hidden.
4. **`shared/page-header` still takes actions via `children`**, not an `actions` prop. Renaming would touch all 99 consumers for no user-visible gain, so it was left alone.
5. **Long-subtitle wrapping is unconstrained.** A 150-character subtitle wraps to several lines on mobile rather than clamping. No consumer currently does that; a `line-clamp` could be added if one appears.

---

## Definition of Done

| Item | Status |
| --- | --- |
| PageHeader duplication audited | Yes |
| One canonical PageHeader | `shared/page-header.tsx`; duplicate deleted |
| Existing consumers preserved | 99, none edited |
| Responsive behaviour preserved | Added to canonical; verified |
| StateView/EmptyState duplication audited | Yes |
| Canonical state architecture | Both retained; overlap delegated — documented |
| Existing state consumers preserved | 8 `EmptyState` consumers untouched |
| Duplicate exports resolved | Barrel no longer exports a second `PageHeader` |
| Dead code removed | Only what type-check, lint and tests confirmed unused |
| No API / DB / auth / RBAC / business-module changes | Confirmed |
| Project CRM not implemented | Correct |
| Desktop regression checked | Measured identical at 1280px |
| Mobile regression checked | Measured at 320px, 0 overflow |
| Accessibility checked | h1 semantics, `role=status`/`alert`, labelled actions |
| Type-check / lint / tests | Clean / 0 errors / 2,392 passing |
| Documentation | This file |
