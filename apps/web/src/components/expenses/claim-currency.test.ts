import { describe, expect, it } from "vitest";

import {
  claimCurrencyOptions,
  defaultClaimCurrency,
} from "@/components/expenses/claim-currency";

const codes = (entityCurrency?: string | null) =>
  claimCurrencyOptions(entityCurrency).map((c) => c.code);

describe("claimCurrencyOptions", () => {
  it("offers INR — the reported bug was that it could not be selected", () => {
    expect(codes("INR")).toContain("INR");
    expect(codes("THB")).toContain("INR");
  });

  it("offers THB, the reporting currency the old list also omitted", () => {
    expect(codes("INR")).toContain("THB");
  });

  it("puts the submitter's own entity currency first", () => {
    expect(codes("INR")[0]).toBe("INR");
    expect(codes("IDR")[0]).toBe("IDR");
  });

  it("puts THB second when it is not the entity currency", () => {
    expect(codes("INR")[1]).toBe("THB");
  });

  it("does not repeat the entity currency further down the list", () => {
    const list = codes("INR");
    expect(list.filter((c) => c === "INR")).toHaveLength(1);
  });

  it("does not repeat THB when it is the entity currency", () => {
    const list = codes("THB");
    expect(list[0]).toBe("THB");
    expect(list.filter((c) => c === "THB")).toHaveLength(1);
  });

  it("still offers an entity currency the FX sync cannot convert", () => {
    // Blocking the entity entirely is worse than one unconvertible line.
    expect(codes("VND")[0]).toBe("VND");
  });

  it("carries the ISO name so the dropdown is readable", () => {
    const inr = claimCurrencyOptions("INR").find((c) => c.code === "INR");
    expect(inr?.name).toBe("Indian Rupee");
  });

  it("falls back to a bare code for a currency ISO does not list", () => {
    const opt = claimCurrencyOptions("ZZZ").find((c) => c.code === "ZZZ");
    expect(opt).toEqual({ code: "ZZZ", name: "ZZZ" });
  });

  it("normalises casing and whitespace from the entity record", () => {
    expect(codes("  inr  ")[0]).toBe("INR");
  });

  it("works with no entity selected yet", () => {
    const list = codes(undefined);
    expect(list[0]).toBe("THB");
    expect(list).toContain("INR");
  });

  it("includes AED, which real rows already use", () => {
    expect(codes("THB")).toContain("AED");
  });
});

describe("defaultClaimCurrency", () => {
  it("starts on the submitter's entity currency", () => {
    expect(defaultClaimCurrency("INR")).toBe("INR");
  });

  it("falls back to the reporting currency, never a foreign default", () => {
    // The old form defaulted to AED, which had no FX rate at all.
    expect(defaultClaimCurrency(undefined)).toBe("THB");
    expect(defaultClaimCurrency("")).toBe("THB");
    expect(defaultClaimCurrency("   ")).toBe("THB");
    expect(defaultClaimCurrency(null)).not.toBe("AED");
  });

  it("normalises casing", () => {
    expect(defaultClaimCurrency("inr")).toBe("INR");
  });
});
