import { describe, expect, it } from "vitest";

import { INVESTOR_TAG_UNTAGGED } from "@/modules/investor-tags/investor-tags.validation";
import { buildInvestorWhere } from "@/modules/investors/investors.repository";

/**
 * The tag facet on `buildInvestorWhere`.
 *
 * This builder is shared by the list, the "select all matching" bulk path and
 * the pipeline totals — so a bug here means a bulk action hits rows the list
 * never showed. That shared-ness is exactly why the facet is tested at the
 * builder rather than through any one caller.
 */

describe("tag facet", () => {
  it("matches investors carrying the code", () => {
    expect(buildInvestorWhere({ tag: "seed-checks" }).tags).toEqual({
      has: "seed-checks",
    });
  });

  it("maps the untagged sentinel to isEmpty, not to a code match", () => {
    // `__none__` is a reserved filter value, never a real tag. Treated as a
    // code it would match nothing and silently return an empty list instead
    // of the untagged rows the user asked for.
    expect(buildInvestorWhere({ tag: INVESTOR_TAG_UNTAGGED }).tags).toEqual({
      isEmpty: true,
    });
  });

  it("leaves tags unconstrained when no tag is given", () => {
    expect(buildInvestorWhere({}).tags).toBeUndefined();
    expect(buildInvestorWhere({ tag: "" }).tags).toBeUndefined();
  });

  it("composes with the other facets rather than replacing them", () => {
    // The bulk path spreads a whole filter object in, so the tag must AND
    // with entity/archived scoping — not clobber it.
    const where = buildInvestorWhere({
      tag: "seed-checks",
      fundraisingEntity: "tbl",
      status: "lead",
      archived: false,
    });

    expect(where).toMatchObject({
      tags: { has: "seed-checks" },
      fundraisingEntity: "tbl",
      status: "lead",
      archivedAt: null,
    });
  });

  it("keeps the sentinel unable to collide with a real code", () => {
    // Codes are validated `^[a-z][a-z0-9-]*$` — no underscores — so no tag an
    // admin creates can ever equal the sentinel. If that regex is ever
    // relaxed to allow underscores, this is the test that should stop it.
    expect(INVESTOR_TAG_UNTAGGED).toBe("__none__");
    expect(/^[a-z][a-z0-9-]*$/.test(INVESTOR_TAG_UNTAGGED)).toBe(false);
  });
});
