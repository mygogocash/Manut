import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getRequiredPermissions } from "@/app/(dashboard)/layout";
import { homeHref, homeSlot, workSlot } from "@/components/layout/dock-slots";

const allow = (...held: string[]) => {
  const owned = new Set(held);
  return (...codes: string[]) => codes.some((c) => owned.has(c));
};

describe("homeHref", () => {
  it("sends employee-only users to their portal", () => {
    // auth-provider.tsx:266 already does this. The dock must not restate it as
    // a constant, or the ~50 users on the production Employee role land on a
    // page their role cannot open.
    expect(homeHref(true)).toBe("/my-portal");
  });

  it("sends everyone else to the dashboard", () => {
    expect(homeHref(false)).toBe("/dashboard");
  });
});

describe("workSlot", () => {
  it("excludes whatever Home resolved to", () => {
    // Without this the first permitted item IS the dashboard for most roles,
    // and slots 1 and 3 render the same destination twice.
    const slot = workSlot(
      allow("investor-dashboard:read"),
      false,
      "/dashboard",
    );
    expect(slot?.href).not.toBe("/dashboard");
  });

  it("returns a permitted item the actor can actually open", () => {
    // The nav entry declares `investor-dashboard:read`, not `investors:read` —
    // the dock must match the codes the sidebar actually carries.
    const slot = workSlot(
      allow("investor-dashboard:read"),
      false,
      "/dashboard",
    );
    expect(slot).not.toBeNull();
    expect(slot!.href).toBe("/investors");
  });

  it("skips items open to everyone, which cannot personalise a slot", () => {
    // /survey declares no permissions, so it matched first under the original
    // rule and gave an investor lead a Survey slot.
    const slot = workSlot(
      allow("investor-dashboard:read"),
      false,
      "/dashboard",
    );
    expect(slot!.href).not.toBe("/survey");
  });

  it("returns null when the actor has no second destination", () => {
    // An employee-only actor may hold nothing beyond their portal. The dock
    // then renders three items, not a disabled placeholder.
    expect(workSlot(allow(), true, "/my-portal")).toBeNull();
  });

  it("carries the nav item's own icon", () => {
    // Overriding it with a generic glyph makes the slot unrecognisable
    // against the sidebar entry it points at.
    const slot = workSlot(
      allow("investor-dashboard:read"),
      false,
      "/dashboard",
    );
    expect(typeof slot!.icon).not.toBe("undefined");
  });
});

describe("a dock slot never promises a page the guard refuses", () => {
  /*
   * The invariant that caught the IT surfaces defect: a tab rendered, invited a
   * click, then 404'd at the layout guard.
   *
   * Asserted against the REAL resolver rather than a local reimplementation of
   * precedence, so pattern overrides and longest-prefix matching count.
   */
  it.each([
    ["investor dashboard reader", ["investor-dashboard:read"], false],
    ["employee only, no grants", [] as string[], true],
    ["accounting reader", ["accounting:read"], false],
  ])("%s", (_name, held, employeeOnly) => {
    const owned = new Set(held);
    const has = (...codes: string[]) => codes.some((c) => owned.has(c));
    const home = homeSlot(has, employeeOnly);
    const slot = workSlot(has, employeeOnly, homeHref(employeeOnly));

    const hrefs = [home?.href, slot?.href].filter(Boolean) as string[];
    for (const href of hrefs) {
      const gate = getRequiredPermissions(href);
      // undefined means ProtectedRoute performs no check on that route.
      if (!gate) continue;
      expect(
        gate.some((code) => owned.has(code)),
        `${href} is gated by [${gate.join(", ")}] which this actor does not hold`,
      ).toBe(true);
    }
  });
});

describe("homeSlot", () => {
  it("omits Home when the actor cannot open it", () => {
    // /dashboard is gated on home:read. A module-only actor rendering a Home
    // button would be 404'd by the layout guard on tap.
    expect(homeSlot(allow("investor-dashboard:read"), false)).toBeNull();
  });

  it("offers Home to an actor who holds its gate", () => {
    expect(homeSlot(allow("home:read"), false)?.href).toBe("/dashboard");
  });
});

describe("one notification source", () => {
  const bell = readFileSync(
    resolve(__dirname, "../notification-bell.tsx"),
    "utf8",
  );

  it("keeps a single seen-set key", () => {
    // Two keys means the bell and the dock disagree about what is unread —
    // the bug the -v2 suffix was introduced to fix.
    expect(bell.match(/nexora:notifications:seen-ids-v2/g)?.length).toBe(1);
  });

  it("offers a dock presentation", () => {
    // The dock renders the bell itself rather than linking to an inbox: there
    // is no /notifications route. Reuse makes badge parity structural.
    expect(bell).toMatch(/variant\?:\s*"topbar"\s*\|\s*"dock"/);
  });
});
