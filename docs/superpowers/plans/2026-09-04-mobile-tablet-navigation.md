# Mobile Dock & Tablet Responsive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app app-like navigation on phones (a persistent dock) and verified, fixed layouts on tablets.

**Architecture:** A new `MobileDock` renders below `md` inside `SidebarInset`, with three derived slots (Home, Inbox, Work) plus More, which opens the sidebar Sheet that already exists. Nothing is duplicated: Home reuses the persona rule in `auth-provider`, Inbox reuses the bell's `DashboardStats` and seen-set, Work derives from the exported `NAV_GROUPS`. Tablet work is measurement-first — Phase A produces a defect list, Phase B fixes only confirmed defects.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/base-ui, vitest + @testing-library/react.

**Specs:**
- `docs/superpowers/specs/2026-09-04-mobile-dock-design.md`
- `docs/superpowers/specs/2026-09-04-tablet-responsive-plan.md`

## Global Constraints

- Breakpoints come from `BREAKPOINTS` in `apps/web/src/hooks/use-breakpoint.ts` (`sm:640 md:768 lg:1024 xl:1280 2xl:1536`). JS branches and Tailwind prefixes must use the same numbers.
- Tailwind class overrides must carry the **same variant** as the class they override. `cn()` is tailwind-merge and only dedupes within one group AND variant; a bare utility loses to a `sm:`/`md:` one and both survive silently.
- Nav is permission-filtered. Any surface that names a route must be gated by codes that are a **subset** of that route's gate in `(dashboard)/layout.tsx`, or it promises a page the guard refuses.
- Fail open: an empty or failed permission list degrades the UI, never hides it.
- Run `rm -rf apps/web/.next` before `pnpm type-check` when switching branches — stale generated route types fail against routes from other branches.
- `NODE_OPTIONS=--max-old-space-size=8192` is required for `pnpm type-check` on machines with 8 GB.
- Commit messages: conventional commits (`feat(scope):`, `fix(scope):`).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/components/layout/mobile-dock.tsx` (create) | The dock: slot resolution + rendering |
| `apps/web/src/components/layout/dock-slots.ts` (create) | Pure slot-derivation logic, no JSX — so it is testable without mounting |
| `apps/web/src/components/layout/__tests__/dock-slots.test.ts` (create) | Slot derivation, RBAC parity, persona routing, fail-open |
| `apps/web/src/components/layout/__tests__/mobile-dock-responsive.test.ts` (create) | Source-reading responsive assertions |
| `apps/web/src/components/layout/notification-bell.tsx` (modify) | Export `SEEN_IDS_KEY` and the unread count so the dock shares one source |
| `apps/web/src/app/(dashboard)/layout.tsx` (modify) | Render the dock; add bottom padding to `<main>` |

Slot logic is split from the component because it is the part with real branching (persona, RBAC, exclusion, empty case) and testing it should not require a DOM.

---

## Task 1: Slot derivation

**Files:**
- Create: `apps/web/src/components/layout/dock-slots.ts`
- Test: `apps/web/src/components/layout/__tests__/dock-slots.test.ts`

**Interfaces:**
- Consumes: `NAV_GROUPS`, `EMPLOYEE_NAV_GROUPS` from `@/components/layout/sidebar` (exported at `sidebar.tsx:741`); `NavItem = { id, label, href, icon, badge?, permissions?, children? }`
- Produces:
  - `export interface DockSlot { id: string; label: string; href: string; icon: LucideIcon }`
  - `export function homeHref(isEmployeeOnly: boolean): string`
  - `export function workSlot(hasAnyPermission: (...c: string[]) => boolean, isEmployeeOnly: boolean, homeTarget: string): DockSlot | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { homeHref, workSlot } from "@/components/layout/dock-slots";
import { NotificationBell } from "@/components/layout/notification-bell";

const allow = (...held: string[]) => {
  const owned = new Set(held);
  return (...codes: string[]) => codes.some((c) => owned.has(c));
};

describe("homeHref", () => {
  it("sends employee-only users to their portal", () => {
    // auth-provider.tsx:266 already does this; the dock must not restate it
    // as a constant, or the ~50 users on the production Employee role land on
    // a page their role cannot open.
    expect(homeHref(true)).toBe("/my-portal");
  });

  it("sends everyone else to the dashboard", () => {
    expect(homeHref(false)).toBe("/dashboard");
  });
});

