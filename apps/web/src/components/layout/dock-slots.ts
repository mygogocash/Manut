import type { LucideIcon } from "lucide-react";

import { EMPLOYEE_NAV_GROUPS, NAV_GROUPS } from "@/components/layout/sidebar";

/**
 * Slot derivation for the mobile dock, kept free of JSX so the branching that
 * actually matters — persona, permissions, the Home exclusion, the empty case
 * — is testable without mounting a component.
 */
export interface DockSlot {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Mirrors the rule in `auth-provider.tsx` rather than restating it as a
 * constant. Hardcoding `/dashboard` would send every employee-only account to
 * a page its role cannot open.
 */
export function homeHref(isEmployeeOnly: boolean): string {
  return isEmployeeOnly ? "/my-portal" : "/dashboard";
}

/** Every nav item, in sidebar order, for the group this actor sees. */
function itemsFor(isEmployeeOnly: boolean) {
  return (isEmployeeOnly ? EMPLOYEE_NAV_GROUPS : NAV_GROUPS).flatMap(
    (group) => group.items,
  );
}

/**
 * Home, but only if the actor may actually open it.
 *
 * The persona rule alone is not enough: `/dashboard` is gated on `home:read`,
 * which an actor holding only a module code does not necessarily have. A slot
 * that renders and then 404s at the layout guard is the exact defect the
 * RBAC parity test exists to prevent, so this returns null and the dock omits
 * the slot rather than offering a door that does not open.
 */
export function homeSlot(
  hasAnyPermission: (...codes: string[]) => boolean,
  isEmployeeOnly: boolean,
): DockSlot | null {
  const target = homeHref(isEmployeeOnly);
  const item = itemsFor(isEmployeeOnly).find((i) => i.href === target);
  if (!item) return null;

  const codes = item.permissions ?? [];
  // Unlike the Work slot, an undeclared Home is allowed: it means the route is
  // open to any signed-in user, which is a valid Home, not a failure to
  // personalise.
  if (codes.length > 0 && !hasAnyPermission(...codes)) return null;

  return { id: item.id, label: "Home", href: item.href, icon: item.icon };
}

/**
 * The dock's one adaptive slot: the first nav destination this actor may open,
 * in the order the sidebar already uses.
 *
 * Derived rather than configured so adding a module adds a dock destination
 * with no edit here. Returns null rather than a placeholder when the actor has
 * no second destination — an employee-only account may hold nothing beyond its
 * portal, and a dead slot is worse than a three-item dock.
 */
export function workSlot(
  hasAnyPermission: (...codes: string[]) => boolean,
  isEmployeeOnly: boolean,
  homeTarget: string,
): DockSlot | null {
  for (const item of itemsFor(isEmployeeOnly)) {
    // Slot 1 already goes here; rendering it twice wastes a quarter of the bar.
    if (item.href === homeTarget) continue;

    /*
     * Items with NO declared permissions are skipped, not accepted.
     *
     * They are open to every signed-in user, so they say nothing about THIS
     * user and cannot be a personalised slot. Accepting them made the rule
     * resolve to /survey for an investor lead — nav order is a layout order,
     * not a relevance order — and made the "no second destination" branch
     * unreachable, because a permission-less item matches an actor holding
     * nothing. Only 2 of 53 top-level items are affected (/my-portal,
     * /settings), and both stay reachable from More and the account menu.
     */
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

  return null;
}
