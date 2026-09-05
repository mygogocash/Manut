import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Phase 10B — the three measured defects on the investors pipeline surface.
//
// The board itself needed nothing. It is a `flex gap-3 overflow-x-auto` rail of
// 260px columns, and at every width from 320 to 1920 it measured: page overflow
// 0, uncontained 0, clipped 0, with the estimated investment, owner and last
// contact all visible. The Sales/Project status-tab pattern was NOT applied —
// it would have replaced a working board.
//
// What was actually broken, all three measured on WebKit before the change:
//
//   1. The column body was `max-h-[calc(100vh-360px)]`. The 360px subtrahend
//      assumes a tall desktop viewport, so on a phone in LANDSCAPE (667x375) it
//      resolved to 15px — a sliver of a ~90px card. 844x390 gave 30px. Both
//      sibling kanbans use `60vh`, which scales.
//
//   2. The PageHeader action row was `flex items-center gap-2` with no wrap,
//      holding three buttons. It also defeated PageHeader's own `flex-wrap` by
//      being its single child. Measured 12px of PAGE overflow at 320px, with the
//      "Add investor" button reaching x=332 in a 320px viewport.
//
//   3. The seven-tab strip wrapped to three rows inside a fixed 32px box.
//      Measured `scrollHeight > clientHeight` at 320/375/390/430.
//
// Fix 3 took two attempts, and the first one is why this file asserts the
// variant rather than just the utility: `TabsList`'s height is
// `group-data-[orientation=horizontal]/tabs:h-8`, and twMerge only dedupes
// classes carrying the SAME variant. A bare `h-auto` did not conflict, both
// classes applied, and the strip stayed 32px — the measurement was unchanged and
// looked like the fix had not landed. The override has to carry the variant too.

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const KANBAN = "components/investors/investor-pipeline-kanban.tsx";
const PAGE = "app/(dashboard)/investors/page.tsx";

describe("the pipeline column survives a short viewport", () => {
  const source = read(KANBAN);

  it("does not size the column body by subtracting fixed pixels from the viewport", () => {
    expect(
      /max-h-\[calc\(100vh-\d+px\)\]/.test(source),
      "the column body is back on a `calc(100vh - Npx)` height. That collapses " +
        "on short viewports — measured 15px at 667x375, a phone in landscape. " +
        "Use a proportional height (the sibling kanbans use 60vh).",
    ).toBe(false);
  });

  it("uses a viewport-proportional max height", () => {
    expect(source).toMatch(/max-h-\[\d+vh\]/);
  });

  it("keeps the column body scrollable", () => {
    // The height cap only works if what overflows can still be reached.
    expect(source).toMatch(/max-h-\[\d+vh\][\s\S]{0,80}?overflow-y-auto/);
  });
});

describe("the investors page chrome fits a phone", () => {
  const source = read(PAGE);

  it("lets the PageHeader action row wrap", () => {
    // PageHeader's own slot is `flex-wrap`, but this div is its single child, so
    // the wrap opportunity is neutralised unless the child wraps too.
    const actions = /<PageHeader[\s\S]{0,400}?<div className="([^"]*)">/.exec(source);
    expect(actions, "the PageHeader action row is gone").not.toBeNull();
    expect(
      actions?.[1],
      "the PageHeader action row cannot wrap: measured 12px of page overflow " +
        "at 320px, with the Add investor button reaching x=332.",
    ).toContain("flex-wrap");
  });

  it("lets the tab strip grow when its seven tabs wrap", () => {
    const list = /<TabsList\b[\s\S]{0,300}?(?:className=(?:"([^"]*)"|\{`([\s\S]*?)`\}))/.exec(
      source,
    );
    expect(list, "the TabsList is gone").not.toBeNull();
    const className = (list?.[1] ?? list?.[2] ?? "").replace(/\s+/g, " ");

    expect(className).toContain("flex-wrap");
    expect(
      className,
      "the tab strip's height override must carry the same variant as the base " +
        "(`group-data-[orientation=horizontal]/tabs:h-8`). twMerge only dedupes " +
        "classes with matching variants, so a bare `h-auto` leaves the 32px box " +
        "in place and the wrapped rows stay clipped.",
    ).toContain("group-data-[orientation=horizontal]/tabs:h-auto");
  });
});

describe("the board itself was left alone", () => {
  const source = read(KANBAN);

  it("is still a horizontally scrolling rail, not a status-tab rewrite", () => {
    // Measured clean at all twelve widths; converting it would have replaced a
    // working board. This asserts the decision, not just the code.
    expect(source).toContain("flex gap-3 overflow-x-auto");
    expect(source).not.toContain("TabsList");
  });

  it("still moves cards through one function with a rollback", () => {
    expect(source).toContain("async function moveInvestor");
    expect(source).toContain("updateInvestor(id, { status: nextStage })");
    expect(source).toContain("setColumns(previous)");
  });

  it("still gates the move on investors:update", () => {
    expect(source).toContain('hasPermission("investors:update")');
    expect(source).toContain("draggable={canMove}");
  });
});
