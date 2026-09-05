import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// Phase 7F-1 — the SheetContent width cascade.
//
// These assert RESOLUTION, not appearance. `cn` is twMerge(clsx(...)), so the
// class list on the rendered element is the finished answer to "which width
// wins" — computed before any stylesheet is involved, which is why it is
// checkable in jsdom while the resulting pixels are not. The pixel measurements
// are in PHASE_7F1.
//
// The defect this guards: the primitive used to declare its geometry as
// `data-[side=right]:w-3/4` / `data-[side=right]:sm:max-w-sm`. twMerge does not
// recognise those as conflicting with a plain `w-full` / `sm:max-w-xl`, so both
// survived, and `[data-side="right"].w-3\/4` (0,2,0) then out-specified
// `.w-full` (0,1,0). Sixteen consumers silently got 75% width on mobile and
// 384px on every desktop instead of what they declared.

function classesOf(className?: string, side?: "top" | "right" | "bottom" | "left") {
  const { baseElement, unmount } = render(
    <Sheet open>
      <SheetContent className={className} side={side}>
        <SheetTitle>t</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
  const el = baseElement.querySelector('[data-slot="sheet-content"]')!;
  const list = el.className.split(/\s+/).filter(Boolean);
  unmount();
  return list;
}

describe("a consumer's declared width wins", () => {
  it("drops the default width when the consumer declares one", () => {
    const c = classesOf("w-full sm:max-w-xl");
    expect(c).toContain("w-full");
    // The default must be GONE, not merely outranked — that was the bug.
    expect(c).not.toContain("w-3/4");
  });

  it("drops the default max-width when the consumer declares one", () => {
    const c = classesOf("w-full sm:max-w-xl");
    expect(c).toContain("sm:max-w-xl");
    expect(c).not.toContain("sm:max-w-sm");
  });

  it("never re-introduces the old attribute-prefixed geometry", () => {
    // If anyone puts the width back behind a `data-[side=…]:` variant, twMerge
    // stops seeing the conflict and the whole defect returns silently.
    const c = classesOf("w-full sm:max-w-xl");
    expect(c.some((x) => /^data-\[side=/.test(x) && /w-|max-w-/.test(x))).toBe(
      false,
    );
  });

  for (const [decl, kept] of [
    ["sm:max-w-md", "sm:max-w-md"],
    ["sm:max-w-2xl", "sm:max-w-2xl"],
    ["sm:max-w-lg", "sm:max-w-lg"],
  ] as const) {
    it(`honours ${decl}`, () => {
      const c = classesOf(`w-full ${decl}`);
      expect(c).toContain(kept);
      expect(c).not.toContain("sm:max-w-sm");
    });
  }
});

describe("defaults survive where they should", () => {
  it("keeps the primitive width when the consumer declares none", () => {
    // `ui/sidebar` is this case. It must not move.
    const c = classesOf(undefined);
    expect(c).toContain("w-3/4");
    expect(c).toContain("sm:max-w-sm");
  });

  it("keeps the default max-width when only a width is declared", () => {
    const c = classesOf("w-full");
    expect(c).toContain("w-full");
    expect(c).toContain("sm:max-w-sm");
  });

  it("applies the correct side geometry", () => {
    expect(classesOf(undefined, "left")).toEqual(
      expect.arrayContaining(["inset-y-0", "left-0", "h-full", "border-r"]),
    );
    expect(classesOf(undefined, "bottom")).toEqual(
      expect.arrayContaining(["inset-x-0", "bottom-0", "h-auto", "border-t"]),
    );
    // A horizontal sheet must not inherit the vertical sheets' width default.
    expect(classesOf(undefined, "bottom")).not.toContain("w-3/4");
  });
});

describe("a deliberately narrow sheet stays narrow", () => {
  it("does not widen a consumer that asked for less than the default", () => {
    // The fix must not become "make every sheet wider".
    const c = classesOf("w-full sm:max-w-xs");
    expect(c).toContain("sm:max-w-xs");
    expect(c).not.toContain("sm:max-w-sm");
  });
});

describe("the Phase 8 task-detail declaration is unaffected", () => {
  it("keeps its scoped important overrides intact", () => {
    const c = classesOf(
      "w-full max-w-none sm:max-w-[min(1080px,calc(100vw-24px))]! max-lg:w-full!",
    );
    expect(c).toContain("max-lg:w-full!");
    expect(c).toContain("sm:max-w-[min(1080px,calc(100vw-24px))]!");
    expect(c).not.toContain("w-3/4");
  });
});
