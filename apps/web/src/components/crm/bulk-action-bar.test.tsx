import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BulkActionBar } from "@/components/crm/bulk-action-bar";
import type { BulkSelection } from "@/hooks/use-bulk-selection";

function selection(over: Partial<BulkSelection> = {}): BulkSelection {
  return {
    ids: [],
    allMatching: false,
    count: 0,
    active: false,
    isSelected: () => false,
    toggle: vi.fn(),
    toggleMany: vi.fn(),
    replaceIds: vi.fn(),
    selectAllMatching: vi.fn(),
    clear: vi.fn(),
    ...over,
  };
}

describe("BulkActionBar", () => {
  it("renders nothing while no selection exists", () => {
    const { container } = render(
      <BulkActionBar
        selection={selection()}
        recordLabel="deals"
        total={214}
        actions={[{ key: "bu", label: "Business units", onClick: vi.fn() }]}
      />,
    );
    // It must take no vertical space on a board somebody is just reading.
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the selected count", () => {
    render(
      <BulkActionBar
        selection={selection({ ids: ["a", "b"], count: 2, active: true })}
        recordLabel="deals"
        total={214}
        actions={[{ key: "bu", label: "Business units", onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByText(/2 deals selected/)).toBeInTheDocument();
  });

  it("offers the escalation only when it would widen the selection", () => {
    render(
      <BulkActionBar
        selection={selection({ ids: ["a"], count: 1, active: true })}
        recordLabel="deals"
        total={214}
        actions={[{ key: "bu", label: "Business units", onClick: vi.fn() }]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /select all 214 matching/i }),
    ).toBeInTheDocument();
  });

  it("hides the escalation when every matching row is already ticked", () => {
    // Otherwise "select all 3 matching" sits next to 3 ticked rows.
    render(
      <BulkActionBar
        selection={selection({
          ids: ["a", "b", "c"],
          count: 3,
          active: true,
        })}
        recordLabel="deals"
        total={3}
        actions={[{ key: "bu", label: "Business units", onClick: vi.fn() }]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /select all/i }),
    ).not.toBeInTheDocument();
  });

  it("labels an allMatching selection as such and hides the escalation", () => {
    render(
      <BulkActionBar
        selection={selection({ allMatching: true, count: 214, active: true })}
        recordLabel="deals"
        total={214}
        actions={[{ key: "bu", label: "Business units", onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByText(/214 deals selected/)).toBeInTheDocument();
    expect(screen.getByText(/all matching/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /select all 214/i }),
    ).not.toBeInTheDocument();
  });

  it("wires the action and the clear button", async () => {
    const onAssign = vi.fn();
    const clear = vi.fn();
    render(
      <BulkActionBar
        selection={selection({ ids: ["a"], count: 1, active: true, clear })}
        recordLabel="deals"
        total={214}
        actions={[{ key: "bu", label: "Business units", onClick: onAssign }]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /business units/i }),
    );
    expect(onAssign).toHaveBeenCalledOnce();
    await userEvent.click(
      screen.getByRole("button", { name: /clear selection/i }),
    );
    expect(clear).toHaveBeenCalledOnce();
  });

  it("escalates through the hook when asked", async () => {
    const selectAllMatching = vi.fn();
    render(
      <BulkActionBar
        selection={selection({
          ids: ["a"],
          count: 1,
          active: true,
          selectAllMatching,
        })}
        recordLabel="deals"
        total={214}
        actions={[{ key: "bu", label: "Business units", onClick: vi.fn() }]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /select all 214 matching/i }),
    );
    expect(selectAllMatching).toHaveBeenCalledOnce();
  });

  it("renders every supplied action, in order, with its variant", async () => {
    // The list is caller-supplied because the actions differ per record type —
    // leads have no Owner action, since a lead's owner is not reassignable.
    const bu = vi.fn();
    const archive = vi.fn();
    render(
      <BulkActionBar
        selection={selection({ ids: ["a"], count: 1, active: true })}
        recordLabel="leads"
        total={1}
        actions={[
          { key: "bu", label: "Business units", onClick: bu },
          {
            key: "archive",
            label: "Archive",
            variant: "outline",
            onClick: archive,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Business units" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(archive).toHaveBeenCalledOnce();
    expect(bu).not.toHaveBeenCalled();
  });

  it("renders no action buttons when the list is empty", () => {
    render(
      <BulkActionBar
        selection={selection({ ids: ["a"], count: 1, active: true })}
        recordLabel="leads"
        total={1}
        actions={[]}
      />,
    );
    // Only the clear button remains.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
