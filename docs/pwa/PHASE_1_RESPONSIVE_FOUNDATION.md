# Phase 1 — Responsive Foundation

The reusable responsive architecture every later phase builds on. No module has been converted; this is the scaffolding plus the shell changes that make conversion possible.

Reference: [MOBILE_PWA_AUDIT.md](MOBILE_PWA_AUDIT.md) · Completed 2026-08-24 · Branch `fix/proposal-chain-payload-and-fixed-stages`

---

## ⚠ Two deviations from the brief, and why

**1. The mobile JSX prototype is still not supplied.** It is not in the repository and was not attached (verified again this phase: zero `.jsx` files outside `node_modules`). The brief names it as the visual/interaction reference for Steps 5, 7, 8 and 14. Rather than invent a design and attribute it to the prototype, every visual decision here was derived from **the existing design language** — the same tokens, spacing scale, radii and type ramp the desktop app already uses. The primitives are deliberately unopinionated so that a prototype can be applied to them later without rework.

**2. Typography: the brief says the prototype uses "Playfair Display and Outfit". The app uses DM Sans / DM Serif Display / DM Mono** (`src/app/layout.tsx`). Step 12 also says "reuse existing font implementation where possible" and "preserve the existing design language" — those two instructions conflict. **Existing fonts were kept.** Swapping the type stack is a brand change affecting every page at every width, not a responsive change, and it would contradict `CLAUDE.md`'s instruction to match the live design system. If the font change is genuinely wanted, it should be its own change with the brand owner's sign-off.

---

## 1. Responsive architecture

One source for the breakpoints, in `src/hooks/use-breakpoint.ts`, exporting `BREAKPOINTS`, `useMediaQuery`, `useIsBelow`, `useIsAtLeast` and `useBreakpoint`.

The governing rule: **style in CSS, branch in JS only when the DOM itself must differ.** Tailwind prefixes handle the great majority of cases; the hooks exist for the few places where mobile needs *different elements* rather than different styling — a card list instead of a table, a sheet instead of a dialog.

The values equal Tailwind's defaults on purpose. A component branching in JS and a sibling branching in CSS must agree, or the layout tears at exactly one width. A unit test asserts the values so they cannot drift.

## 2. Breakpoints

| Class | Range | Hook | Notes |
| --- | --- | --- | --- |
| Mobile | `< 640px` | `isMobile` | The brief's definition |
| Tablet | `640–1023px` | `isTablet` | |
| Desktop | `>= 1024px` | `isDesktop` | |
| **Compact** | `< 768px` | `isCompact` / `useIsMobile()` | The line the **shell** switches on |

**Why two lines, not one.** `useIsMobile()` has meant `< 768px` since before this phase, and the sidebar's drawer behaviour is built on it. The brief allows preserving existing conventions where the audit identifies them, so 768px was kept for the shell, the tables and the dialogs, and the 640/1024 classes were added for new components. Consequences, deliberately chosen:

- A 768px tablet portrait keeps the **table**, not cards — correct, it has the width for one.
- The sidebar becomes a drawer below 768px, unchanged from before.
- Tablets (768–1279px) now *start* with the sidebar collapsed to its icon rail — see §5.

Reconciling to a single line is possible later but should follow real device testing, not a preference.

## 3. Modified components

| File | Change | Desktop impact |
| --- | --- | --- |
| `src/app/layout.tsx` | Added the `viewport` export (`width=device-width`, `initial-scale=1`, `viewport-fit=cover`) | **None** — desktop already rendered at device width |
| `src/app/globals.css` | +99 lines: safe-area utilities, `break-anywhere`, `allow-x-scroll`, `touch-target`, tap-highlight suppression, `-webkit-text-size-adjust`, `overflow-x: clip` on the scroll root | None at desktop widths |
| `src/app/(dashboard)/layout.tsx` | Padding `px-6 py-5` → `px-4 py-4 sm:px-6 sm:py-5`; `SidebarProvider defaultOpen` now width-aware | Identical `>= 1280px` |
| `src/components/layout/topbar.tsx` | Responsive header; title resolved from `NAV_GROUPS`; company switcher + theme toggle hidden `< 768px`; 36px touch targets on mobile | Same controls, same order, same sizes `>= 768px` |
| `src/components/layout/sidebar.tsx` | Mobile drawer now closes on navigation | None — the effect no-ops when not mobile |
| `src/components/shared/data-table.tsx` | Optional mobile card rendering; `mobileRole` / `mobileLabel` on `Column`; `mobileMode` / `renderMobileCard` on props | **None** — every new prop is optional and the table branch is byte-identical |
| `src/hooks/use-mobile.ts` | Delegates to `use-breakpoint`; same 768px threshold, same API | None |
| `playwright.config.ts` | Added `mobile-chrome`, `mobile-safari`, `tablet-safari` projects | None |

## 4. New reusable components

All under `src/components/shared/responsive/`, exported from its `index.ts`.

