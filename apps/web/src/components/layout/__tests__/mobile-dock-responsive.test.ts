import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const DOCK = "components/layout/mobile-dock.tsx";
const LAYOUT = "app/(dashboard)/layout.tsx";

describe("the dock does not cover content", () => {
  it("reserves bottom space on main below md", () => {
    // A fixed bar over a scroll container hides the last row of every table
    // until the user scrolls past the end, which reads as missing data rather
    // than as a layout bug.
    expect(read(LAYOUT)).toMatch(/pb-16\s+md:pb-0/);
  });

  it("is mounted inside the dashboard shell", () => {
    expect(read(LAYOUT)).toMatch(/<MobileDock\s*\/>/);
  });
});

describe("the dock is phone-only and respects the safe area", () => {
  const source = read(DOCK);

  it("hides from md up, where the sidebar is permanent", () => {
    // Rendering both would give two primary navigations at once.
    expect(source).toMatch(/md:hidden/);
  });

  it("clears the iOS home indicator", () => {
    // pb-safe wraps env(safe-area-inset-bottom); without it the last slot sits
    // under the gesture bar on any notched device.
    expect(source).toMatch(/pb-safe/);
  });

  it("opens the existing sheet rather than a second drawer", () => {
    expect(source).toMatch(/setOpenMobile\(true\)/);
  });

  it("renders the bell itself, so the badge cannot diverge", () => {
    expect(source).toMatch(/<NotificationBell\s+variant="dock"\s*\/>/);
  });
});
