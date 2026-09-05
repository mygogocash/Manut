"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useRef, useState } from "react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { MobileDock } from "@/components/layout/mobile-dock";
import { AppSidebar, NAV_GROUPS } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalMessageNotifier } from "@/components/messages/global-message-notifier";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useIsAtLeast } from "@/hooks/use-breakpoint";
import { type ModuleId, trackModuleViewed } from "@/lib/events";
import { useAuth } from "@/providers/auth-provider";

const MODULE_FROM_FIRST_SEGMENT: Record<string, ModuleId> = {
  dashboard: "home",
  aria: "aria",
  messages: "messaging",
  projects: "projects",
  partners: "partner_crm",
  sales: "sales_crm",
  deals: "sales_crm",
  "investor-crm": "partner_crm",
  investors: "partner_crm",
  "investor-updates": "partner_crm",
  employees: "employees",
  directory: "employees",
  leave: "leave",
  travel: "travel",
  careers: "careers",
  applications: "careers",
  survey: "survey",
  payroll: "payroll",
  legal: "legal",
  dataroom: "legal",
  hrms: "hrms",
  learning: "learning",
  visa: "visa",
  benefits: "benefits",
  "my-portal": "my_portal",
  admin: "admin",
  settings: "settings",
};

// Paths that an employee-only user (every role named exactly
// "Employee") may navigate to. Used only to decide whether to
// redirect them away to `/my-portal` — the route-level permission
// check still runs separately, so an employee that lacks the
// per-route permission still gets blocked by `ProtectedRoute`.
//
// `/gmail` and `/drive` are deliberately NOT on this list (#522):
// employee-only users without `integrations:use` would land on the
// page, see UI shells, then watch every API call 403 — bad UX and
// a defense-in-depth leak if any of those endpoints regress to
// `authenticate`-only. The employee sidebar doesn't link them
// either, so direct URL access was the only way in.
const EMPLOYEE_ALLOWED_PREFIXES = [
  "/my-portal",
  "/settings",
  "/change-password",
  "/leave",
  "/travel",
  "/expenses",
  "/cash-advance",
  "/survey",
  "/hrms",
  "/learning",
  "/visa",
  "/benefits",
  "/office",
  "/directory",
];

const ROUTE_PERMISSIONS: Record<string, string[]> = {};
for (const group of NAV_GROUPS) {
  for (const item of group.items) {
    if (item.permissions) {
      ROUTE_PERMISSIONS[item.href] = item.permissions;
    }
  }
}

