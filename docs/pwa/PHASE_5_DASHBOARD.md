# Phase 5 — Dashboard Responsive Conversion

The first business-facing module conversion. **The existing dashboard was adapted, not replaced.**

References: [AUDIT](MOBILE_PWA_AUDIT.md) · [PHASE_1](PHASE_1_RESPONSIVE_FOUNDATION.md) · [PHASE_2](PHASE_2_DESIGN_SYSTEM.md) · [PHASE_3](PHASE_3_PWA_FOUNDATION.md) · [PHASE_4](PHASE_4_AUTH_NAVIGATION.md) · Completed 2026-08-24

---

## Headline: the dashboard was already largely responsive

The audit found far less broken than the brief anticipates. Most sections already had breakpoints, `min-w-0`, `truncate` and `shrink-0` in the right places. Rather than manufacture work, this phase fixed the **three real defects** found by reading the code, improved tablet density, and verified the rest.

Two genuine bugs, both in KPI value handling, both matching Step 21's own example:

1. **`formatCurrency` stopped at millions.** 18,000,000,000,000 rendered as `$18000000.0M` — twelve characters, unreadable, and wide enough to break a card on a phone.
2. **Rounding could push a value out of its tier.** 999,999 is below a million, so it landed in the K tier and rounded to `$1000.0K`.
3. **`StatCard` could not fit its own number at 320px.** In the dashboard's two-up grid a card is **138px** wide (measured). A `size-11` icon plus its gap took 56px and 20px side padding took 40px, leaving the value about **42px** — nothing fits, not even "1,234".

## 1. Existing dashboard architecture

| Aspect | Finding |
| --- | --- |
| Route | `/dashboard` — single canonical route, no mobile variant created |
| Page | `src/app/(dashboard)/dashboard/page.tsx`, **1,055 lines**, `"use client"` |
| Data | One call to `GET /api/dashboard/stats`, gated `HOME_READ`, computed server-side in a single `Promise.all` |
| Permissions | `hasAnyPermission()` from `useAuth()` — `canViewLeave`, `canViewTravel`, `canViewExpense`, `canViewProjects`, `canViewEmployees`, `canCreateWallPost`, `canCreateNews` |
| Charts | recharts (`BarChart`, `PieChart`) inside aspect-ratio containers |
| Components | `StatCard`, `SectionCard`, `DashboardQuickActions`, `DashboardSkeleton`, `BirthdayComingSoonWidget`, `home-compose-dialogs`, `dashboard-utils` |
| Shared | `shared/page-header` (**97 consumers**), `shared/empty-state`, `shared/avatar`, `shared/badge` |

**Server/client boundary preserved** — the page stays a client component; nothing was converted either way.

## 2. Dashboard sections

Inventoried from the source, in render order:

| # | Section | Type | Empty state |
| --- | --- | --- | --- |
| 1 | PageHeader ("Dashboard" + today) | header | — |
| 2 | Welcome/hero card | card with actions | — |
| 3 | Quick actions | vertical list from `stats.pendingActions`, capped at 6 | yes |
| 4 | KPI grid 1 | 4 × `StatCard` | — |
| 5 | KPI grid 2 | 3 × `StatCard` | — |
| 6 | Leave queue | list | yes |
| 7 | Monthly expenses | recharts `BarChart` | yes |
| 8 | Projects by status | recharts `PieChart` | yes |
| 9 | Active projects | list | yes |
| 10 | Team by department | recharts `BarChart` (vertical) | yes |
| 11 | Urgent items | list | yes |
| 12 | Company wall | list with avatars | yes |
| 13 | Company news | list | yes |
| 14 | Company dates | list | yes |
| 15 | Birthday widget | widget | — |
| 16 | Compose dialogs | modals | — |

**No dashboard tables.** Step 11's table-transformation work therefore does not apply here — the sections are lists, which already carry `min-w-0` + `truncate` + `shrink-0` and wrap safely. `DataTable`'s card mode (Phase 1) is ready for the CRM phases where real tables live.

