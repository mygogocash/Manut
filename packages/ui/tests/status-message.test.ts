import { describe, expect, it } from "vitest";

import { statusAccessibilityRole, type StatusTone } from "../src/status-tone";

describe("statusAccessibilityRole", () => {
  it("marks error and warning tones as alerts", () => {
    expect(statusAccessibilityRole("error")).toBe("alert");
    expect(statusAccessibilityRole("warning")).toBe("alert");
  });

  it("keeps success, info, and neutral tones polite without an alert role", () => {
    expect(statusAccessibilityRole("success")).toBeUndefined();
    expect(statusAccessibilityRole("info")).toBeUndefined();
    expect(statusAccessibilityRole("neutral")).toBeUndefined();
  });

  it("accepts the full StatusTone contract used by Expo screens", () => {
    const tones: StatusTone[] = [
      "error",
      "success",
      "warning",
      "info",
      "neutral",
    ];
    expect(tones).toHaveLength(5);
  });
});