describe("workSlot", () => {
  it("excludes whatever Home resolved to", () => {
    // Without this, the first permitted item IS the dashboard for most roles
    // and slots 1 and 3 render the same destination twice.
    const slot = workSlot(allow("investor-dashboard:read"), false, "/dashboard");
    expect(slot?.href).not.toBe("/dashboard");
  });

  it("returns the first permitted item in nav order", () => {
    // The nav entry declares `investor-dashboard:read`, not `investors:read`.
    const slot = workSlot(allow("investor-dashboard:read"), false, "/dashboard");
    expect(slot?.href).toBe("/investors");
  });

  it("returns null when the actor has no second destination", () => {
    // An employee-only user may have only self-service pages. The dock then
    // renders three items, not a disabled placeholder.
    expect(workSlot(allow(), true, "/my-portal")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/dock-slots.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/layout/dock-slots"`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { LucideIcon } from "lucide-react";

import { EMPLOYEE_NAV_GROUPS, NAV_GROUPS } from "@/components/layout/sidebar";

export interface DockSlot {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Mirrors auth-provider.tsx:266 rather than restating it as a constant. */
export function homeHref(isEmployeeOnly: boolean): string {
  return isEmployeeOnly ? "/my-portal" : "/dashboard";
}

export function workSlot(
  hasAnyPermission: (...codes: string[]) => boolean,
  isEmployeeOnly: boolean,
  homeTarget: string,
): DockSlot | null {
  const groups = isEmployeeOnly ? EMPLOYEE_NAV_GROUPS : NAV_GROUPS;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.href === homeTarget) continue;
      // Skipped, not accepted: an item open to everyone says nothing about
      // THIS user. Accepting them resolved to /survey for an investor lead and
      // made the null case unreachable.
      const codes = item.permissions ?? [];
      if (codes.length === 0) continue;
      if (!hasAnyPermission(...codes)) continue;
      return {
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
      };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/dock-slots.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/dock-slots.ts apps/web/src/components/layout/__tests__/dock-slots.test.ts
git commit -m "feat(nav): derive mobile dock slots from persona and permissions"
```

**Acceptance criteria**
- `homeHref(true) === "/my-portal"`, `homeHref(false) === "/dashboard"`.
- `workSlot` never returns the Home target.
- `workSlot` returns `null` rather than a placeholder when no second destination exists.
- No hardcoded route list: adding a module to `NAV_GROUPS` changes the dock with no edit here.

---

## Task 2: RBAC parity guard

**Files:**
- Modify: `apps/web/src/components/layout/__tests__/dock-slots.test.ts`

**Interfaces:**
- Consumes: `getRequiredPermissions` from `@/app/(dashboard)/layout`; `workSlot`, `homeHref` from Task 1.

- [ ] **Step 1: Write the failing test**

```ts
import { getRequiredPermissions } from "@/app/(dashboard)/layout";

describe("dock slots never promise a page the guard refuses", () => {
  // The invariant that caught the IT surfaces defect: a tab rendered, invited
  // a click, then 404'd at the layout guard. Asserted against the REAL
  // resolver so pattern overrides and prefix precedence count.
  it.each([
    ["investor reader", ["investors:read"], false],
    ["employee only", [], true],
  ])("%s", (_name, held, employeeOnly) => {
    const owned = new Set(held as string[]);
    const has = (...codes: string[]) => codes.some((c) => owned.has(c));
    const home = homeHref(employeeOnly as boolean);
    const slot = workSlot(has, employeeOnly as boolean, home);

    for (const href of [home, slot?.href].filter(Boolean) as string[]) {
      const gate = getRequiredPermissions(href);
      if (!gate) continue; // undefined = no check performed on that route
      expect(
        gate.some((code) => owned.has(code)) || held.length === 0,
        `${href} is gated by ${gate.join(", ")} which this actor lacks`,
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes for the right reason**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/dock-slots.test.ts`
Expected: PASS if Task 1 is correct. If it FAILS, `workSlot` is selecting an item whose nav permissions are not a subset of its route gate — fix `dock-slots.ts`, not the test.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/__tests__/dock-slots.test.ts
git commit -m "test(nav): assert dock slots satisfy their route gates"
```

**Acceptance criteria**
- Every slot href resolves to a gate the actor satisfies, or to `undefined`.
- The test uses `getRequiredPermissions`, not a local reimplementation of precedence.

---

## Task 3: Give the notification bell a dock presentation

**Files:**
- Modify: `apps/web/src/components/layout/notification-bell.tsx`

**Why this shape.** There is **no `/notifications` route** — the bell is a
Popover (`notification-bell.tsx:366`) that owns its trigger, its badge, its
`DashboardStats` fetch and its seen-set. The dock therefore cannot *link* to an
inbox; it must render the bell itself. Reusing the component makes badge parity
structural rather than a convention two call sites have to keep — strictly
better than exporting the storage key and deriving the count twice.

**Interfaces:**
- Produces: `NotificationBell` accepts `variant?: "topbar" | "dock"` (default `"topbar"`, so the existing call site is unchanged).

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../../..");

describe("one notification source", () => {
  it("keeps a single seen-set key in the codebase", () => {
    // Two keys means the bell and the dock disagree about what is unread —
    // the bug the -v2 suffix was introduced to fix.
    const bell = readFileSync(resolve(SRC, "components/layout/notification-bell.tsx"), "utf8");
    expect(bell.match(/nexora:notifications:seen-ids-v2/g)?.length).toBe(1);
  });

  it("offers a dock presentation", () => {
    const bell = readFileSync(resolve(SRC, "components/layout/notification-bell.tsx"), "utf8");
    expect(bell).toMatch(/variant\?:\s*"topbar"\s*\|\s*"dock"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/dock-slots.test.ts`
Expected: FAIL on the second case — no `variant` prop exists

- [ ] **Step 3: Write minimal implementation**

Add the prop and branch only the trigger's presentation, leaving the popover,
badge logic, fetch and seen-set untouched:

```tsx
export function NotificationBell({
  variant = "topbar",
}: {
  variant?: "topbar" | "dock";
} = {}) {
```

and in the trigger:

```tsx
<PopoverTrigger
  className={
    variant === "dock"
      ? "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
      : undefined
  }
>
```

with the label rendered only in dock mode:

```tsx
{variant === "dock" ? <span>Inbox</span> : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/dock-slots.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/notification-bell.tsx apps/web/src/components/layout/__tests__/dock-slots.test.ts
git commit -m "feat(nav): give the notification bell a dock presentation"
```

**Acceptance criteria**
- Exactly one occurrence of `nexora:notifications:seen-ids-v2` in `apps/web/src`.
- The topbar call site renders unchanged with no prop passed.
- The unread badge is computed in one place; the dock cannot disagree with the topbar because it is the same component.

---

## Task 4: The dock component

**Files:**
- Create: `apps/web/src/components/layout/mobile-dock.tsx`

**Interfaces:**
- Consumes: `DockSlot`, `homeHref`, `workSlot` (Task 1); `NotificationBell` with `variant="dock"` (Task 3); `useAuth()` → `{ hasAnyPermission, isEmployeeOnly }`; `useSidebar()` → `{ setOpenMobile }`.
- Produces: `export function MobileDock(): JSX.Element | null`

- [ ] **Step 1: Write the implementation**

```tsx
"use client";

import { Home, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { homeHref, workSlot } from "@/components/layout/dock-slots";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

/**
 * Longest-prefix match, mirroring bestMatchHref in sidebar.tsx. A first-match
 * scan lights the wrong slot on nested routes, because `/it-crm` is a prefix
 * of `/it-crm/dashboard`.
 */
function isActive(pathname: string, href: string, all: string[]): boolean {
  const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  if (!matches(href)) return false;
  return !all.some((other) => other !== href && matches(other) && other.length > href.length);
}

export function MobileDock() {
  const pathname = usePathname() ?? "";
  const { hasAnyPermission, isEmployeeOnly } = useAuth();
  const { setOpenMobile } = useSidebar();

  const home = homeHref(isEmployeeOnly);
  const work = workSlot(hasAnyPermission, isEmployeeOnly, home);

  // Inbox is NOT in this list: there is no /notifications route, so slot 2
  // renders the bell component itself (below) rather than a link. `work` keeps
  // its own nav icon — overriding it would make the slot unrecognisable
  // against the sidebar entry it points at.
  const links = [
    { id: "home", label: "Home", href: home, icon: Home },
    ...(work ? [work] : []),
  ];
  const hrefs = links.map((l) => l.href);

  return (
    <nav
      aria-label="Primary"
      className={`
        bg-background border-border pb-safe fixed inset-x-0 bottom-0 z-40 flex
        border-t
        md:hidden
      `}
    >
      {links.map(({ id, label, href, icon: Icon }) => {
        const active = isActive(pathname, href, hrefs);
        return (
          <Link
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
      <NotificationBell variant="dock" />
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className={`
          text-muted-foreground flex flex-1 flex-col items-center gap-0.5 py-2
          text-[11px]
        `}
      >
        <Menu className="size-5" />
        More
      </button>
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `rm -rf apps/web/.next && NODE_OPTIONS=--max-old-space-size=8192 pnpm type-check`
Expected: 11/11 tasks pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/mobile-dock.tsx
git commit -m "feat(nav): add the mobile dock component"
```

**Acceptance criteria**
- `md:hidden` present — the dock never renders alongside the permanent sidebar.
- `pb-safe` present — content clears the iOS home indicator.
- More calls `setOpenMobile(true)`; no second drawer implementation exists.
- Slot 2 renders `NotificationBell`, so the badge cannot disagree with the topbar.
- With `work === null` the dock renders three items (Home, Inbox, More) and no placeholder.
- The Work slot keeps the icon from its `NAV_GROUPS` entry.

---

## Task 5: Mount it and reserve space

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx:373-392`

- [ ] **Step 1: Write the failing responsive test**

Create `apps/web/src/components/layout/__tests__/mobile-dock-responsive.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

describe("the dock does not cover content", () => {
  it("reserves bottom space on main below md", () => {
    // A fixed bar over a scroll container hides the last row of every table
    // until the user scrolls past the end, which reads as missing data.
    expect(read("app/(dashboard)/layout.tsx")).toMatch(/pb-16\s+md:pb-0/);
  });

  it("hides the dock from md up", () => {
    expect(read("components/layout/mobile-dock.tsx")).toMatch(/md:hidden/);
  });

  it("respects the iOS home indicator", () => {
    expect(read("components/layout/mobile-dock.tsx")).toMatch(/pb-safe/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/mobile-dock-responsive.test.ts`
Expected: FAIL on the first case — `layout.tsx` has no `pb-16 md:pb-0`

- [ ] **Step 3: Mount the dock and pad main**

In `(dashboard)/layout.tsx`, add the import and render the dock as a sibling of `<main>` inside `SidebarInset`, and add `pb-16 md:pb-0` to `<main>`'s className:

```tsx
import { MobileDock } from "@/components/layout/mobile-dock";
```

```tsx
        <SidebarInset className="min-h-0 overflow-hidden">
          <Topbar />
          <main className="... pb-16 md:pb-0">
            {children}
          </main>
          <MobileDock />
        </SidebarInset>
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @nexora/web exec vitest run src/components/layout/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/layout.tsx" apps/web/src/components/layout/__tests__/mobile-dock-responsive.test.ts
git commit -m "feat(nav): mount the mobile dock and reserve its space"
```

**Acceptance criteria**
- `<main>` carries `pb-16 md:pb-0`; the last table row is reachable at 375px.
- Full gates green: `pnpm type-check`, `eslint` on changed files, `pnpm test`.

---

## Task 6: Tablet Phase A — measure

**Files:**
- Create: `docs/superpowers/plans/2026-09-04-tablet-measurements.md` (the output)

**Prerequisite (blocking):** every surface is behind auth. This task needs an authenticated browser session driven by the user, or a seeded test account. It cannot start unattended.

- [ ] **Step 1: Record the matrix**

Widths: **744, 768, 810, 834, 1024, 1180, 1280**. 768 and 1280 are the boundary worst cases.

- [ ] **Step 2: For each surface, record four measurements**

Surfaces: the list/board/detail of Investors, Sales CRM, Projects, Accounting, HRMS, IT, Office, plus the four import-preview dialogs.

```js
// Run in the page console at each width.
({
  pageOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  clipped: [...document.querySelectorAll("button,a,input,select")]
    .filter((el) => { const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); })
    .map((el) => el.textContent?.trim().slice(0, 40) || el.tagName),
  trappedScrollers: [...document.querySelectorAll("*")]
    .filter((el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY === "hidden")
    .length,
})
```

Use `textContent`, not `innerText` — `innerText` is CSS-aware and has produced both a false negative and a false positive on this codebase.

- [ ] **Step 3: Write the defect list**

One row per confirmed defect: surface, width, measurement, and which of the five static candidates (if any) it corresponds to.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-09-04-tablet-measurements.md
git commit -m "docs(tablet): record measured tablet defects"
```

**Acceptance criteria**
- Every surface × width cell is filled with a number, not a judgement.
- Each of the five static candidates is marked confirmed or cleared — in particular whether each `min-w-[…]` sits inside a scrolling ancestor (acceptable) or a non-scrolling dialog (a clipped control).
- Zero-defect surfaces are recorded as zero. A surface that measures clean must not be "fixed".

---

## Task 7: Tablet Phase B — gated

**This task cannot be written yet, and writing it now would be a placeholder.**

Phase B's task list is the output of Task 6. Ordering by expected leverage — one shared scroll treatment for the four import-preview surfaces, board column behaviour at 768–1024, form grids that step at `sm:` and never adapt — is a hypothesis, not a plan.

**Gate:** once `2026-09-04-tablet-measurements.md` exists, extend this document with one task per confirmed defect, each following the Task 1–5 shape: failing test first, verified failing against the pre-fix source, then the fix.

**Acceptance criteria for the gate**
- No Phase B code is written before the measurements file exists.
- Every Phase B fix has a test proven to fail against the pre-fix source. Precedent: the tag-manager responsive test passed against broken code on its first draft, and only reverting the fix exposed it.

---

## Open decisions

1. **Dock on tablet?** Currently `md:hidden`, so 768–1279 gets the icon rail only. Decide after Task 6 shows how navigable that rail is at 768.
2. **Landscape in scope?** Dropping it removes 1024 and 1180 from the matrix.
