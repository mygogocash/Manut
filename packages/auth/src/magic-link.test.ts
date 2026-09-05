import { describe, expect, it } from "vitest";
import { isMagicLinkEligible } from "./magic-link";

describe("isMagicLinkEligible", () => {
  it("allows System Admin even when the allow-list is empty", () => {
    expect(isMagicLinkEligible([{ name: "Admin", isSystem: true }], [])).toBe(true);
  });

  it("denies everyone else when the allow-list is empty", () => {
    expect(isMagicLinkEligible([{ name: "IT", isSystem: false }], [])).toBe(false);
  });

  it("allows a user holding an allow-listed role", () => {
    expect(isMagicLinkEligible([{ name: "IT", isSystem: false }], ["IT"])).toBe(true);
  });

  it("denies a custom Admin role (isSystem=false)", () => {
    expect(isMagicLinkEligible([{ name: "Admin", isSystem: false }], ["IT"])).toBe(false);
  });

  it("denies a user with no matching role", () => {
    expect(isMagicLinkEligible([{ name: "HR", isSystem: false }], ["IT"])).toBe(false);
  });
});
