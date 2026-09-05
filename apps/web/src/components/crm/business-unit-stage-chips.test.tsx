import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BusinessUnitStageChips } from "@/components/crm/business-unit-stage-chips";

/**
 * The requested card format, pinned as text.
 *
 * "Business Unit - Stage", e.g. `Onewave - Negotiation`. Asserted on the
 * rendered string rather than on props, because the ask was about what a rep
 * reads on the card — a refactor that keeps the props and loses the separator
 * or the stage would still be the bug.
 */

// The label/colour resolver reads an admin-editable catalog over HTTP. Stub it
// so these assertions are about the chip text, not about cache timing.
vi.mock("@/hooks/use-business-units", () => ({
  useBusinessUnits: () => ({ units: [], loading: false, refresh: vi.fn() }),
  labelForBusinessUnitCode: (code: string) =>
    ({
      onewave: "Onewave",
      "onewave-revenue": "Onewave Revenue",
      aria: "ARIA",
    })[code] ?? code,
  variantForBusinessUnitCode: () => "grey",
}));

describe("BusinessUnitStageChips", () => {
  it("renders one chip per unit as 'Business Unit - Stage'", () => {
    render(
      <BusinessUnitStageChips
        units={[{ businessUnit: "onewave", stage: "negotiation" }]}
      />,
    );
    expect(screen.getByText("Onewave - Negotiation")).toBeInTheDocument();
  });

  it("shows each unit's own stage, not one shared stage", () => {
    // The case the whole feature exists for: Prepone's Onewave work is Live
    // while ARIA is still Qualified. The column can only say one of those.
    render(
      <BusinessUnitStageChips
        units={[
          { businessUnit: "onewave", stage: "live" },
          { businessUnit: "aria", stage: "qualified" },
        ]}
      />,
    );
    expect(screen.getByText("Onewave - Live")).toBeInTheDocument();
    expect(screen.getByText("ARIA - Qualified")).toBeInTheDocument();
  });

  it("never collapses units behind a +N", () => {
    // Collapsing would hide the disagreement these chips exist to show.
    render(
      <BusinessUnitStageChips
        units={[
          { businessUnit: "onewave", stage: "live" },
          { businessUnit: "onewave-revenue", stage: "live" },
          { businessUnit: "aria", stage: "qualified" },
        ]}
      />,
    );
    expect(screen.getByText("Onewave Revenue - Live")).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("renders a plain Unassigned chip for an untagged deal", () => {
    // No unit means no stage that could differ from the column, so a suffix
    // here would be noise. Both the empty array and a missing field — older
    // payloads predate `units`.
    for (const units of [[], undefined]) {
      const { unmount } = render(<BusinessUnitStageChips units={units} />);
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
      expect(screen.queryByText(/Unassigned - /)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("prettifies a stage the label map does not know", () => {
    // Stage keys are a fixed union today, but the chip must not leak
    // `closed_won`-shaped text if that ever widens.
    render(
      <BusinessUnitStageChips
        units={[{ businessUnit: "onewave", stage: "on_hold" }]}
      />,
    );
    expect(screen.getByText("Onewave - On Hold")).toBeInTheDocument();
  });

  it("labels a code whose unit was deleted with the raw code", () => {
    // A deal can outlive its unit; the chip must still render.
    render(
      <BusinessUnitStageChips
        units={[{ businessUnit: "ghost-unit", stage: "live" }]}
      />,
    );
    expect(screen.getByText("ghost-unit - Live")).toBeInTheDocument();
  });
});
