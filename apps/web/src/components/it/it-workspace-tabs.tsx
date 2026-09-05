"use client";

import type { LucideIcon } from "lucide-react";
import {
  FolderKanban,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { tabsListVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

/** One surface of the IT workspace. */
export interface ItSurface {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any one of these grants the tab. */
  permissions: string[];
}

/**
 * The IT workspace's surfaces, in strip order.
 *
 * IT CRM and IT Operations were two separate top-level modules, and
 * Operations' own Billing and Access pages were reachable only as buttons
 * inside its header. This list is what makes the five routes read as one
 * workspace, mirroring `/sales`.
 *
 * Deliberately NOT merged into a single tabbed page: each route keeps its own
 * data fetching, gates and content, and the strip is a shared locator over
 * them. Converting to real `TabsContent` later means changing where this list
 * renders, not the list itself.
 *
 * IT Helpdesk is excluded on purpose — it carries a live inbox badge that a
 * tab cannot render, so folding it in would silently drop the counter.
 */
export const IT_SURFACES: readonly ItSurface[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/it-crm/dashboard",
    icon: LayoutDashboard,
    permissions: ["it-crm:read", "it-crm:read-all", "projects:read"],
  },
  {
    id: "projects",
    label: "Projects",
    href: "/it-crm",
    icon: FolderKanban,
    permissions: ["it-crm:read", "it-crm:read-all", "projects:read"],
  },
  {
    id: "operations",
    label: "Operations",
    href: "/it-operations",
    icon: HardDrive,
    permissions: [
      "it:dashboard:view",
      "it:billing:view",
      "it:access:view",
      "it:access:manage",
    ],
  },
  {
    /*
     * INVARIANT: a surface's permissions must be a SUBSET of the gate on its
     * route, or the tab promises a page that 404s on arrival.
     *
     * `it:billing:manage` is deliberately absent even though the Billing page
     * itself keys "can edit" off it. The route's gate comes from the
     * `/it-operations` sidebar entry (ROUTE_PERMISSIONS is derived from
     * top-level nav items, and `/it-operations/billing` inherits by
     * longest-prefix), and that entry does not list `manage`. Including it
     * here would show a Billing tab to a manage-without-view holder whose
     * click then hits the layout guard.
     *
     * Whether manage-without-view *should* reach the page is a route-gate
     * question, not a tab question — and it is a pre-existing gap: the
     * sidebar cannot get such an actor there today either.
     */
    id: "billing",
    label: "Billing",
    href: "/it-operations/billing",
    icon: Wallet,
    permissions: ["it:billing:view"],
  },
  {
    id: "access",
    label: "Access",
    href: "/it-operations/access",
    icon: KeyRound,
    permissions: ["it:access:view", "it:access:request", "it:access:manage"],
  },
  {
    /*
     * Moved here from a tab inside IT Helpdesk. It reports on BnryMainnet
     * validator balances, which is infrastructure the IT workspace owns —
     * it was never a support ticket surface.
     *
     * Gated on `it:read-all`, the code the API's report endpoint requires
     * (`validator-monitor.controller.ts`). That is NOT one of the IT CRM
     * codes, so `/it-crm/validator-monitor` carries its OWN pin in
     * ROUTE_PATTERN_OVERRIDES, declared before the generic `/it-crm` pin.
     * Without that pin the route would inherit `it-crm:read` and this tab
     * would promise a page the guard refuses — the invariant above. Keeping
     * the tab's code equal to the API's is also what stops the opposite
     * failure: an IT CRM reader reaching the page and getting a 403 panel.
     */
    id: "validator-monitor",
    label: "Validator Monitor",
    href: "/it-crm/validator-monitor",
    icon: ShieldCheck,
    permissions: ["it:read-all"],
  },
] as const;

/**
 * Which surface a pathname belongs to: the LONGEST href that either equals it
 * or is a prefix of it followed by `/`.
 *
 * Longest-prefix rather than exact match for two reasons. `/it-crm` is a
 * prefix of `/it-crm/dashboard`, so a first-match scan would light up
 * Projects on the dashboard route. And a future detail page under Billing or
 * Access keeps its parent tab lit instead of clearing the strip.
 *
 * Mirrors `bestMatchHref` in `sidebar.tsx`, which resolves the same ambiguity
 * for the nav.
 */
export function activeItSurfaceId(
  pathname: string | null,
  surfaces: readonly ItSurface[] = IT_SURFACES,
): string | null {
  if (!pathname) return null;
  let best: ItSurface | null = null;
  for (const surface of surfaces) {
    const matches =
      pathname === surface.href || pathname.startsWith(`${surface.href}/`);
    if (!matches) continue;
    if (!best || surface.href.length > best.href.length) best = surface;
  }
  return best?.id ?? null;
}

/**
 * The surfaces a given actor may see.
 *
 * Tab visibility is presentation only — it hides a control the actor cannot
 * use. The authority is still `ProtectedRoute` in the dashboard layout, which
 * gates each of these routes from its own top-level nav entry. Nothing here
 * grants access; dropping this filter would show dead tabs, not open doors.
 */
export function visibleItSurfaces(
  hasAnyPermission: (...codes: string[]) => boolean,
  surfaces: readonly ItSurface[] = IT_SURFACES,
): ItSurface[] {
  return surfaces.filter((s) => hasAnyPermission(...s.permissions));
}

/*
 * Trigger styling mirrors the `data-active` treatment in
 * `components/ui/tabs.tsx`. Duplicated rather than reused because this strip
 * is navigation, not a tab widget: there is no panel for a `role="tab"` to
 * control, so Radix's `TabsTrigger` would announce a tablist whose tabs lead
 * nowhere. Links plus `aria-current` is the honest markup. The container does
 * reuse the exported `tabsListVariants`, so the pill itself cannot drift.
 */
const TRIGGER_BASE = `
  relative inline-flex items-center justify-center gap-1.5 rounded-md border
  border-transparent px-3 py-0.5 text-sm font-medium whitespace-nowrap
  transition-all
  focus-visible:border-ring focus-visible:ring-ring/50
  focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1
  [&_svg]:pointer-events-none [&_svg]:shrink-0
`;

const TRIGGER_IDLE = `
  text-foreground/60
  hover:text-foreground
  dark:text-muted-foreground dark:hover:text-foreground
`;

const TRIGGER_ACTIVE = `
  bg-background text-foreground shadow-sm
  dark:border-input dark:bg-input/30 dark:text-foreground
`;

/**
 * Shared surface switcher for the IT workspace, rendered under each page's
 * `PageHeader`.
 *
 * Renders whenever the actor can see at least one surface — a lone tab still
 * anchors the page to the workspace rather than leaving a header floating
 * with no locator.
 */
export function ItWorkspaceTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const { hasAnyPermission } = useAuth();

  const surfaces = visibleItSurfaces(hasAnyPermission);
  if (surfaces.length === 0) return null;

  /*
   * Resolved against the FULL list, not the visible one. Against the filtered
   * list a hidden surface lets an ANCESTOR win the longest-prefix match — an
   * actor on /it-operations/billing without the Billing tab would get
   * aria-current="page" on Operations, naming a page they are not on. With
   * the full list `activeId` may simply name a hidden surface, and no visible
   * tab is marked current, which is the truth.
   */
  const activeId = activeItSurfaceId(pathname);

  return (
    <nav aria-label="IT workspace" className={cn("mb-6", className)}>
      {/*
        min-h-8, not h-8: this track is flex-wrap, and a fixed 32px leaves a
        26px content box that cannot grow to a second line, so a wrapped row
        paints OUTSIDE the bg-muted pill. Five tabs need ~523px, which the
        content column drops below around an 875px window with the sidebar
        expanded — a reachable desktop size, not just phones. An explicit
        height is still required: tabsListVariants' own h-8 is gated on
        `group-data-[orientation=horizontal]/tabs`, and this strip renders
        outside any <Tabs> root.
      */}
      <div className={cn(tabsListVariants(), "min-h-8 flex-wrap")}>
        {surfaces.map(({ id, label, href, icon: Icon }) => {
          const active = id === activeId;
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                TRIGGER_BASE,
                active ? TRIGGER_ACTIVE : TRIGGER_IDLE,
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
