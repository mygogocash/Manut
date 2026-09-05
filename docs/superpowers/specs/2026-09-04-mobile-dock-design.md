# Mobile dock — design

**Status:** approved in chat, not yet implemented
**Date:** 2026-09-04
**Scope:** `apps/web` navigation only. No API, no schema.

## Problem

On a phone the app has no persistent navigation. The desktop sidebar is
rendered inside a Sheet and reached only through the topbar hamburger
(`sidebar.tsx:829`), so every move between modules costs: open drawer → scan a
67-item list → tap. #1188 delivered responsive layouts and the PWA shell but no
tab bar, and the app installed to a home screen therefore does not behave like
an app.

## Constraint that shapes everything

The nav has **76 groups and 67 top-level hrefs**. A dock holds four. The design
problem is not the component; it is what happens to the other 63.

A second constraint: nav is permission-filtered and already guarded by
`nav-rbac-parity.test.tsx`. Any fixed slot list will, for some role, name a
route that role cannot open.

## Decision

Three meaningful slots plus **More**, which opens the existing Sheet. Every one
of the 67 routes stays reachable through the navigation that already exists; no
second taxonomy is invented.

| # | Slot | Destination |
|---|---|---|
| 1 | Home | `/my-portal` for employee-only, else `/dashboard` |
| 2 | Inbox | notification read-model, with unread count |
| 3 | Work | first permitted top-level nav item for this user |
| 4 | More | opens the existing sidebar Sheet |

### Why Home is derived, not a constant

`auth-provider.tsx:266` already routes employee-only users to `/my-portal` and
everyone else to `/dashboard`. Hardcoding `/dashboard` sends the ~50 users on
the production Employee role to a page their role cannot open. The dock reuses
that existing rule rather than restating it.

### Why slot 3 is derived, not configured

"First permitted top-level item, in existing nav order" means a CRM lead lands
on their board and an HR user on HRMS, with no per-role configuration table and
no dock change when a module is added. Configuration for a four-item bar is not
worth its own admin surface.

**Items declaring no permissions are skipped, not accepted.** Discovered during
implementation: `/survey` declares none, so it is open to every signed-in user
and matched first — an investor lead got a Survey slot. Nav order is a layout
order, not a relevance order. A permission-less item says nothing about *this*
user and so cannot personalise a slot. It also made the "no second destination"
case unreachable, because such an item matches an actor holding nothing. Only
2 of 53 top-level items are affected (`/my-portal`, `/settings`), and both stay
reachable from More and the account menu.

Two edge cases this must pin down, or the slot is ambiguous:

- **It must exclude whatever Home resolved to.** Otherwise the first permitted
  item for most roles IS the dashboard, and slots 1 and 3 render the same
  destination twice.
- **It may resolve to nothing.** An employee-only user whose sole permitted
  items are their self-service pages may have no second destination. In that
  case slot 3 is omitted and the dock renders three items — Home, Inbox, More.
  It does not render a disabled slot or a placeholder.

### Why More rather than a fifth destination

With 67 routes, any fifth choice strands 62. Reusing the Sheet keeps one nav
component, one set of RBAC filtering, and one place to change.

## Behaviour

**Breakpoint.** Renders below `md` via the existing `useIsMobile`; hidden from
`md` up where the sidebar is permanent. Shown in **mobile browser as well as the
installed PWA** — the value is navigation, not installation, and gating on
`display-mode: standalone` would make the app behave differently depending on
how it was opened.

**Hamburger retained.** More opens the same Sheet as the topbar trigger. Two
entry points, one component, one piece of open/closed state — a second drawer
implementation would drift.

**Active state.** Longest-prefix match, reusing the rule in `bestMatchHref` /
`activeItSurfaceId`. A first-match scan lights the wrong slot on nested routes:
`/it-crm` is a prefix of `/it-crm/dashboard`.

**Safe area.** `pb-safe` (`globals.css:346`) already wraps
`env(safe-area-inset-bottom)`. The dock uses it, and `<main>` in
`(dashboard)/layout.tsx:375` gains bottom padding equal to dock height so
content is never trapped underneath.

**Badge parity.** Slot 2 reads the same `DashboardStats` the bell uses and the
same seen-set key `nexora:notifications:seen-ids-v2`. If the dock kept its own
key, the bell and the dock would disagree about what is unread — the exact
class of bug the `-v2` key was introduced to fix.

**Fail open.** If the permitted-item list is empty or its fetch fails, the dock
degrades to Home + More. It never renders empty and never hides itself, matching
the fail-open rule already used for Sales CRM nav children.

## Not building

- **Global search.** No global search exists — `command.tsx` is an unused
  primitive. A Search slot is a project, not a slot.
- **User-customisable slots.** Configuration for four items.
- **A separate mobile route tree.** Same routes, same guards.
- **Gating on standalone mode.** Decided against above.

## Files

New:
- `apps/web/src/components/layout/mobile-dock.tsx`
- `apps/web/src/components/layout/__tests__/mobile-dock.test.tsx`

Touched:
- `apps/web/src/app/(dashboard)/layout.tsx` — render the dock inside
  `SidebarInset` after `<main>`; add bottom padding to `<main>`
- `apps/web/src/components/layout/sidebar.tsx` — export the "first permitted
  top-level item" helper slot 3 needs (no such helper exists today)
- `apps/web/src/components/layout/notification-bell.tsx` — extract the seen-set
  key and unread derivation so the dock and bell share one source

## Testing

1. **RBAC parity.** Extend `nav-rbac-parity.test.tsx`: no dock slot may name a
   route whose gate the holder fails. Same invariant that caught the IT surfaces
   defect, where a tab promised a page the layout guard refused.
2. **Persona routing.** Employee-only actor resolves Home to `/my-portal`;
   a non-employee actor to `/dashboard`.
3. **Fail open.** Empty permitted list yields Home + More, not an empty bar.
4. **Active state.** `/it-crm/dashboard` lights the correct slot, not the
   `/it-crm` prefix.
5. **Badge parity.** Dock and bell derive the same unread count from one
   seen-set.
6. **Responsive.** Source-reading test in the style of
   `investor-pipeline-responsive.test.ts`: dock is `md:hidden`, uses `pb-safe`,
   and `<main>` carries matching bottom padding.

## Open question for implementation

Dock height and whether it hides on scroll. Hiding buys vertical space on long
boards but costs predictability, and the kanban surfaces already scroll
horizontally inside a fixed shell. Default: **always visible**, revisit only if
it measurably hurts a specific page.
