import {
  FX_DEFAULT_CURRENCY_CODES,
  ISO_CURRENCIES,
  normaliseCurrencyCode,
} from "@nexora/utils";
import { describe, expect, it } from "vitest";

/*
 * An expense line holds whatever currency was typed, and no rate provider can
 * quote a string that is not an ISO code — so lines filed as "RMB" or "₹" had no
 * rate, converted to nothing, and dropped out of the THB report total. These pin
 * which strings resolve and, more importantly, which deliberately do not.
 */
describe("normaliseCurrencyCode", () => {
  it("maps RMB to the ISO code that prices it", () => {
    expect(normaliseCurrencyCode("RMB")).toBe("CNY");
    expect(normaliseCurrencyCode("rmb")).toBe("CNY");
    expect(normaliseCurrencyCode(" RMB ")).toBe("CNY");
  });

  it("maps offshore CNH to CNY — same currency, different venue", () => {
    expect(normaliseCurrencyCode("CNH")).toBe("CNY");
  });

  it("maps the rupee sign, which belongs to exactly one currency", () => {
    expect(normaliseCurrencyCode("₹")).toBe("INR");
  });

  it("leaves a real ISO code alone", () => {
    expect(normaliseCurrencyCode("CNY")).toBe("CNY");
    expect(normaliseCurrencyCode("inr")).toBe("INR");
    expect(normaliseCurrencyCode("THB")).toBe("THB");
  });

  /*
   * The refusals matter more than the mappings. A wrong guess here does not fail
   * loudly — it prices money at the wrong rate.
   */
  it("refuses the yen sign, which is both CNY and JPY", () => {
    // Mispricing yuan as yen is roughly a twentyfold error, so this stays
    // unresolved and keeps surfacing as a missing rate.
    expect(normaliseCurrencyCode("¥")).toBe("¥");
  });

  it("refuses symbols shared by many currencies", () => {
    expect(normaliseCurrencyCode("$")).toBe("$");
    expect(normaliseCurrencyCode("£")).toBe("£");
    expect(normaliseCurrencyCode("₩")).toBe("₩");
  });

  // ISO gives "Rs" to the Sri Lankan rupee, so the obvious guess is the wrong
  // one — it is not aliased at all rather than aliased to INR.
  it("does not guess Rs as INR", () => {
    expect(normaliseCurrencyCode("Rs")).not.toBe("INR");
  });

  it("resolves symbols that are unique", () => {
    expect(normaliseCurrencyCode("€")).toBe("EUR");
    expect(normaliseCurrencyCode("฿")).toBe("THB");
  });

  it("keeps an unknown value visible as itself for the missing-rate warning", () => {
    expect(normaliseCurrencyCode("WAT")).toBe("WAT");
    expect(normaliseCurrencyCode("")).toBe("");
    expect(normaliseCurrencyCode(null)).toBe("");
    expect(normaliseCurrencyCode(undefined)).toBe("");
  });

  // Whatever an alias resolves to has to be a currency the sync actually pulls,
  // or the alias just moves the missing rate to a different code.
  it("only ever resolves to a code the FX sync fetches", () => {
    const codes = new Set(FX_DEFAULT_CURRENCY_CODES);
    for (const input of ["RMB", "CNH", "₹", "€"]) {
      expect(codes.has(normaliseCurrencyCode(input))).toBe(true);
    }
  });

  it("only ever resolves to a real ISO code", () => {
    const iso = new Set(ISO_CURRENCIES.map((c) => c.code));
    for (const input of ["RMB", "CNH", "₹", "€", "฿"]) {
      expect(iso.has(normaliseCurrencyCode(input))).toBe(true);
    }
  });
});
