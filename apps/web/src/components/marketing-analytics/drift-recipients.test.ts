import { describe, expect, it } from "vitest";

import { parseRecipients } from "@/components/marketing-analytics/drift-recipients";

describe("parseRecipients", () => {
  it("accepts one address per line", () => {
    const r = parseRecipients("a@tbh.com\nb@tbh.com");
    expect(r.valid).toEqual(["a@tbh.com", "b@tbh.com"]);
    expect(r.invalid).toEqual([]);
  });

  it("takes whatever separator the paste happened to use", () => {
    const r = parseRecipients("a@tbh.com, b@tbh.com; c@tbh.com d@tbh.com");
    expect(r.valid).toHaveLength(4);
    expect(r.invalid).toEqual([]);
  });

  it("lower-cases and de-dupes, so the count matches what gets saved", () => {
    const r = parseRecipients("A@TBH.com\na@tbh.com\n  a@tbh.com  ");
    expect(r.valid).toEqual(["a@tbh.com"]);
  });

  it("reports a bad entry instead of dropping it", () => {
    // Silently discarding a typo would save cleanly and leave someone off an
    // alert list they believe they are on.
    const r = parseRecipients("good@tbh.com\nnot-an-email\nalso bad@");
    expect(r.valid).toEqual(["good@tbh.com"]);
    expect(r.invalid).toEqual(["not-an-email", "also", "bad@"]);
  });

  it("reports a bad entry in the casing it was typed", () => {
    const r = parseRecipients("Nope");
    expect(r.invalid).toEqual(["Nope"]);
  });

  it("does not repeat the same bad entry twice", () => {
    const r = parseRecipients("nope\nnope");
    expect(r.invalid).toEqual(["nope"]);
  });

  it("treats empty and whitespace-only as an empty list, not an error", () => {
    // Empty is a real, meaningful save: it turns the email off.
    expect(parseRecipients("")).toEqual({ valid: [], invalid: [] });
    expect(parseRecipients("  \n\n  ")).toEqual({ valid: [], invalid: [] });
  });

  it("keeps plus-tags and subdomains, which stricter patterns reject", () => {
    const r = parseRecipients(
      "ops+drift@thebinaryholdings.com\nx@mail.corp.thebinaryholdings.com",
    );
    expect(r.invalid).toEqual([]);
    expect(r.valid).toHaveLength(2);
  });

  it("tolerates trailing separators from a copied list", () => {
    const r = parseRecipients("a@tbh.com,\nb@tbh.com,\n");
    expect(r.valid).toEqual(["a@tbh.com", "b@tbh.com"]);
    expect(r.invalid).toEqual([]);
  });
});
