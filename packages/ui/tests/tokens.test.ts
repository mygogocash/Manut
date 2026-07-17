import { describe, expect, it } from "vitest";

import { colors, radii, spacing } from "../src/tokens";

function relativeLuminance(hex: string): number {
  const channels = hex
    .match(/[a-f\d]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Expected RGB channels for ${hex}`);
  }
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("tokens", () => {
  it("exposes the shared Manut surface palette used by foundation screens", () => {
    expect(colors.canvas).toBe("#f7f4ed");
    expect(colors.surface).toBe("#fffdf8");
    expect(colors.accent).toBe("#785f37");
    expect(colors.textMuted).toBe("#665f52");
    expect(radii.card).toBe(18);
    expect(spacing.xxl).toBe(24);
  });

  it("keeps interactive control boundaries at three-to-one contrast", () => {
    expect(
      contrastRatio(colors.borderStrong, colors.surface),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(colors.borderStrong, colors.surfaceRaised),
    ).toBeGreaterThanOrEqual(3);
  });
});