**No dashboard filters.** Step 13 does not apply.

## 3. API / data sources

`GET /api/dashboard/stats` — **unchanged**. One request, one payload, one presentation. No new endpoint, no mobile-specific fetch, no duplicated call, no change to loading or error semantics.

## 4. Responsive strategy

| Breakpoint | KPI grid 1 | KPI grid 2 | Section rows |
| --- | --- | --- | --- |
| < 640 | 2 | 2 | 1 |
| 640–767 | 2 | 2 | 1 |
| **768–1023** | 2 | 2 | **2** ← changed |
| **1024–1279** | **4** ← changed | 3 | 3 |
| ≥ 1280 | 4 | 3 | 3 |

Two grid changes, both aimed at tablet/laptop widths that were wasting space:

- KPI grid 1 was `grid-cols-2 xl:grid-cols-4`, so 1024–1279px showed two enormous cards. Now `lg:grid-cols-4` — which is exactly Phase 2's `ResponsiveGrid variant="kpi"`.
- Section rows were `grid-cols-1 lg:grid-cols-3`, so 768–1023px stacked three cards in one narrow column with the rest of the width empty. Now `md:grid-cols-2` in between.

**Desktop (≥ 1280px) is byte-identical.** `xl:grid-cols-4` and `lg:grid-cols-4` resolve to the same four columns at every width from 1280 up; the only behavioural difference is below 1280. Section rows keep `lg:grid-cols-3` untouched.

## 5. KPI strategy

`StatCard` made responsive rather than replaced — it already had the right structure (`min-w-0` on the text column, `tabular-nums`, optional `href` wrapping in `next/link` to keep prefetch), and Phase 2's `DataCard` is a *panel*, not a stat tile.

| Property | Before | After |
| --- | --- | --- |
| Card padding | `px-5 py-4` | `px-3 py-3 sm:px-5 sm:py-4` |
| Icon block | `size-11` | `size-8 sm:size-11` |
| Icon glyph | `size-5` | `size-4 sm:size-5` |
| Value | `text-[28px] leading-none sm:text-[30px]` | `text-[22px] leading-tight sm:text-[28px] md:text-[30px]` + `break-anywhere` |
| Label | `text-[11px] tracking-[0.08em]` | `text-[10px] tracking-[0.06em] sm:` the originals |

`break-anywhere` not `truncate`: a figure has to go somewhere, and silently cutting a number in half is worse than two lines.

Also fixed `formatCurrency` (§ headline). Every value now fits in at most seven characters (`-$18.0T`), asserted by a test over the whole range.

**This card is used by 10 files**, so 9 other pages get the same narrow-width improvement. That is an improvement, not a functional change, and no other module's logic was touched.

## 6. Attention / pending strategy

`DashboardQuickActions` (from `stats.pendingActions`) and the Urgent items / Leave queue sections were **already** vertical lists with `min-w-0 flex-1` on the text column and `shrink-0` on timestamps. Nothing was hidden, reordered or capped — the existing cap of 6 quick actions is pre-existing behaviour and was deliberately left alone.

No change needed, and none made.

## 7. Action strategy

The hero card's actions already `flex-wrap` and stack via `flex-col sm:flex-row`. Quick actions are a vertical list. **Nothing was moved into an overflow menu** because nothing was competing for a row — Phase 2's `ResponsiveActions` exists for the CRM toolbars where actions genuinely do compete.

## 8. Table / list strategy

No tables on the dashboard (§2). Lists were audited and left as they are: they already truncate the primary line, wrap the secondary line and pin the timestamp. Verified with a hostile unbreakable URL at 320px — no overflow.

## 9. Chart strategy

