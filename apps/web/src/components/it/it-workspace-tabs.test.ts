import { describe, expect, it } from "vitest";

import { getRequiredPermissions } from "@/app/(dashboard)/layout";
import {
  activeItSurfaceId,
  IT_SURFACES,
  visibleItSurfaces,
} from "@/components/it/it-workspace-tabs";
import { NAV_GROUPS } from "@/components/layout/sidebar";

/**
 * The IT workspace strip is pure apart from two hooks, so the surface list,
 * the active-tab resolution and the permission filter are all testable
 * without mounting. Mirrors the shape of `sidebar.test.tsx`.
 */

/** `hasAnyPermission` for an actor holding exactly `held`. */
function actor(...held: string[]) {
  const owned = new Set(held);
  return (...codes: string[]) => codes.some((c) => owned.has(c));
}

const ALL = [
  "it-crm:read",
  "it-crm:read-all",
  "projects:read",
  "it:dashboard:view",
  "it:billing:view",
  "it:billing:manage",
  "it:access:view",
  "it:access:request",
  "it:access:manage",
  "it:read-all",
];

describe("IT_SURFACES", () => {
  it("lists the six workspace surfaces in strip order", () => {
    expect(IT_SURFACES.map((s) => s.id)).toEqual([
      "dashboard",
      "projects",
      "operations",
      "billing",
      "access",
      "validator-monitor",
    ]);
  });

  it("points each surface at its existing route", () => {
    expect(IT_SURFACES.map((s) => s.href)).toEqual([
      "/it-crm/dashboard",
      "/it-crm",
      "/it-operations",
      "/it-operations/billing",
      "/it-operations/access",
      "/it-crm/validator-monitor",
    ]);
  });

  it("excludes IT Helpdesk", () => {
    // Helpdesk carries a live inbox badge that the strip cannot render, so
    // folding it in would silently drop the counter. Deliberate omission —
    // if this starts failing, that decision was reversed without the badge
    // being handled.
    expect(IT_SURFACES.map((s) => s.href)).not.toContain("/it-helpdesk");
  });

  it("gives every surface at least one permission", () => {
    // An empty list would make `hasAnyPermission()` return false and the tab
    // would never render for anybody, including Admin.
    for (const surface of IT_SURFACES) {
      expect(surface.permissions.length).toBeGreaterThan(0);
    }
  });
});

describe("activeItSurfaceId", () => {
  it("resolves /it-crm/dashboard to Dashboard, not Projects", () => {
    // The regression this exists for: `/it-crm` is a PREFIX of
    // `/it-crm/dashboard`, so a first-match scan lights up Projects on the
    // dashboard route and two tabs read as current.
    expect(activeItSurfaceId("/it-crm/dashboard")).toBe("dashboard");
  });

  it("resolves the bare board route to Projects", () => {
    expect(activeItSurfaceId("/it-crm")).toBe("projects");
  });

  it("resolves each Operations route to its own surface", () => {
    expect(activeItSurfaceId("/it-operations")).toBe("operations");
    expect(activeItSurfaceId("/it-operations/billing")).toBe("billing");
    expect(activeItSurfaceId("/it-operations/access")).toBe("access");
  });

  it("keeps the parent tab lit on a nested detail route", () => {
    // No such route exists yet. When one ships, the strip should stay on
    // Billing rather than going blank.
    expect(activeItSurfaceId("/it-operations/billing/sub-42")).toBe("billing");
  });

  it("does not match a sibling route that merely shares a prefix", () => {
    // `/it-crm-archive` starts with `/it-crm` as a raw string but is not
    // under it — hence the `/` in the prefix test.
    expect(activeItSurfaceId("/it-crm-archive")).toBeNull();
  });

  it("returns null off the workspace and for a null pathname", () => {
    expect(activeItSurfaceId("/it-helpdesk")).toBeNull();
    expect(activeItSurfaceId(null)).toBeNull();
  });

  it("honours an explicit surface list when given one", () => {
    // The `surfaces` parameter still narrows the search. The component no
    // longer passes the filtered list — see "active resolution uses the FULL
    // surface list" below for why — but the parameter is part of the
    // function's contract and the tests above rely on the default.
    const visible = visibleItSurfaces(actor("it:billing:view"));
    expect(activeItSurfaceId("/it-crm", visible)).toBeNull();
  });
});

