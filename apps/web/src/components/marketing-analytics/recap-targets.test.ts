import { describe, expect, it } from "vitest";

import {
  configuredCount,
  draftsToTargets,
  formatNumberField,
  orphanedTargets,
  parseNumberField,
  type RecapTargetDraft,
  seedDrafts,
} from "@/components/marketing-analytics/recap-targets";
import type { RecapTarget } from "@/services/marketing-recap.service";

const ACCOUNTS = [
  { key: "gopay", label: "GoPay" },
  { key: "telkomsel", label: "Telkomsel" },
  { key: "okara", label: "Okara" },
];

const draft = (over: Partial<RecapTargetDraft> = {}): RecapTargetDraft => ({
  partnerId: "gopay",
  label: "GoPay",
  addressableMau: "",
  targetDau: "",
  excluded: false,
  ...over,
});

describe("parseNumberField", () => {
  // Blank and zero are different answers: blank renders as an em dash, zero is
  // a figure someone typed.
  it("reads a blank field as not configured, not as zero", () => {
    expect(parseNumberField("")).toEqual({ value: null, error: null });
    expect(parseNumberField("   ")).toEqual({ value: null, error: null });
  });

  it("reads a typed zero as zero", () => {
    expect(parseNumberField("0")).toEqual({ value: 0, error: null });
  });

  // These figures are millions-scale and get pasted out of the deck.
  it("accepts thousands separators from a paste", () => {
    expect(parseNumberField("10,800,000").value).toBe(10_800_000);
    expect(parseNumberField("10 800 000").value).toBe(10_800_000);
  });

  it("rounds a fractional figure — a fractional person is not a thing", () => {
    expect(parseNumberField("1234.6").value).toBe(1235);
  });

  // Coercing "10.8M" to 10.8 would save successfully and put a nonsense figure
  // in front of management.
  it("reports text it cannot read rather than coercing it", () => {
    expect(parseNumberField("10.8M").error).toMatch(/not a number/);
    expect(parseNumberField("10.8M").value).toBeNull();
    expect(parseNumberField("abc").error).toMatch(/not a number/);
  });

  it("rejects a negative figure, which the API would refuse anyway", () => {
    expect(parseNumberField("-5").error).toMatch(/not a number/);
  });
});

describe("formatNumberField", () => {
  it("round-trips through parseNumberField", () => {
    expect(formatNumberField(null)).toBe("");
    expect(formatNumberField(0)).toBe("0");
    expect(parseNumberField(formatNumberField(10_800_000)).value).toBe(
      10_800_000,
    );
  });
});

describe("seedDrafts", () => {
  it("gives every telco a row, in payload order, carrying what is stored", () => {
    const stored: RecapTarget[] = [
      {
        partnerId: "telkomsel",
        addressableMau: 10_800_000,
        targetDau: 5_000,
        excluded: false,
      },
    ];
    const drafts = seedDrafts({ accounts: ACCOUNTS, stored });
    expect(drafts.map((d) => d.partnerId)).toEqual([
      "gopay",
      "telkomsel",
      "okara",
    ]);
    expect(drafts[1]).toMatchObject({
      label: "Telkomsel",
      addressableMau: "10800000",
      targetDau: "5000",
      excluded: false,
    });
    // A telco with nothing stored still gets an editable row.
    expect(drafts[0]).toMatchObject({ addressableMau: "", targetDau: "" });
  });

  // Nothing dedupes partnerIds on the way in, and the recap table reads its own
  // figures with `.find`, so the editor has to agree with it on which duplicate
  // wins or it would edit a value the table is not showing.
  it("takes the first of duplicate stored rows, matching the table's lookup", () => {
    const drafts = seedDrafts({
      accounts: ACCOUNTS,
      stored: [
        {
          partnerId: "gopay",
          addressableMau: 111,
          targetDau: null,
          excluded: false,
        },
        {
          partnerId: "gopay",
          addressableMau: 222,
          targetDau: null,
          excluded: false,
        },
      ],
    });
    expect(drafts.find((d) => d.partnerId === "gopay")?.addressableMau).toBe(
      "111",
    );
    // And saving normalises the duplicate away.
    expect(
      draftsToTargets(drafts).targets.filter((t) => t.partnerId === "gopay"),
    ).toHaveLength(1);
  });

  it("carries the excluded flag through", () => {
    const drafts = seedDrafts({
      accounts: ACCOUNTS,
      stored: [
        {
          partnerId: "okara",
          addressableMau: null,
          targetDau: null,
          excluded: true,
        },
      ],
    });
    expect(drafts.find((d) => d.partnerId === "okara")?.excluded).toBe(true);
  });
});