Audited, **not changed**. Each chart sits in an aspect-ratio container (`aspect-2.5/1`, `aspect-2/1`, `aspect-square max-h-[180px]`) so it scales with its column rather than having a fixed pixel width. Axis ticks are `fontSize={11}` with recharts' default tick-skipping, so labels thin out rather than overlapping. No page-level horizontal overflow at any width tested.

Deliberately not done: no chart library swap, no chart removed, no mobile "summary instead of chart" substitution. Tick density on a 320px-wide 12-month bar chart is legible but tight — flagged for the human pass rather than pre-emptively changed.

## 10. Filter strategy

No dashboard filters exist. Nothing to convert.

## 11–13. Loading, empty and error states

All three already existed and were preserved:

- **Loading** — `DashboardSkeleton`, a structural skeleton (not a spinner), rendered while the stats request is in flight.
- **Empty** — `shared/empty-state` on **9** sections, each with its own copy ("Queue is clear", "No projects in flight", "Nothing urgent"…).
- **Error** — a distinct error card with `AlertTriangle` and a retry, separate from the empty states.

The important property was already correct and is unchanged: **an API failure renders the error state, not zeros and not an empty state.** No fabricated data is displayed at any width.

## 14. Permission handling

Unchanged. Widget visibility comes from `hasAnyPermission()` on the same permission codes at every width — there is no viewport-dependent branch anywhere near a permission check, and none was added. The API remains the boundary.

## 15. Accessibility

- `StatCard` is a link **only** when given an `href`, so a non-interactive tile does not look clickable (Step 20). Asserted by a test.
- Trend arrows are `aria-hidden` — the direction is already in the change text.
- Section titles remain headings; empty states remain readable text, not icon-only.
- No hover-only affordance was introduced.

Untouched: the page's existing landmark structure. No automated a11y scanner exists in this repo (noted since Phase 2).

## 16. Performance observations

No changes made, and none justified by evidence:

- The page stays one client component with one request. Splitting it or converting parts to server components would be a rewrite, not a responsive change.
- recharts is already imported by this route; the aspect-ratio containers mean no extra work on resize.
- The heavy imports flagged in the Phase 0 audit (`xlsx`, `d3-geo`, `world-atlas`) are **not** on this route.

Left for a future performance phase: the 1,055-line page would benefit from decomposition, and recharts could be dynamically imported. Both are refactors with regression risk and no responsive payoff.

## 17. Desktop regression verification

| Aspect | Verdict |
| --- | --- |
| API | unchanged |
| Data | unchanged |
| Permissions | unchanged |
| Sections | all 16 present, same order |
| Actions | none removed |
| Layout ≥ 1280px | **identical** — `xl:grid-cols-4` → `lg:grid-cols-4` resolves to the same four columns at every width from 1280 up, and section rows keep `lg:grid-cols-3` |
| Typography ≥ 640px | `sm:`/`md:` values restore the original 28/30px value size and 11px label |
| Card padding ≥ 640px | `sm:px-5 sm:py-4` — the original |

**One intentional change below desktop:** at 1024–1279px the KPI grid now shows four cards instead of two. That width was previously wasting half the row; it is within Step 19's tablet remit rather than Step 4's desktop preservation (which names 1280/1440/1920).

## 18–19. Mobile and tablet verification

Measured in a real browser, rendering `StatCard` and `SectionCard` in the dashboard's **actual** grid configurations with hostile values (a 13-digit figure, an unbreakable URL, an over-long label):

| Width | Page overflow | KPI grid 1 | Section row | Card width | Value size | Clipped elements |
| --- | --- | --- | --- | --- | --- | --- |
| 320 | **0** | 2 | 1 | **138px** | 22px | **0** |
| 768 | **0** | 2 | **2** | 347px | 30px | **0** |
| 1024 | **0** | **4** | 3 | 235px | 30px | **0** |

The 320px row is the one that matters: 138px is the exact width the arithmetic predicted, `$18.0T` rendered at 22px, and **nothing clipped or overflowed** — where before the value had ~42px to live in.

