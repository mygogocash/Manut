import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { IT_SURFACES } from "@/components/it/it-workspace-tabs";
import { buildSalesCrmChildren, NAV_GROUPS } from "@/components/layout/sidebar";

describe("NAV_GROUPS sidebar structure", () => {
  it("includes Messaging under Workspace gated by messages:read", () => {
    const workspace = NAV_GROUPS.find((g) => g.label === "Workspace");
    expect(workspace).toBeDefined();
    const messaging = workspace!.items.find((i) => i.id === "messages");
    expect(messaging).toBeDefined();
    expect(messaging!.label).toBe("Messaging");
    expect(messaging!.href).toBe("/messages");
    expect(messaging!.permissions).toContain("messages:read");
  });
});

describe("Sales CRM group — module retired, board is the one surface", () => {
  const workspace = () => NAV_GROUPS.find((g) => g.label === "Workspace")!;
  const sales = () => workspace().items.find((i) => i.id === "sales")!;

  it("exposes no /sales-revenue nav entry at any level", () => {
    // The ARIA Revenue module is retired; its deals live on the Sales board
    // tagged `aria`. A nav row pointing at the dead route would land users on
    // the next.config redirect for no reason.
    const topLevelHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(topLevelHrefs).not.toContain("/sales-revenue");
    expect(buildSalesCrmChildren([]).map((c) => c.href)).not.toContain(
      "/sales-revenue",
    );
  });

  it("no longer carries sales-revenue:read on the parent", () => {
    // The union existed so an ARIA-only user could reach the module child.
    // With the child gone it would only widen who sees a parent whose every
    // child they cannot open.
    expect(sales().permissions).toEqual(["crm:read", "deals:read"]);
  });

  it("keeps /sales pinned to its own gate", () => {
    // ROUTE_PERMISSIONS is derived from top-level items only; the pin stops
    // /sales inheriting whatever union the parent carries. The overrides are
    // not exported, so assert on the source text.
    const layout = readFileSync(
      resolve(__dirname, "../../app/(dashboard)/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("/^\\/sales(\\/|$)/");
    expect(layout).toContain('perms: ["crm:read", "deals:read"]');
    // The retired module's pin must be GONE: its page no longer exists, and a
    // stale pattern here would shadow any future route sharing the prefix.
    // Assert on the pin syntax, not the bare word — a comment may still
    // narrate the retirement.
    expect(layout).not.toContain("/^\\/sales-revenue");
    expect(layout).not.toContain('perms: ["sales-revenue:read"]');
  });
});

describe("buildSalesCrmChildren — one row per meaning", () => {
  // The live catalog: 20261224000000_crm_business_units seeds onewave,
  // onewave_revenue AND aria. ARIA is a business unit, full stop — the
  // separate /sales-revenue module is retired and its deals migrated onto
  // this board tagged `aria`.
  const UNITS = [
    { code: "onewave", label: "Onewave" },
    { code: "onewave_revenue", label: "Onewave Revenue" },
    { code: "aria", label: "ARIA" },
  ];

  it("renders a view for every business unit plus Unassigned, in order", () => {
    expect(buildSalesCrmChildren(UNITS).map((c) => c.label)).toEqual([
      "All deals",
      "Onewave",
      "Onewave Revenue",
      "ARIA",
      "Unassigned",
    ]);
  });

  it("points Unassigned at the reserved sentinel, as a matchParam too", () => {
    // `__none__` is a filter value, never a real code — codes cannot contain
    // underscores. Without the matchParams entry every sibling on the shared
    // /sales pathname would light up at once.
    const unassigned = buildSalesCrmChildren(UNITS).find(
      (c) => c.label === "Unassigned",
    )!;
    expect(unassigned.href).toBe("/sales?tab=pipeline&bu=__none__");
    expect(unassigned.matchParams).toEqual({ bu: "__none__" });
    expect(unassigned.permissions).toEqual(["crm:read", "deals:read"]);
  });

  it("renders no two children with the same label", () => {
    // THE invariant behind the #1124 double-ARIA bug: catches a collision
    // from any cause — a new seed row, an admin renaming a unit — instead of
    // only the one code somebody remembered to exclude.
    const labels = buildSalesCrmChildren(UNITS).map((c) => c.label);
    expect(labels).toEqual([...new Set(labels)]);
  });

  it("scopes each unit view with matchParams, not just a pathname", () => {
    const aria = buildSalesCrmChildren(UNITS).find(
      (c) => c.href === "/sales?tab=pipeline&bu=aria",
    )!;
    expect(aria.matchParams).toEqual({ bu: "aria" });
  });

  it("keeps All deals and Unassigned when the unit fetch yields nothing", () => {
    // Fail-open: "no unit yet" is a property of DEALS, not of the catalog, so
    // the Unassigned view must not vanish with a failed /business-units call.
    expect(buildSalesCrmChildren([]).map((c) => c.href)).toEqual([
      "/sales?tab=pipeline",
      "/sales?tab=pipeline&bu=__none__",
    ]);
  });
});

describe("IT CRM group — IT Operations folded in", () => {
  const workspace = () => NAV_GROUPS.find((g) => g.label === "Workspace")!;
  const itCrm = () => workspace().items.find((i) => i.id === "it-crm")!;

  it("no longer exposes IT Operations as a top-level nav item", () => {
    // It is a child of IT CRM now. If it comes back as a top-level entry the
    // sidebar shows the module twice — the bug that shipped when ARIA was
    // folded into Sales CRM.
    const topLevelHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(topLevelHrefs).not.toContain("/it-operations");
  });

  it("carries the union of its children's perms on the parent", () => {
    // Load-bearing for a specific group of real people: on production the
    // Employee role (50 users) holds `it:access:request` and NOTHING from the
    // IT CRM set. The old top-level IT Operations row was their only route to
    // the access-request form, so without the union they lose the nav
    // entirely and cannot file a request.
    expect(itCrm().permissions).toEqual(
      expect.arrayContaining([
        "it-crm:read",
        "projects:read",
        "it:dashboard:view",
        "it:billing:view",
        "it:access:view",
        "it:access:request",
        "it:access:manage",
      ]),
    );
  });

  it("derives its children from the tab strip's surface list", () => {
    // One source of truth: the nav and the in-page strip must show the same
    // surfaces, and two hand-kept lists would drift the first time somebody
    // adds one.
    expect(itCrm().children?.map((c) => c.href)).toEqual(
      IT_SURFACES.map((s) => s.href),
    );
    expect(itCrm().children?.map((c) => c.label)).toEqual(
      IT_SURFACES.map((s) => s.label),
    );
  });

  it("gives an access-requester exactly one child to click", () => {
    // The Employee-role path end to end: parent renders (union), and the only
    // child they can see is the one they can actually open.
    const held = new Set(["it:access:request"]);
    const visible = (itCrm().children ?? []).filter((c) =>
      c.permissions?.some((p) => held.has(p)),
    );
    expect(visible.map((c) => c.href)).toEqual(["/it-operations/access"]);
  });
});
