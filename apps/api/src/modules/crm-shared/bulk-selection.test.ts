import { describe, expect, it, vi } from "vitest";

import { resolveBulkWhere } from "@/modules/crm-shared/bulk-selection";

interface Filter {
  search?: string;
  businessUnit?: string;
  ownerScope?: string[];
}

/** Stands in for buildOpportunityWhere / buildAccountWhere / buildLeadWhere. */
const buildWhere = (f: Filter) => ({
  ...(f.search ? { name: { contains: f.search } } : {}),
  ...(f.businessUnit === "__none__"
    ? { businessUnits: { isEmpty: true } }
    : f.businessUnit
      ? { businessUnits: { has: f.businessUnit } }
      : {}),
  ...(f.ownerScope ? { ownerId: { in: f.ownerScope } } : {}),
});

const ME = "me";

describe("resolveBulkWhere — ids mode", () => {
  it("targets exactly the ticked rows", () => {
    expect(
      resolveBulkWhere({ ids: ["a", "b"] }, buildWhere, undefined),
    ).toEqual({ id: { in: ["a", "b"] } });
  });

  it("ANDs owner scope, so a foreign id simply matches nothing", () => {
    // Deliberately NOT an error: no partial write, and no signal about
    // whether the foreign id exists.
    expect(
      resolveBulkWhere({ ids: ["mine", "someone-elses"] }, buildWhere, [ME]),
    ).toEqual({ id: { in: ["mine", "someone-elses"] }, ownerId: { in: [ME] } });
  });

  it("an empty selection matches nothing rather than everything", () => {
    // The dangerous failure mode: `{}` would be "every row in the table".
    expect(resolveBulkWhere({ ids: [] }, buildWhere, undefined)).toEqual({
      id: { in: [] },
    });
  });

  it("a missing ids array still matches nothing", () => {
    expect(resolveBulkWhere({}, buildWhere, undefined)).toEqual({
      id: { in: [] },
    });
  });

  it("does not consult the where-builder at all", () => {
    const spy = vi.fn(buildWhere);
    resolveBulkWhere({ ids: ["a"] }, spy, undefined);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("resolveBulkWhere — allMatching mode", () => {
  it("resolves through the list's own where-builder", () => {
    // This is the invariant: same predicate as the page, so "select all N
    // matching" cannot act on a different N.
    const spy = vi.fn(buildWhere);
    resolveBulkWhere(
      { allMatching: true, filter: { search: "telecom" } },
      spy,
      undefined,
    );
    expect(spy).toHaveBeenCalledWith({
      search: "telecom",
      ownerScope: undefined,
    });
  });

  it("carries the Unassigned sentinel through untouched", () => {
    expect(
      resolveBulkWhere(
        { allMatching: true, filter: { businessUnit: "__none__" } },
        buildWhere,
        undefined,
      ),
    ).toEqual({ businessUnits: { isEmpty: true } });
  });

  it("ANDs owner scope here too", () => {
    expect(
      resolveBulkWhere(
        { allMatching: true, filter: { businessUnit: "onewave" } },
        buildWhere,
        [ME],
      ),
    ).toEqual({
      businessUnits: { has: "onewave" },
      ownerId: { in: [ME] },
    });
  });

  it("an absent filter means the unfiltered list, still owner-scoped", () => {
    expect(resolveBulkWhere({ allMatching: true }, buildWhere, [ME])).toEqual({
      ownerId: { in: [ME] },
    });
  });

  it("ignores ids when allMatching is set", () => {
    const where = resolveBulkWhere(
      { allMatching: true, ids: ["stale"], filter: {} },
      buildWhere,
      undefined,
    );
    expect(where).not.toHaveProperty("id");
  });
});