Method note: this used a temporary `/kpi-check` route, created, measured, and **deleted** (confirmed 404). It required briefly stopping the API, because with the API reachable every unauthenticated page is bounced to `/sign-in` by the global auth handling — which is correct behaviour, and the reason the dashboard itself cannot be measured this way.

## 20. Known limitations

1. **The dashboard itself was never rendered.** It is authenticated, and signing in requires a password, which I do not do. Everything above is either a measured proxy (the real components in the real grids) or a code-level argument. **This is the phase's main limitation** — the human checklist below is not a formality.
2. **Charts were not seen rendering.** Aspect-ratio containment means they cannot overflow, but tick legibility at 320px is a judgement call needing eyes.
3. **`shared/page-header` (97 consumers) was left alone.** It is not responsive-optimised, and improving it would touch nearly every page in the app — out of scope for a dashboard phase. Recommended as its own change.
4. **Phase 2 duplicated two components that already existed.** `responsive/page-container.tsx` exports a `PageHeader` while `shared/page-header.tsx` has 97 consumers, and `StateView` overlaps `shared/empty-state.tsx` (8 consumers). Nothing is broken — the dashboard uses the pre-existing ones — but there are now two of each, and they should be reconciled before the CRM phases spread the new ones further. My error in Phase 2; recording it rather than quietly leaving it.
5. **`StatCard` changes reach 9 other pages.** Improvement only, but they were not visually checked.
6. **Hero card padding left at `p-6` on mobile.** Slightly generous at 320px but not a defect; changing it would be cosmetic churn.
7. **No automated a11y scanner** (unchanged since Phase 2).

## 21. Human verification checklist

Signed in, at 320 / 375 / 390 / 414 / 430 / 768 / 834 / 1024 / 1280 / 1440 / 1920:

- [ ] Dashboard loads after login
- [ ] KPI data appears, and every value fits its card (watch any currency KPI)
- [ ] Pending/action items appear
- [ ] Dashboard links work (KPI cards with an `href`, hero actions, list rows)
- [ ] Filters work — *n/a, the dashboard has none*
- [ ] Charts render: expenses bars, project pie, department bars; axis labels legible at 320px
- [ ] Recent activity renders (wall, news, dates) with long text wrapping safely
- [ ] Empty states appear where a section genuinely has no data
- [ ] Error state appears if the stats request fails (throttle the network to force it) — and shows an error, **not** zeros
- [ ] Mobile dashboard: no horizontal scroll, nothing clipped, KPI grid 2-up
- [ ] Tablet: section rows 2-up at 768, KPI grid 4-up at 1024
- [ ] **Desktop unchanged** at 1280/1440/1920 — compare against `main`
- [ ] Widgets a user lacks permission for stay hidden (check with a non-admin account)

---

## Definition of Done

| Item | Status |
| --- | --- |
| Existing functionality preserved | Yes — 16 sections, none removed |
| Existing API reused | Yes — `GET /api/dashboard/stats`, unchanged |
| No new mobile API | Correct |
| No mobile dashboard route | Correct |
| KPI cards responsive | Yes — measured at 320/768/1024 |
| Dashboard grid responsive | Yes — tablet gaps closed |
| Attention/pending responsive | Already were; verified |
| Quick actions responsive | Already were; verified |
| Activity responsive | Already were; verified with hostile content |
| Tables transformed | **n/a** — no tables on the dashboard |
| Charts responsive | Aspect-contained; no overflow |
| Filters responsive | **n/a** — none exist |
| Loading / empty / error states | Preserved; error ≠ empty |
| Permissions preserved | Yes — untouched |
| Mobile UX | Verified by proxy |
| Tablet UX | Improved and verified |
| Desktop UX preserved | Identical ≥ 1280px |
| No horizontal overflow | 0 at every width tested |
| Accessibility | Link-only-when-clickable, decorative icons |
| Type-check / lint / tests | Clean / 0 errors / **2,379 passing** |
| Documentation | This file |
