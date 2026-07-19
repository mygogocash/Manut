import { describe, expect, it } from "vitest";

import { resolveButtonLabel } from "../src/button-label";

describe("resolveButtonLabel", () => {
  it("Button > given idle state > then uses label", () => {
    expect(
      resolveButtonLabel({
        label: "Save",
        pending: false,
      }),
    ).toBe("Save");
  });

  it("Button > given pending without pendingLabel > then falls back to label", () => {
    expect(
      resolveButtonLabel({
        label: "Save",
        pending: true,
      }),
    ).toBe("Save");
  });

  it("Button > given pending with pendingLabel > then uses pendingLabel", () => {
    expect(
      resolveButtonLabel({
        label: "Save",
        pendingLabel: "Saving…",
        pending: true,
      }),
    ).toBe("Saving…");
  });
});