describe("orphanedTargets", () => {
  // Because the PUT replaces the whole array, a stored row for a partner the
  // payload no longer mentions would be destroyed by an unrelated edit.
  it("finds stored rows whose partner is absent from the payload", () => {
    const stored: RecapTarget[] = [
      {
        partnerId: "gopay",
        addressableMau: 1,
        targetDau: null,
        excluded: false,
      },
      {
        partnerId: "retired-telco",
        addressableMau: 999,
        targetDau: 9,
        excluded: false,
      },
    ];
    expect(orphanedTargets(ACCOUNTS, stored)).toEqual([
      {
        partnerId: "retired-telco",
        addressableMau: 999,
        targetDau: 9,
        excluded: false,
      },
    ]);
  });

  it("finds nothing when every stored row is known", () => {
    expect(
      orphanedTargets(ACCOUNTS, [
        {
          partnerId: "gopay",
          addressableMau: 1,
          targetDau: null,
          excluded: false,
        },
      ]),
    ).toEqual([]);
  });
});

describe("draftsToTargets", () => {
  // The guarantee that matters against the whole-array replace: editing one
  // telco must carry every OTHER telco's stored figures back out untouched.
  it("carries every telco that holds something, so a save cannot wipe the rest", () => {
    const stored: RecapTarget[] = [
      {
        partnerId: "telkomsel",
        addressableMau: 10_800_000,
        targetDau: 5_000,
        excluded: false,
      },
      {
        partnerId: "okara",
        addressableMau: null,
        targetDau: null,
        excluded: true,
      },
    ];
    // Someone opens the editor and types a figure for GoPay only.
    const drafts = seedDrafts({ accounts: ACCOUNTS, stored });
    const edited = drafts.map((d) =>
      d.partnerId === "gopay" ? { ...d, addressableMau: "1000" } : d,
    );
    const { targets, valid } = draftsToTargets(edited);
    expect(valid).toBe(true);
    expect(targets).toEqual([
      {
        partnerId: "gopay",
        addressableMau: 1000,
        targetDau: null,
        excluded: false,
      },
      {
        partnerId: "telkomsel",
        addressableMau: 10_800_000,
        targetDau: 5_000,
        excluded: false,
      },
      {
        partnerId: "okara",
        addressableMau: null,
        targetDau: null,
        excluded: true,
      },
    ]);
  });

  /*
   * An all-blank row and no row at all are the same thing to every reader of
   * this data, but writing one is not harmless: the recap decides whether to
   * show its "nothing set yet" note by testing whether the stored array is
   * empty, so emitting a null row per telco would retire that note forever —
   * including right after an admin cleared every figure.
   */
  it("drops a row carrying nothing, so clearing everything reads as empty", () => {
    const { targets } = draftsToTargets([
      draft({ partnerId: "gopay" }),
      draft({ partnerId: "telkomsel", label: "Telkomsel" }),
    ]);
    expect(targets).toEqual([]);
  });

  it("keeps a blank row that is excluded — that is a real answer", () => {
    const { targets } = draftsToTargets([draft({ excluded: true })]);
    expect(targets).toEqual([
      {
        partnerId: "gopay",
        addressableMau: null,
        targetDau: null,
        excluded: true,
      },
    ]);
  });

  it("keeps a row holding only a target DAU", () => {
    const { targets } = draftsToTargets([draft({ targetDau: "500" })]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.targetDau).toBe(500);
  });

  it("keeps a zero — it is a figure someone typed, not a blank", () => {
    const { targets } = draftsToTargets([draft({ addressableMau: "0" })]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.addressableMau).toBe(0);
  });

  it("appends orphaned stored rows untouched", () => {
    const orphan: RecapTarget = {
      partnerId: "retired-telco",
      addressableMau: 999,
      targetDau: 9,
      excluded: false,
    };
    const { targets } = draftsToTargets(
      [draft({ addressableMau: "1000" })],
      [orphan],
    );
    expect(targets).toHaveLength(2);
    expect(targets[1]).toEqual(orphan);

    // And it survives even when every drafted row drops out, which is the case
    // that would otherwise delete it: clearing all the visible figures.
    expect(draftsToTargets([draft()], [orphan]).targets).toEqual([orphan]);
  });

  it("reports field-level errors and refuses to be valid", () => {
    const { errors, valid } = draftsToTargets([
      draft({ addressableMau: "10.8M", targetDau: "oops" }),
    ]);
    expect(valid).toBe(false);
    expect(errors["gopay.addressableMau"]).toMatch(/not a number/);
    expect(errors["gopay.targetDau"]).toMatch(/not a number/);
  });

  it("keeps zero as zero on the way out", () => {
    const { targets } = draftsToTargets([draft({ addressableMau: "0" })]);
    expect(targets[0]?.addressableMau).toBe(0);
  });
});

describe("configuredCount", () => {
  it("counts telcos with an addressable MAU, zero included", () => {
    expect(
      configuredCount([
        draft({ partnerId: "a", addressableMau: "100" }),
        draft({ partnerId: "b", addressableMau: "0" }),
        draft({ partnerId: "c", addressableMau: "" }),
      ]),
    ).toBe(2);
  });
});
