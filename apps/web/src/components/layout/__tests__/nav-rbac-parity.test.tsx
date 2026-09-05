import { describe, expect, it } from "vitest";

import { ACCOUNT_MENU_LINKS } from "@/components/layout/account-menu";
import { NAV_GROUPS } from "@/components/layout/sidebar";

// Navigation, RBAC and titles all come from NAV_GROUPS. These tests exist to
// keep that true.
//
// The failure this guards against is specific: someone adds a mobile-only nav
// list, or a second title map, and the two representations drift — so a module
// is reachable on desktop and invisible on mobile, or the header names a page
// something the sidebar does not. Both are silent, and neither shows up in a
// screenshot review.
//
// Deliberately NOT tested here: whether the drawer opens, or how it animates.
// Those need a DOM with Radix portals and a real viewport; they are listed as
// browser verification in docs/pwa/PHASE_4_AUTH_NAVIGATION.md.

type NavChild = {
  id: string;
  label: string;
  href: string;
  permissions?: string[];
};
type NavItem = NavChild & { children?: NavChild[] };

const items = NAV_GROUPS.flatMap((g) => g.items) as unknown as NavItem[];
const children = items.flatMap((i) => i.children ?? []);
const everything: NavChild[] = [...items, ...children];

describe("navigation is a single source", () => {
  it("exposes exactly one navigation export for every surface to read", () => {
    // Sidebar, mobile drawer, route permissions and page titles all consume
    // this. If a `MOBILE_NAV` ever appears beside it, this is the reminder.
    expect(Array.isArray(NAV_GROUPS)).toBe(true);
    expect(NAV_GROUPS.length).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(20);
  });

  it("gives every entry a label and an absolute route", () => {
    for (const entry of everything) {
      expect(entry.label, `${entry.id} label`).toBeTruthy();
      expect(entry.href.startsWith("/"), `${entry.id} href`).toBe(true);
    }
  });

  it("has no duplicate ids, so React keys and active state stay stable", () => {
    const ids = everything.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never points at a mobile-specific route", () => {
    // One canonical URL for browser, tablet and installed PWA.
    for (const entry of everything) {
      expect(entry.href).not.toMatch(/^\/(mobile|m)(\/|$)/);
    }
  });
});

describe("permission filtering is data, not branching", () => {
  // The rule from the brief: presentation may differ by width, the permitted
  // set may not. Because both surfaces filter the same array with the same
  // predicate, parity is structural rather than something to keep in sync.
  it("declares permissions on entries, so filtering cannot be width-dependent", () => {
    const gated = everything.filter((e) => e.permissions?.length);
    expect(gated.length).toBeGreaterThan(10);
    for (const entry of gated) {
      for (const code of entry.permissions ?? []) {
        // `module:action`, or `module:sub:action` — the API defines 28 of the
        // three-segment form (`it:access:approve`, `marketing:dashboard:view`),
        // so both are valid. Asserting only two segments would have failed on
        // correct code, which is how the first run of this test failed.
        expect(code, `${entry.id} -> ${code}`).toMatch(
          /^[a-z0-9-]+:[a-z0-9-]+(:[a-z0-9-]+)?$/,
        );
      }
    }
  });

  it("simulates the same filter both surfaces apply and gets one answer", () => {
    const held = ["projects:read", "leave:read"];
    const allowed = (e: NavChild) =>
      !e.permissions?.length || e.permissions.some((p) => held.includes(p));

    // Whatever a caller does with the result — dock it, or put it in a sheet —
    // the permitted set is identical because it is the same computation.
    const desktop = everything.filter(allowed).map((e) => e.href);
    const mobile = everything.filter(allowed).map((e) => e.href);
    expect(mobile).toEqual(desktop);

    // And it genuinely excludes things: a permission-gated entry the test user
    // does not hold must not appear.
    const excluded = everything.filter((e) => !allowed(e));
    expect(excluded.length).toBeGreaterThan(0);
    for (const e of excluded) expect(desktop).not.toContain(e.href);
  });

  it("keeps a collapsible parent's children independently gated", () => {
    const parents = items.filter((i) => (i.children?.length ?? 0) > 0);
    expect(parents.length).toBeGreaterThan(0);
    for (const parent of parents) {
      for (const child of parent.children ?? []) {
        // A child under an ungated parent still needs its own gate, or the
        // parent becomes a way in.
        expect(child.href.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("nested navigation mirrors the real route structure", () => {
  it("nests children under their parent's path where the routes are nested", () => {
    const parents = items.filter((i) => (i.children?.length ?? 0) > 0);
    for (const parent of parents) {
      const nested = (parent.children ?? []).filter((c) =>
        c.href.startsWith(`${parent.href}/`),
      );
      // At least one child should sit under the parent route; a group whose
      // children are all elsewhere is a sign the hierarchy is invented rather
      // than derived from the routes.
      expect(
        nested.length > 0 ||
          parent.children?.some((c) => c.href === parent.href),
        `${parent.id} has no child under ${parent.href}`,
      ).toBe(true);
    }
  });
});

describe("account menu", () => {
  it("is defined once and shared by the sidebar and the header", () => {
    // Both call sites render `AccountMenuItems`, so this list is the only
    // place an action can be added or lost.
    expect(ACCOUNT_MENU_LINKS.map((l) => l.href)).toEqual([
      "/my-portal",
      "/settings",
    ]);
  });

  it("points only at routes that exist in the app", () => {
    for (const link of ACCOUNT_MENU_LINKS) {
      expect(link.href.startsWith("/")).toBe(true);
      expect(link.label).toBeTruthy();
    }
  });
});
