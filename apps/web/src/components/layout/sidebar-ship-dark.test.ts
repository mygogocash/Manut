import { describe, expect, it } from "vitest";

import {
  filterShipDarkChildren,
  MARKETING_ANALYTICS_CHILD_IDS,
} from "@/components/layout/sidebar";

const CHILDREN = [
  { id: "partners-list" },
  { id: "marketing-analytics" },
  { id: "marketing-partners" },
  { id: "marketing-traffic" },
  { id: "marketing-dau-mau" },
  { id: "marketing-campaigns" },
  { id: "marketing-reports" },
];

describe("filterShipDarkChildren", () => {
  it("drops the whole Marketing Analytics family when the flag is off", () => {
    const kept = filterShipDarkChildren(CHILDREN, false).map((c) => c.id);
    expect(kept).toEqual(["partners-list"]);
  });

  it("keeps Partners, so the Marketing CRM parent stays reachable", () => {
    // The sidebar drops a collapsible parent whose children are all filtered
    // out. Partners is the ORIGINAL module and already in production, so
    // gating it too would make the whole group vanish from prod.
    expect(filterShipDarkChildren(CHILDREN, false)).toHaveLength(1);
  });

  it("keeps everything when the flag is on", () => {
    expect(filterShipDarkChildren(CHILDREN, true)).toHaveLength(
      CHILDREN.length,
    );
  });

  it("gates exactly the six family entries and not Partners", () => {
    // Pins the list itself: adding a seventh family route without adding its
    // id here would ship it ungated.
    expect([...MARKETING_ANALYTICS_CHILD_IDS]).toHaveLength(6);
    expect([...MARKETING_ANALYTICS_CHILD_IDS]).not.toContain("partners-list");
  });

  it("leaves unrelated children untouched", () => {
    const other = [{ id: "sales" }, { id: "hrms" }];
    expect(filterShipDarkChildren(other, false)).toEqual(other);
  });
});
