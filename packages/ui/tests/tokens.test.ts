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

  it("exposes info and neutral status palette tokens for StatusMessage tones", () => {
    expect(colors.infoBorder).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colors.infoBackground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colors.infoText).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colors.neutralBorder).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colors.neutralBackground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colors.neutralText).toMatch(/^#[0-9a-f]{6}$/i);
    expect(
      contrastRatio(colors.infoText, colors.infoBackground),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(colors.neutralText, colors.neutralBackground),
    ).toBeGreaterThanOrEqual(4.5);
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
