import { describe, expect, it } from "vitest";

import {
  collectTagCodes,
  investorIdentity,
  investorMatchKey,
  labelForTagCode,
  normaliseLinkedIn,
  planImport,
  sparseInvestorUpdate,
} from "@/modules/investors/investor-import";

describe("investorMatchKey", () => {
  it("scopes the name to the fundraising entity", () => {
    // The same fund under two vehicles is TWO records, not a duplicate —
    // keying on name alone would let a TBH import overwrite the TBL row.
    expect(investorMatchKey("Jungle Ventures", "tbh")).not.toBe(
      investorMatchKey("Jungle Ventures", "tbl"),
    );
  });

  it("ignores case and inner whitespace, which a sheet is careless about", () => {
    expect(investorMatchKey("Jungle  Ventures", "tbh")).toBe(
      investorMatchKey("jungle ventures", "TBH"),
    );
    expect(investorMatchKey("  Gobi Partners ", "tbh")).toBe(
      investorMatchKey("Gobi Partners", "tbh"),
    );
  });

  it("is null without both halves, so an unmatched row cannot masquerade", () => {
    expect(investorMatchKey("", "tbh")).toBeNull();
    expect(investorMatchKey("Jungle Ventures", "")).toBeNull();
    expect(investorMatchKey(null, null)).toBeNull();
  });
});

describe("sparseInvestorUpdate", () => {
  it("drops the fields the sheet has no opinion about", () => {
    // A decision-maker sheet knows a name and a contact. It knows nothing about
    // the pipeline stage or the amounts, and must not erase them.
    const out = sparseInvestorUpdate({
      name: "Jungle Ventures",
      contactName: "Manpreet Ratia",
      status: null,
      estInvestment: undefined,
      notesText: "",
      region: "Singapore",
    });
    expect(out).toEqual({
      name: "Jungle Ventures",
      contactName: "Manpreet Ratia",
      region: "Singapore",
    });
    expect(out).not.toHaveProperty("status");
    expect(out).not.toHaveProperty("estInvestment");
    expect(out).not.toHaveProperty("notesText");
  });

  it("never moves a record between fundraising entities", () => {
    // fundraisingEntity is half the match key; a match already agrees on it,
    // and writing it would let a mis-keyed row relocate a record.
    const out = sparseInvestorUpdate({
      name: "Gobi Partners",
      fundraisingEntity: "tbl",
    });
    expect(out).not.toHaveProperty("fundraisingEntity");
  });

  it("MERGES tags rather than replacing them", () => {
    // Two sheets legitimately tag the same firm. Replacing would make the
    // second import strip the first one's tag.
    const out = sparseInvestorUpdate(
      { name: "Jungle Ventures", tags: ["jungle-ventures"] },
      ["seed-investors", "pre-seed"],
    );
    expect(out.tags).toEqual(["jungle-ventures", "pre-seed", "seed-investors"]);
  });

  it("leaves existing tags untouched when the row carries none", () => {
    const out = sparseInvestorUpdate({ name: "Gobi Partners" }, ["pre-seed"]);
    expect(out).not.toHaveProperty("tags");
  });

  it("does not duplicate a tag the record already has", () => {
    const out = sparseInvestorUpdate({ name: "X", tags: ["pre-seed"] }, [
      "pre-seed",
    ]);
    expect(out.tags).toEqual(["pre-seed"]);
  });
});

describe("planImport", () => {
  // Keys go through `investorIdentity`, which prefixes the tier — a raw
  // `investorMatchKey` value is no longer what planImport looks up.
  const existing = new Map([
    [
      investorIdentity({ name: "Jungle Ventures", fundraisingEntity: "tbh" })!
        .key,
      "inv-jungle",
    ],
    [
      investorIdentity({ name: "Gobi Partners", fundraisingEntity: "tbl" })!
        .key,
      "inv-gobi-tbl",
    ],
  ]);

  it("updates a row that already exists under that entity", () => {
    const [plan] = planImport(
      [{ name: "Jungle Ventures", fundraisingEntity: "tbh" }],
      existing,
    );
    expect(plan).toEqual(
      expect.objectContaining({ action: "update", matchedId: "inv-jungle" }),
    );
  });

  it("inserts the same fund under a DIFFERENT entity", () => {
    const [plan] = planImport(
      [{ name: "Jungle Ventures", fundraisingEntity: "tbl" }],
      existing,
    );
    expect(plan.action).toBe("insert");
    expect(plan.matchedId).toBeNull();
  });

  it("inserts when nothing matches", () => {
    const [plan] = planImport(
      [{ name: "Insignia Ventures", fundraisingEntity: "tbh" }],
      existing,
    );
    expect(plan.action).toBe("insert");
  });

  it("reports a duplicate inside one file instead of applying both to one record", () => {
    const plans = planImport(
      [
        { name: "Jungle Ventures", fundraisingEntity: "tbh" },
        { name: "jungle  ventures", fundraisingEntity: "TBH" },
      ],
      existing,
    );
    expect(plans[0]?.action).toBe("update");
    expect(plans[0]?.errors).toEqual([]);
    expect(plans[1]?.errors[0]).toContain("Duplicate of an earlier row");
    // The second must not also claim the match.
    expect(plans[1]?.matchedId).toBeNull();
  });

  it("errors a row that cannot be keyed at all, rather than silently skipping", () => {
    // The old importer swallowed every failure into a bare count.
    const [plan] = planImport(
      [{ name: "", fundraisingEntity: "tbh" }],
      existing,
    );
    expect(plan.errors[0]).toContain("cannot be matched");
  });

  it("numbers rows 1-based so they match the sheet", () => {
    const plans = planImport(
      [
        { name: "A", fundraisingEntity: "tbh" },
        { name: "B", fundraisingEntity: "tbh" },
      ],
      existing,
    );
    expect(plans.map((p) => p.row)).toEqual([1, 2]);
  });
});