// Path-pattern overrides for routes that need broader perms than
// their sidebar entry implies. The project detail page
// (`/projects/<id>`) is shared by every team-CRM workspace —
// clicking "View" on an IT CRM / Product CRM / Legal CRM / HR CRM
// row routes here too. Without this override the layout matches
// `/projects` (gated on `projects:read` from the sidebar entry)
// and a team-only user sees the global 404 page instead of the
// board (Kunanon, 2026-05-25). Service-layer
// `requireParticipant` still scopes which rows the user can open.
const ROUTE_PATTERN_OVERRIDES: { match: RegExp; perms: string[] }[] = [
  // AI Project Orchestrator — Phase 1 intake copilot. Needs create rights
  // (not just read). Declared BEFORE the generic /projects/:id read override.
  {
    match: /^\/projects\/intake/,
    perms: [
      "projects:create",
      "it-crm:create",
      "product-crm:create",
      "legal-crm:create",
      "accounting-crm:create",
      "hr-crm:create",
    ],
  },
  // AI Project Orchestrator — executive & dev-scheduling landing pages are
  // reached from the dashboard queue / notification bell. An approver-only
  // role holds `projects:business-head-approve` / `product-admin-approve` /
  // `development-schedule` but NOT the plain `projects:read` the generic
  // `/projects/:id` override below gates on, so without these anchored
  // entries they'd 404 at the layout guard (the page + APIs still scope the
  // actual rows by role). Declared BEFORE the generic `/projects/:id`.
  {
    match: /^\/projects\/business-head/,
    perms: [
      "projects:business-head-approve",
      "projects:read-all",
      "projects:manage",
    ],
  },
  {
    match: /^\/projects\/product-admin/,
    perms: [
      "projects:product-admin-approve",
      "projects:read-all",
      "projects:manage",
    ],
  },
  {
    match: /^\/projects\/development/,
    perms: [
      "projects:development-schedule",
      "projects:read-all",
      "projects:manage",
    ],
  },
  {
    // AI Project Orchestrator — Pipeline board hub (all stages). Any project
    // reader OR pipeline operator (approver / dev-lead) can view; the board
    // scopes a plain requestor to their own submissions.
    match: /^\/projects\/orchestrator/,
    perms: [
      "projects:read",
      "projects:read-all",
      "projects:manage",
      "projects:business-head-approve",
      "projects:product-admin-approve",
      "projects:development-schedule",
      "it-crm:read",
      "product-crm:read",
      "legal-crm:read",
      "accounting-crm:read",
      "hr-crm:read",
    ],
  },
  {
    match: /^\/projects\/[^/]+/,
    perms: [
      "projects:read",
      "projects:read-all",
      "it-crm:read",
      "it-crm:read-all",
      "product-crm:read",
      "product-crm:read-all",
      "legal-crm:read",
      "legal-crm:read-all",
      "accounting-crm:read",
      "accounting-crm:read-all",
      "hr-crm:read",
      "hr-crm:read-all",
    ],
  },
  // Approval landing pages are reached from the dashboard "Pending
  // actions" list and the notification bell. An approver / HR user
  // holds `*:approve` / `*:hr-read` but not the plain `*:read` the
  // sidebar entry gates on, so the bare `/leave` etc. deep-link 404s
  // for them (e.g. the CEO, who sees a system-wide queue via
  // `*:hr-read`). Widen the guard to the read/approve/hr-read union
  // so they can open the page; the page + APIs still scope the actual
  // rows by role. Anchored so `/leave/approval` (HR-only config) and
  // `/leave/<id>` keep their stricter prefix-derived perms.
  {
    match: /^\/leave$/,
    perms: [
      "leave:read",
      "leave:approve",
      "leave:approve-wfh",
      "leave:hr-read",
    ],
  },
  {
    match: /^\/travel$/,
    perms: ["travel:read", "travel:approve", "travel:hr-read"],
  },
  {
    match: /^\/expenses$/,
    perms: ["expense:read", "expense:approve", "expense:hr-read"],
  },
  // AI Project Orchestrator — Executive Analytics (read-only). Without a
  // guard, getRequiredPermissions("/analytics") returns undefined and any
  // authenticated user reaches the route (the API still enforces the perms).
  {
    match: /^\/analytics/,
    perms: [
      "analytics:read",
      "analytics:read-all",
      "projects:read-all",
      "projects:manage",
    ],
  },
  // Sales CRM is a collapsible parent (All deals / business units /
  // Unassigned). This pin is load-bearing, because ROUTE_PERMISSIONS is
  // derived from TOP-LEVEL nav items only and children inherit by
  // longest-prefix — without it `/sales` would inherit whatever union the
  // parent carries. (The retired `/sales-revenue` module needs no pin: its
  // page is gone and next.config redirects the path to the aria view, so
  // there is no route left for ProtectedRoute to fail open on.)
  {
    match: /^\/sales(\/|$)/,
    perms: ["crm:read", "deals:read"],
  },
  // IT CRM became a collapsible parent (Projects / Operations / Billing /
  // Access) and the top-level IT Operations entry is gone. Same two
  // load-bearing pins as Sales CRM above, for the same reason —
  // ROUTE_PERMISSIONS is derived from TOP-LEVEL nav items only:
  //
  //   • `/it-operations` no longer has a nav entry and does not sit under the
  //     `/it-crm` prefix, so without this it resolves to `undefined` — and
  //     ProtectedRoute skips its check entirely when nothing is required,
  //     opening billing figures and the access queue to any signed-in
  //     employee. These are the old nav entry's exact perms; keeping
  //     `it:access:request` is what lets a plain Employee still open
  //     `/it-operations/access` to file a request.
  //   • `/it-crm` would otherwise inherit the parent's union (which now spans
  //     every IT Ops code), handing the IT project board to all 50 holders of
  //     the production Employee role. Pin it back to its original gate.
  {
    match: /^\/it-operations(\/|$)/,
    perms: [
      "it:dashboard:view",
      "it:billing:view",
      "it:access:view",
      "it:access:request",
      "it:access:manage",
    ],
  },
  // Validator Monitor is an IT CRM surface but an IT Helpdesk permission:
  // the API's report endpoint gates on `it:read-all`, which is absent from
  // the `/it-crm` pin below. Declared FIRST because overrides are
  // first-match — under the generic pin this route would demand
  // `it-crm:read` and lock out the very actors the tab is shown to.
  {
    match: /^\/it-crm\/validator-monitor(\/|$)/,
    perms: ["it:read-all"],
  },
  {
    match: /^\/it-crm(\/|$)/,
    perms: ["it-crm:read", "it-crm:read-all", "projects:read"],
  },
];

/**
 * The permissions a route requires: pattern overrides first, then
 * ROUTE_PERMISSIONS by most-specific prefix.
 *
 * Exported so tests can assert against the REAL resolver rather than
 * re-implementing this precedence. `undefined` means ProtectedRoute performs
 * no check at all, so a route that resolves to undefined is open to any
 * authenticated user — which is what the pins above exist to prevent.
 */
