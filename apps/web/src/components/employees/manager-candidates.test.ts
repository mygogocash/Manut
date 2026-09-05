import { describe, expect, it } from "vitest";

import {
  mergeManagerCandidates,
  seedManagerCandidates,
} from "@/components/employees/manager-candidates";

const sarah = { id: "mgr-1", name: "Prapawarin Intarapromma (Sarah)" };
const self = { id: "self-1", name: "Employee Themself" };

describe("seedManagerCandidates — what renders when the fetch fails", () => {
  // Regression: a transient listUsers failure used to reset the candidate
  // list to [], so a SET manager rendered as the "Select manager"
  // placeholder — indistinguishable from a wiped field. The seed is what
  // the dropdown holds through (and after) a failed fetch: the bound
  // manager must survive it.
  it("keeps the bound manager renderable with no fetched list at all", () => {
    expect(seedManagerCandidates(sarah, self.id)).toEqual([sarah]);
  });

  it("is empty in create mode (no bound manager)", () => {
    expect(seedManagerCandidates(null, undefined)).toEqual([]);
    expect(seedManagerCandidates(undefined, "someone")).toEqual([]);
  });

  it("never offers the employee as their own manager", () => {
    expect(seedManagerCandidates(self, self.id)).toEqual([]);
  });
});

describe("mergeManagerCandidates — the fetch success path", () => {
  const listed = [
    { id: "u-1", name: "Alice" },
    { id: "mgr-1", name: "Prapawarin Intarapromma (Sarah)" },
    { id: "self-1", name: "Employee Themself" },
  ];

  it("filters self out of the fetched list", () => {
    const result = mergeManagerCandidates(listed, sarah, self.id);
    expect(result.some((c) => c.id === self.id)).toBe(false);
  });

  it("does not duplicate a bound manager already in the list", () => {
    const result = mergeManagerCandidates(listed, sarah, self.id);
    expect(result.filter((c) => c.id === sarah.id)).toHaveLength(1);
  });

  it("unshifts a bound manager the fetch missed (inactive / past the cap)", () => {
    const inactive = { id: "mgr-9", name: "Departed Manager" };
    const result = mergeManagerCandidates(listed, inactive, self.id);
    expect(result[0]).toEqual(inactive);
  });

  it("keeps the bound manager when the fetch returns an empty page", () => {
    expect(mergeManagerCandidates([], sarah, self.id)).toEqual([sarah]);
  });
});
