import { describe, expect, it } from "vitest";

import { statusAccessibilityRole } from "../src/status-tone";

describe("statusAccessibilityRole", () => {
  it("marks error and warning tones as alerts", () => {
    expect(statusAccessibilityRole("error")).toBe("alert");
    expect(statusAccessibilityRole("warning")).toBe("alert");
  });

  it("keeps success tones polite without an alert role", () => {
    expect(statusAccessibilityRole("success")).toBeUndefined();
  });
});