export function getRequiredPermissions(pathname: string): string[] | undefined {
  for (const override of ROUTE_PATTERN_OVERRIDES) {
    if (override.match.test(pathname)) return override.perms;
  }
  const exact = ROUTE_PERMISSIONS[pathname];
  if (exact) return exact;

  // Most-specific-prefix wins so a route nested under a broader nav
  // entry (e.g. `/legal/announcements/<uuid>`) gets its own
  // permissions instead of inheriting the parent's. Previously the
  // first matching iteration won, so `/legal` (gated on
  // `legal:read`) shadowed `/legal/announcements` (gated on
  // `legal:announcement-read`) and admins without a stray
  // `legal:read` saw a 404 on the announcement detail page.
  let bestHref: string | null = null;
  for (const href of Object.keys(ROUTE_PERMISSIONS)) {
    if (href === "/dashboard") continue;
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!bestHref || href.length > bestHref.length) bestHref = href;
    }
  }
  return bestHref ? ROUTE_PERMISSIONS[bestHref] : undefined;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { isEmployeeOnly, isLoading, isAuthenticated } = useAuth();
  const isEmployeeAllowed = EMPLOYEE_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  // Always resolve per-route permissions (#522). Previously this was
  // `undefined` for employee-only users on allowlisted paths, which
  // skipped the `ProtectedRoute` check entirely — turning the
  // employee-allowlist into a permission bypass instead of a
  // navigation bound. With the redirect-to-my-portal logic below
  // already covering "where can an employee go", the permission
  // check on what they can do once they're there is independent and
  // must run.
  const requiredPermissions = getRequiredPermissions(pathname);

  // `xl` and up gets the expanded sidebar; below that it starts collapsed.
  // Resolves to `false` on the first client render, so the sidebar settles
  // open on desktop after mount rather than flashing expanded on a tablet.
  const isWide = useIsAtLeast("xl");

  // The provider MUST be controlled for that settling to happen. `defaultOpen`
  // feeds a `useState` initial value inside SidebarProvider, and `isWide` is
  // false on the first render at every width — so passing it as `defaultOpen`
  // pinned the sidebar collapsed on desktop forever, with no effect to reopen
  // it and a `sidebar_state` cookie that is written but never read. Holding the
  // state here and syncing it once the media query resolves is what actually
  // delivers "collapsed on tablet, expanded on desktop".
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => setSidebarOpen(isWide), [isWide]);

  useEffect(() => {
    if (isLoading) return;
    if (!isEmployeeOnly) return;
    if (isEmployeeAllowed) return;

    router.replace("/my-portal");
  }, [isEmployeeOnly, isEmployeeAllowed, isLoading, router]);

  // module.viewed — fires once per module change. Single useEffect for all 18+
  // modules; per-page instrumentation is intentionally NOT used.
  const lastModuleRef = useRef<ModuleId | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0] ?? "";
    const moduleId = MODULE_FROM_FIRST_SEGMENT[firstSegment];
    if (!moduleId) return;
    if (moduleId === lastModuleRef.current) return;
    lastModuleRef.current = moduleId;
    trackModuleViewed({
      module: moduleId,
      sub_section: segments[1],
    });
  }, [pathname, isAuthenticated]);

  return (
    <ProtectedRoute requiredPermissions={requiredPermissions}>
      <GlobalMessageNotifier />
      {/* Tablets start with the sidebar collapsed to its icon rail.
          Between 768px and 1279px a 16rem sidebar plus content leaves the
          content column too narrow for the tables it has to hold, and the
          sidebar is one tap away either way. Above that, unchanged: open by
          default, exactly as desktop has always behaved. Nothing is removed at
          any width — `collapsible="icon"` keeps every item reachable. */}
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className="h-svh min-h-0!"
      >
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-hidden">
          <Topbar />
          <main
            className={`
              bg-background flex min-h-0 flex-1 flex-col overflow-hidden
            `}
          >
            {/* pb-16 md:pb-0 belongs on THIS element, not on <main>: main is
                overflow-hidden, so padding there is never scrolled past. This
                is the scroll container, and without the reserve the last row
                of every table sits under the fixed dock — which reads as
                missing data rather than as a layout bug. */}
            <div
              data-ph-scroll-root
              className={`
                scrollbar-thumb-border flex min-h-0 w-full flex-1 scrollbar-thin
                scrollbar-track-transparent flex-col overflow-auto px-4 py-4
                pb-16
                hover:scrollbar-thumb-muted-foreground/30
                sm:px-6 sm:py-5
                md:pb-0
              `}
            >
              {children}
            </div>
          </main>

          {/* Sibling of main so it is not inside the scroll container. */}
          <MobileDock />
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