| Component | Purpose |
| --- | --- |
| `PageContainer` | Standard measure, rhythm and padding for a page |
| `PageHeader` | Title / description / actions row that stacks on mobile |
| `ResponsiveGrid` | Grids as **content-typed** presets (`kpi`, `kpi6`, `cards`, `panels`, `charts`, `split`, `fields`) |
| `ResponsiveGridMain` | The wide cell of a `split` grid |
| `ResponsiveTabs` | Horizontally scrollable tab strip that keeps the active tab in view |
| `ResponsiveActions` | Primary/secondary/overflow demotion; `splitActions` is the pure, tested rule |
| `ActionStrip` | Scrollable strip for filter chips |
| `RecordCard` | The mobile representation of a row, with in-place expansion |
| `ResponsiveDialog` | Dialog on desktop, bottom sheet on mobile (opt-in) |
| `StateView` | Loading / empty / error / permission-denied / success |
| `FormRow`, `FormSection`, `FormBody`, `StickyActionBar` | Form layout scaffolding |
| `useBreakpoint` and friends | `src/hooks/use-breakpoint.ts` |

## 5. Navigation changes

**Kept:** `NAV_GROUPS` remains the single source for both navigation *and* route permissions (the dashboard layout derives `ROUTE_PERMISSIONS` from it). Nothing was forked for mobile, so permissions cannot desynchronise from navigation. Permission filtering, nested children, badges and active-route highlighting are untouched — RBAC behaviour is **unchanged**.

**Fixed:** the mobile drawer did not close after navigating. Items are plain `<Link>`s, so a tap navigated *behind* the open sheet and the user had to dismiss it by hand. Now keyed on `pathname`, so it covers every entry point including the logo and nested children, and no-ops on desktop.

**Added:** the header title now resolves through `NAV_GROUPS` by longest-prefix match, with the explicit `PAGE_TITLES` map still winning. `PAGE_TITLES` covered 23 paths against 53 route segments, so most pages showed a bare "Intranet" — tolerable beside a visible sidebar, useless on a phone where the header is the only orientation.

**Already present, verified not rebuilt:** drawer overlay, body-scroll lock, focus trap and `Escape` (Radix `Sheet`); expandable sections (`Collapsible`); 18rem drawer width; `collapsible="icon"` rail.

**Not done:** bottom navigation and a command palette. Both were proposed in the audit as navigation improvements; neither is foundational, and both want the prototype's hierarchy. Deferred to Phase 2.

## 6. Responsive layout rules

1. Style in CSS; branch in JS only when the DOM must differ.
2. Every flex/grid child that should truncate needs `min-w-0` — its absence is the most common cause of overflow.
3. Long strings (URLs, emails, IDs) get `break-anywhere`.
4. Horizontal scrolling is opt-in via `allow-x-scroll`, never a side effect.
5. Touch targets are at least 36px on mobile, 44px for anything destructive or isolated.
6. Content type decides column counts — a KPI tile survives half a phone, a chart does not.
7. Safe-area insets on anything pinned to a screen edge.
8. Desktop rendering is preserved unless a shared architecture genuinely requires the change.

## 7. Table strategy

Extended the **one** existing `DataTable` (~75 call sites) rather than adding a parallel mobile table.

| Width | Rendering |
| --- | --- |
| `>= 768px` | Existing table, unchanged |
| `< 768px` | One `RecordCard` per row |

Card composition comes from `Column.mobileRole` (`title`, `subtitle`, `badge`, `field`, `detail`, `hidden`). When a caller declares nothing — which is all ~75 today — `deriveMobileRoles()` uses the first column as the title, the next two as visible fields, and everything after that as detail behind a "Show more". **No column is ever dropped**, which a unit test asserts.

Escape hatches: `mobileMode="table"` for genuinely matrix-shaped data where a card per row destroys the comparison; `mobileMode="cards"` to force cards at all widths; `renderMobileCard` for full control.

The title bar, selection bar and pagination are shared by both branches, so the two representations cannot drift in behaviour.

## 8. Form strategy

Layout only. `react-hook-form` + `zodResolver` + `ui/form.tsx` are untouched across all 102 call sites.

- `FormRow` stacks on mobile, pairs from `sm`.
- `StickyActionBar` pins actions on mobile, static from `sm`; `pb-safe-offset-4` keeps the primary button clear of the iOS home indicator; children are full-width on mobile with the primary action under the thumb while tab order still reaches Cancel first.
- `ResponsiveDialog` is **opt-in** per the brief's "do not automatically convert every modal" — a short confirmation is better as a centred dialog than a full-width sheet.

**Not yet applied**: inputs still need a ≥16px font size to stop iOS zooming on focus, and `inputMode`/`autocomplete` audits. Both belong with the Travel reference implementation, where they can be verified against real fields.

## 9. Accessibility changes

