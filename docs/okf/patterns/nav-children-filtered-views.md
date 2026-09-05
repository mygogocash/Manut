---
type: Playbook
title: Nav children that are filtered views of one board
description: Build sidebar children from a config list when they differ only by a query param, matching on pathname plus params so siblings do not all light up at once.
tags: [frontend, config]
status: stable
verified:
  - at: 2026-08-24
    by: kunanon-ui
stale_after: 2027-02-24
---

# Nav children that are filtered views of one board

Sales CRM → one child per business unit. Use this when a sidebar group's
children differ only by a query param, not a route.

## Steps

1. Give `NavChild` a `matchParams` map and match on pathname + params
   (`childIsActive` / `childPathname` in `sidebar.tsx`). `bestMatchHref`
   stays pathname-only, so without the param check every sibling on the
   shared pathname lights up at once.
2. Build the children **at render time from the config list**
   (`useBusinessUnits()`), so adding a unit adds a nav view with no code
   change.
3. **Fail open**: an empty list or failed fetch leaves the parent a plain
   link rather than hiding the page.
4. The board reads its filter through `useSearchParams()` — a mount-only
   read never updates, because moving between sibling views does not
   remount — and writes it back with `history.replaceState`, which needs a
   `<Suspense>` boundary around the tab subtree.

## Caveat

`ROUTE_PERMISSIONS` in `(dashboard)/layout.tsx` is derived from **top-level**
items only, so query-carrying child hrefs never reach it. A child that is a
real route rather than a filtered view (a different pathname) therefore loses
its gate when it stops being a top-level entry, and must be pinned in
`ROUTE_PATTERN_OVERRIDES` — `ProtectedRoute` skips its check entirely when
`requiredPermissions` is undefined.

## Reference

`apps/web/src/components/layout/sidebar.tsx`,
`apps/web/src/app/(dashboard)/layout.tsx`.
