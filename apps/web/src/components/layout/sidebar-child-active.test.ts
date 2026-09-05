import { describe, expect, it } from "vitest";

import { childIsActive, childPathname } from "@/components/layout/sidebar";

// The Sales CRM group puts several children on ONE pathname (`/sales`) and
// distinguishes them by `?bu=`. Pathname-only matching would light every
// sibling at once, so these cases pin the param comparison down.

const params = (qs: string) => new URLSearchParams(qs);

const ALL_DEALS = {
  id: "sales-all",
  label: "All deals",
  href: "/sales?tab=pipeline",
  matchParams: { bu: "" },
};
const ONEWAVE = {
  id: "sales-bu-onewave",
  label: "Onewave",
  href: "/sales?tab=pipeline&bu=onewave",
  matchParams: { bu: "onewave" },
};
const ARIA = {
  id: "sales-bu-aria",
  label: "ARIA",
  href: "/sales?tab=pipeline&bu=aria",
  matchParams: { bu: "aria" },
};
const PLAIN_CHILD = {
  id: "projects-requests",
  label: "Requests",
  href: "/projects/requests",
};

describe("childPathname", () => {
  it("strips the query so route matching stays pathname-based", () => {
    expect(childPathname("/sales?tab=pipeline&bu=onewave")).toBe("/sales");
    expect(childPathname("/projects/requests")).toBe("/projects/requests");
  });
});

describe("childIsActive", () => {
  it("lights exactly one sibling when a unit filter is applied", () => {
    const p = params("tab=pipeline&bu=onewave");
    expect(childIsActive(ONEWAVE, "/sales", p)).toBe(true);
    expect(childIsActive(ARIA, "/sales", p)).toBe(false);
    expect(childIsActive(ALL_DEALS, "/sales", p)).toBe(false);
  });

  it("falls back to All deals when no unit is selected", () => {
    const p = params("tab=pipeline");
    expect(childIsActive(ALL_DEALS, "/sales", p)).toBe(true);
    expect(childIsActive(ONEWAVE, "/sales", p)).toBe(false);
  });

  it("treats an empty bu param the same as an absent one", () => {
    expect(childIsActive(ALL_DEALS, "/sales", params("bu="))).toBe(true);
  });

  it("ignores params the child does not care about", () => {
    expect(
      childIsActive(ONEWAVE, "/sales", params("bu=onewave&tab=leads&x=1")),
    ).toBe(true);
  });

  it("stays inactive when the route is elsewhere entirely", () => {
    expect(childIsActive(ONEWAVE, "/investor-crm", params("bu=onewave"))).toBe(
      false,
    );
  });

  it("keeps working for children with no param constraints", () => {
    expect(childIsActive(PLAIN_CHILD, "/projects/requests", null)).toBe(true);
    expect(childIsActive(PLAIN_CHILD, "/projects", null)).toBe(false);
  });
});