- `StateView` uses `role="status"` + `aria-busy` while loading and `role="alert"` for errors.
- `RecordCard`'s expander sets `aria-expanded` / `aria-controls`; the card is a `<button>` only when it has a click handler, so an expand control and a card-wide target never overlap.
- `ResponsiveActions`' overflow trigger has an `aria-label`; icon-only controls are never unlabelled.
- Visible `focus-visible` rings on every new interactive element.
- Semantic elements throughout: `<dl>/<dt>/<dd>` for card fields, `<h1>` in `PageHeader`, `<section>` in `FormSection`.
- Pinch-zoom deliberately **not** disabled (WCAG 1.4.4).
- Touch targets raised on the header's menu trigger and avatar (28px → 36px on mobile).
- Drawer focus trap, `Escape` and body-scroll lock come from Radix and were verified as already present, not re-implemented.

## 10. Testing performed

| Check | Result |
| --- | --- |
| `pnpm type-check` | **10/10 workspaces clean** |
| `pnpm lint` | **0 errors** (5 were introduced and fixed — import sorting and `curly`) |
| `pnpm test` (full suite, forced) | **2,283 passing** (1,911 API + 372 web), up from 2,263 |
| New unit tests | 20 — 14 for role derivation and action demotion, 6 for the table's width branching |
| Existing `data-table.test.tsx` | 14/14 still pass; the global test setup reports `matches: false`, so those are now a desktop-unchanged regression guard |
| Viewport meta, served HTML | `width=device-width, initial-scale=1, viewport-fit=cover` confirmed on the running dev server |
| Horizontal overflow, real browser | `/sign-in` at **320px, 768px, 1280px** → `scrollWidth - clientWidth = 0` at each |
| New CSS utilities compile | `break-anywhere`, `allow-x-scroll`, `pb-safe-offset-4` and the scroll-root `clip` rule all confirmed present in the served stylesheet (Tailwind v4 purge check) |

Added `e2e/responsive-overflow.spec.ts` — the nine brief-specified widths against public routes, plus a viewport-meta assertion that fails if the tag regresses or ever disables pinch-zoom.

## 11. Known limitations

1. **Playwright browsers are not installed on this machine**, so the new E2E spec has not been executed. `npx playwright install` (~130 MB) was not run unprompted. The spec is committed and will run in CI or after a local install.
2. **Authenticated pages were not visually verified at the nine widths.** Signing in requires entering a password, which I do not do. Verified: public routes, the served viewport meta, the compiled CSS, and the shell components through unit tests. **The dashboard, tables, drawer and header still need a human pass on a real device while signed in** — see the checklist below.
3. **No module has been converted.** By design, but it means the new primitives have no production consumer yet; the first real exercise is the Project CRM in a later phase.
4. **iOS 16px input-zoom and `inputMode` audits are not done** (§8).
5. **Bottom navigation and command palette deferred** (§5).
6. **The tablet sidebar default is a judgement call**, not a measured one: below 1280px a 16rem sidebar plus content leaves the content column narrow. It is reversible in one line if it feels wrong on a real iPad.
7. `useIsMobile` returns `false` on the first client render, so a mobile card list resolves a frame after mount. Invisible in practice because `DataTable` has no data at first paint, but it is a genuine flash risk for any future component that renders differently with immediately-available data.
8. **Prototype-dependent decisions remain open** — mobile information hierarchy, KPI card visuals, action priorities per module.

### What a human still needs to check

Signed in, at 320 / 375 / 768 / 1024 / 1440: dashboard, a CRM list (table → cards), the drawer (open, navigate, confirm it closes), the header title on a deep route, a form dialog, and one long-text record for overflow.

## 12. Files changed

**Modified (9)**
```
apps/web/src/app/layout.tsx                       viewport export
apps/web/src/app/globals.css                      +99 lines of utilities
apps/web/src/app/(dashboard)/layout.tsx           responsive padding, tablet sidebar
apps/web/src/components/layout/topbar.tsx         responsive header
apps/web/src/components/layout/sidebar.tsx        close drawer on navigate
apps/web/src/components/shared/data-table.tsx     mobile card rendering
apps/web/src/hooks/use-mobile.ts                  delegates to use-breakpoint
playwright.config.ts                              mobile + WebKit projects
apps/web/next-env.d.ts                            generated by Next, not authored
```

**Added (14)**
```
apps/web/src/hooks/use-breakpoint.ts
apps/web/src/components/shared/responsive/index.ts
apps/web/src/components/shared/responsive/page-container.tsx
apps/web/src/components/shared/responsive/responsive-grid.tsx
apps/web/src/components/shared/responsive/responsive-tabs.tsx
apps/web/src/components/shared/responsive/responsive-actions.tsx
apps/web/src/components/shared/responsive/record-card.tsx
apps/web/src/components/shared/responsive/responsive-dialog.tsx
apps/web/src/components/shared/responsive/state-view.tsx
apps/web/src/components/shared/responsive/form-layout.tsx
apps/web/src/components/shared/responsive/__tests__/responsive-foundation.test.ts
apps/web/src/components/shared/__tests__/data-table-responsive.test.tsx
e2e/responsive-overflow.spec.ts
docs/pwa/PHASE_1_RESPONSIVE_FOUNDATION.md
```

No API, schema, migration, permission or business-logic change. No route added, removed or renamed. Nothing committed — the working tree carries the change for review.