describe("visibleItSurfaces", () => {
  it("shows all six to an actor holding every IT permission", () => {
    expect(visibleItSurfaces(actor(...ALL))).toHaveLength(6);
  });

  it("shows an it:read-all holder only Validator Monitor", () => {
    // The moved surface's gate is a Helpdesk code, not an IT CRM one, so a
    // ticket-queue reader gets exactly this one tab in the IT workspace.
    expect(visibleItSurfaces(actor("it:read-all")).map((s) => s.id)).toEqual([
      "validator-monitor",
    ]);
  });

  it("shows a project reader only the two IT CRM surfaces", () => {
    expect(visibleItSurfaces(actor("it-crm:read")).map((s) => s.id)).toEqual([
      "dashboard",
      "projects",
    ]);
  });

  it("shows a billing-only actor Operations as well as Billing", () => {
    // Not a leak, and not a wider gate than today: the Operations overview
    // already admits `it:billing:view` in its own guard and renders the
    // billing band for exactly this actor. Asserted because it is the one
    // case where a tab appears that its own label does not name.
    expect(
      visibleItSurfaces(actor("it:billing:view")).map((s) => s.id),
    ).toEqual(["operations", "billing"]);
  });

  it("shows an access-requester Access but not Billing", () => {
    expect(
      visibleItSurfaces(actor("it:access:request")).map((s) => s.id),
    ).toEqual(["access"]);
  });

  it("returns nothing for an actor with no IT permissions", () => {
    // The component renders null on an empty list rather than an empty pill.
    expect(visibleItSurfaces(actor("leave:read"))).toEqual([]);
  });
});

describe("a tab never promises a route its gate refuses", () => {
  /**
   * The invariant: every surface's permissions must be a SUBSET of the gate
   * on its route. A tab granted by a code the route rejects renders, invites
   * a click, and 404s at the layout guard.
   *
   * Asserted against the REAL resolver rather than a local reimplementation of
   * its precedence, so the pattern overrides count. That matters here: once
   * the top-level IT Operations nav entry was removed, `/it-operations` is
   * gated ONLY by its pin, and a copy of the longest-prefix rule would have
   * declared the route ungated while the app was in fact fine — or worse,
   * agreed it was fine when it was not.
   *
   * Two real bugs so far. The Billing tab used to include
   * `it:billing:manage`, which no gate on that route accepts. And deleting
   * the IT Operations nav row made all three ops surfaces resolve to
   * `undefined` — ProtectedRoute performs no check at all in that case, so
   * the route was open to any authenticated user until the pin landed.
   */
  it.each(IT_SURFACES.map((s) => [s.id, s] as const))(
    "%s is gated, and by codes that include every one the tab grants",
    (_id, surface) => {
      const gate = getRequiredPermissions(surface.href);

      // undefined means ProtectedRoute waves the route through entirely.
      expect(
        gate,
        `${surface.href} resolves to NO required permissions — open to any signed-in user`,
      ).toBeDefined();

      const rejected = surface.permissions.filter((p) => !gate!.includes(p));
      expect(
        rejected,
        `${surface.href} would 404 for a holder of only: ${rejected.join(", ")}`,
      ).toEqual([]);
    },
  );

  it("pins /it-crm/validator-monitor ahead of the generic /it-crm pin", () => {
    /*
     * Order-dependent and silent if wrong: ROUTE_PATTERN_OVERRIDES is
     * first-match, so declaring the validator pin AFTER `/^\/it-crm/` makes
     * this route demand `it-crm:read` — a gate the tab's own `it:read-all`
     * does not satisfy. The subset invariant above would catch that, but this
     * asserts the resolved value directly so the failure names the cause.
     */
    expect(getRequiredPermissions("/it-crm/validator-monitor")).toEqual([
      "it:read-all",
    ]);
  });

  it("keeps /it-crm pinned narrower than the IT CRM parent row", () => {
    // The parent carries the union so an ops-only actor still sees the group;
    // without the pin, /it-crm inherits that union by longest-prefix and the
    // IT project board opens to every holder of an IT Ops code — 50 users on
    // the production Employee role.
    const parent = NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => i.id === "it-crm",
    )!;
    const gate = getRequiredPermissions("/it-crm")!;

    expect(parent.permissions).toEqual(
      expect.arrayContaining(["it:access:request"]),
    );
    expect(gate).not.toContain("it:access:request");
    expect(gate).toEqual(["it-crm:read", "it-crm:read-all", "projects:read"]);
  });
});

describe("active resolution uses the FULL surface list", () => {
  it("does not let a hidden surface hand current-page to its ancestor", () => {
    // An actor on /it-operations/billing who cannot see the Billing tab must
    // not get aria-current on Operations — that names a page they are not on.
    // Resolving against IT_SURFACES returns the hidden surface's id, which
    // matches no rendered tab, so nothing is marked current.
    const visible = visibleItSurfaces(actor("it:dashboard:view"));
    expect(visible.map((s) => s.id)).toEqual(["operations"]);

    const activeId = activeItSurfaceId("/it-operations/billing");
    expect(activeId).toBe("billing");
    expect(visible.some((s) => s.id === activeId)).toBe(false);
  });

  it("still marks the surface current when it IS visible", () => {
    const visible = visibleItSurfaces(actor(...ALL));
    const activeId = activeItSurfaceId("/it-operations/billing");
    expect(visible.some((s) => s.id === activeId)).toBe(true);
  });
});