describe("tag catalog helpers", () => {
  it("collects distinct codes across the payload", () => {
    expect(
      collectTagCodes([
        { tags: ["jungle-ventures", "seed-investors"] },
        { tags: ["jungle-ventures"] },
        { tags: [" gobi-partners "] },
        {},
      ]),
    ).toEqual(["gobi-partners", "jungle-ventures", "seed-investors"]);
  });

  it("prettifies a code into a label, so the filter is not a slug", () => {
    expect(labelForTagCode("golden-gate-ventures")).toBe(
      "Golden Gate Ventures",
    );
    expect(labelForTagCode("seed-investors")).toBe("Seed Investors");
    // A numeric segment stays as-is — "1982 Ventures", not "1982 ventures".
    expect(labelForTagCode("1982-ventures")).toBe("1982 Ventures");
  });
});

describe("LinkedIn as the primary identity", () => {
  // Found by running the real Expandi lead list against the merged importer:
  // 10 Jungle leads all sit at "Jungle Ventures", so keying on (name, entity)
  // made 9 of them look like duplicates — 1 insert, 9 skips. Across the 67-lead
  // file that would have loaded ~11 records and silently dropped 56.
  it("keeps many leads at ONE company as separate rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: "Jungle Ventures",
      fundraisingEntity: "tbh",
      linkedinUrl: `https://sg.linkedin.com/in/person-${i}`,
    }));
    const plans = planImport(rows, new Map());
    expect(plans.filter((p) => p.errors.length === 0)).toHaveLength(10);
  });

  it("treats the same person as one, across country subdomains", () => {
    // The sheet mixes sg./hk./vn./www. for the same profile.
    expect(normaliseLinkedIn("https://sg.linkedin.com/in/yinglantan")).toBe(
      normaliseLinkedIn("https://www.linkedin.com/in/yinglantan/"),
    );
    expect(normaliseLinkedIn("http://hk.linkedin.com/in/Chibotang?trk=x")).toBe(
      "linkedin.com/in/chibotang",
    );
  });

  it("refuses a search URL as an identity", () => {
    // Several placeholder rows share one search link; treating it as an
    // identity would merge unrelated people into a single record.
    expect(
      normaliseLinkedIn(
        "https://www.linkedin.com/search/results/people/?keywords=David%20Chang",
      ),
    ).toBeNull();
  });

  it("still catches a genuine duplicate person inside one file", () => {
    const plans = planImport(
      [
        {
          name: "Wavemaker",
          fundraisingEntity: "tbh",
          linkedinUrl: "https://sg.linkedin.com/in/b-paul-santos-b18a052",
        },
        {
          name: "Wavemaker",
          fundraisingEntity: "tbh",
          linkedinUrl: "https://www.linkedin.com/in/b-paul-santos-b18a052/",
        },
      ],
      new Map(),
    );
    expect(plans[0]?.errors).toEqual([]);
    expect(plans[1]?.errors[0]).toContain("Duplicate LinkedIn profile");
  });

  it("matches an existing record by LinkedIn even when the name differs", () => {
    // A firm renamed, or the sheet writing the person's name where the record
    // holds the company — the profile still identifies the same record.
    const existing = new Map([
      [
        investorIdentity({ linkedinUrl: "https://linkedin.com/in/yinglantan" })!
          .key,
        "inv-1",
      ],
    ]);
    const [plan] = planImport(
      [
        {
          name: "Insignia Ventures Partners",
          fundraisingEntity: "tbh",
          linkedinUrl: "https://sg.linkedin.com/in/yinglantan",
        },
      ],
      existing,
    );
    expect(plan).toEqual(
      expect.objectContaining({ action: "update", matchedId: "inv-1" }),
    );
  });

  it("falls back to (name, entity) when a row has no profile", () => {
    const existing = new Map([
      [
        investorIdentity({ name: "Gobi Partners", fundraisingEntity: "tbh" })!
          .key,
        "inv-gobi",
      ],
    ]);
    const [plan] = planImport(
      [{ name: "Gobi Partners", fundraisingEntity: "tbh" }],
      existing,
    );
    expect(plan.action).toBe("update");
    expect(plan.matchedId).toBe("inv-gobi");
  });
});
