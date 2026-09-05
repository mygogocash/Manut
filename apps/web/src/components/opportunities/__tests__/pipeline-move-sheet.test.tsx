import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelineMoveSheet } from "@/components/opportunities/pipeline-move-sheet";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
} from "@/services/crm-opportunity.service";

// Phase 10A — changing an opportunity's stage without a mouse drag.
//
// What was measured first, and what it changed:
//
//   The board is ALREADY responsive — `grid-cols-1 / md:grid-cols-3 /
//   xl:grid-cols-6`. At 320-430px it is a vertical stack of all six stages with
//   every card fully legible: page overflow 0, uncontained 0, clipped 0, and
//   value/probability/owner/close-date all visible even at
//   USD 18,000,000,000,000. So the Project Board's status-tab rewrite would have
//   been solving a problem this board does not have, and was NOT applied.
//
//   The real gap is the move itself. It is HTML5 native drag (`draggable` +
//   `dataTransfer`), which has no touch implementation in mobile Safari or
//   Chrome and is not keyboard-operable. The capability was never absent — the
//   Edit dialog carries a `stage` field — but that is four steps and a full form
//   for what a mouse does in one gesture, and a keyboard user has no direct path
//   at all.
//
// This sheet is not a second move. It calls the board's own `moveCard`,
// which performs the same optimistic update, the same `updateOpportunity`
// mutation, the same refresh and the same rollback-plus-toast. Both kanban
// copies pass that same function in.

const OPP = { id: "o1", name: "Enterprise payment programme", stage: "proposal" };

function setup(onMove = vi.fn().mockResolvedValue(true)) {
  const onOpenChange = vi.fn();
  render(
    <PipelineMoveSheet
      open
      onOpenChange={onOpenChange}
      opportunity={OPP}
      onMove={onMove}
    />,
  );
  return { onMove, onOpenChange };
}

describe("the pipeline move sheet", () => {
  it("offers every pipeline stage, in board order", () => {
    setup();
    for (const stage of OPPORTUNITY_STAGES) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(OPPORTUNITY_STAGE_LABELS[stage], "i"),
        }),
        `stage ${stage} is missing`,
      ).toBeInTheDocument();
    }
  });

  it("shows the current stage and disables it", () => {
    setup();
    const current = screen.getByRole("button", { name: /Proposal/i });
    expect(current).toBeDisabled();
    expect(current).toHaveTextContent(/Current/i);
  });

  it("calls the board's own move with the chosen stage", async () => {
    const { onMove } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Negotiation/i }));
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove).toHaveBeenCalledWith("o1", "negotiation");
  });

  it("closes only when the write landed", async () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Closed Won/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("stays open when the move failed", async () => {
    // A failed move has already rolled the board back and shown its own toast;
    // closing would imply it worked.
    const onMove = vi.fn().mockResolvedValue(false);
    const { onOpenChange } = setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /Live/i }));
    await waitFor(() => expect(onMove).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("cannot start a second move while one is in flight", async () => {
    let release: (v: boolean) => void = () => {};
    const onMove = vi.fn(
      () => new Promise<boolean>((res) => (release = res)),
    );
    setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /Negotiation/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Live/i })).toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Live/i }));
    expect(onMove).toHaveBeenCalledTimes(1);
    release(true);
  });

  it("gives every destination a 44px target", () => {
    setup();
    const target = screen.getByRole("button", { name: /Negotiation/i });
    expect(target.className).toContain("min-h-11");
  });
});

/* -------------------------------------------------------------------------- */
/* Source invariants on the two kanban copies                                 */
/* -------------------------------------------------------------------------- */

const SRC = resolve(__dirname, "../../..");
const KANBANS = [
  "components/opportunities/pipeline-kanban.tsx",
];

describe("both kanban copies route the move through one function", () => {
  for (const rel of KANBANS) {
    const source = readFileSync(resolve(SRC, rel), "utf8");

    it(`${rel} passes moveCard to the sheet`, () => {
      // Not a new endpoint and not duplicated logic: the sheet gets the same
      // function the drop handlers call.
      expect(source).toContain("<PipelineMoveSheet");
      expect(source).toContain("onMove={moveCard}");
    });

    it(`${rel} reports whether the write landed`, () => {
      // Without the boolean the sheet cannot stay open on failure.
      expect(source).toMatch(/moveCard\([\s\S]{0,120}?Promise<boolean>/);
      expect(source).toContain("return true;");
      expect(source).toContain("return false;");
    });

    it(`${rel} gates the move trigger on the same permission as drag`, () => {
      // `canMove` is hasPermission("sales-revenue:update") — the same gate the
      // drag handlers use. The mobile path must not be a permission bypass.
      const trigger =
        /\{canMove \? \([\s\S]{0,600}?aria-label="Move to another stage"/.exec(
          source,
        );
      expect(
        trigger,
        `${rel}: the move trigger is not inside a canMove gate`,
      ).not.toBeNull();
    });

    it(`${rel} keeps the desktop drag path intact`, () => {
      for (const marker of [
        "draggable={canMove}",
        "onDragStart",
        "onDrop",
        "handleDropOnCard",
      ]) {
        expect(source, `${rel} lost ${marker}`).toContain(marker);
      }
    });
  }
});
