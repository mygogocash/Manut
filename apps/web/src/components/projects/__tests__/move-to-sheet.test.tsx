import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MoveToSheet } from "@/components/projects/move-to-sheet";
import type { ProjectColumn, Task } from "@/services/project.service";

// Moving a task by tapping, because dragging one does not work on touch.
//
// The risk this file guards is not layout. It is that a replacement for a
// gesture quietly becomes a SECOND way to write the same record — a different
// status list, a different endpoint, a different idea of what "moved" means.
// So the tests are mostly about the contract: destinations come from the
// board's columns, the write goes through the caller's one mover, and a failure
// is never presented as a success.

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const COLUMNS: ProjectColumn[] = [
  { id: "c1", key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 0 },
  {
    id: "c2",
    key: "in_progress",
    label: "In Progress",
    color: "bg-amber-500",
    sortOrder: 1,
  },
  { id: "c3", key: "done", label: "Done", color: "bg-green-500", sortOrder: 2 },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const task = {
  id: "t-1",
  title: "Reconcile settlement ledger",
  status: "todo",
} as any as Task;
/* eslint-enable @typescript-eslint/no-explicit-any */

function setup(
  onMove: (t: Task, s: string) => Promise<boolean> = () =>
    Promise.resolve(true),
  onOpenChange = vi.fn(),
) {
  render(
    <MoveToSheet
      open
      onOpenChange={onOpenChange}
      task={task}
      columns={COLUMNS}
      onMove={onMove}
    />,
  );
  return { onOpenChange };
}

describe("where a task can go", () => {
  it("offers the board's own columns, and only those", () => {
    setup();
    for (const col of COLUMNS) {
      expect(screen.getByRole("button", { name: new RegExp(col.label) }))
        .toBeInTheDocument();
    }
  });

  it("labels destinations from the columns rather than a private list", () => {
    // A renamed column must appear renamed here. If this component held its own
    // status vocabulary, it would not.
    render(
      <MoveToSheet
        open
        onOpenChange={vi.fn()}
        task={task}
        columns={[
          { ...COLUMNS[0]!, label: "Triage" },
          { ...COLUMNS[1]!, label: "Doing" },
        ]}
        onMove={() => Promise.resolve(true)}
      />,
    );
    expect(screen.getByRole("button", { name: /Triage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Doing/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /To Do/ })).toBeNull();
  });

  it("shows the task's current status but does not offer it as a destination", () => {
    setup();
    const current = screen.getByRole("button", { name: /To Do/ });
    expect(current).toBeDisabled();
    expect(current).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("names the task being moved", () => {
    setup();
    expect(
      screen.getByText("Reconcile settlement ledger"),
    ).toBeInTheDocument();
  });
});

describe("performing the move", () => {
  it("hands the task and the destination status to the caller's mover", async () => {
    const onMove = vi.fn().mockResolvedValue(true);
    setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /In Progress/ }));
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    // The column KEY, not its label — the key is what the API stores.
    expect(onMove).toHaveBeenCalledWith(task, "in_progress");
  });

  it("closes once the write has landed", async () => {
    const { onOpenChange } = setup(() => Promise.resolve(true));
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("stays open when the write failed", async () => {
    // The board has already rolled back and shown the error. Closing here would
    // read as "moved" for a task that did not move.
    const onMove = vi.fn().mockResolvedValue(false);
    const { onOpenChange } = setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    await waitFor(() => expect(onMove).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("cannot be made to write twice by tapping twice", async () => {
    // A slow network and an impatient thumb is the ordinary case here, and two
    // writes would reorder the destination column twice.
    let release: (v: boolean) => void = () => {};
    const onMove = vi.fn(
      () => new Promise<boolean>((resolve) => (release = resolve)),
    );
    const { onOpenChange } = setup(onMove);
    const dest = screen.getByRole("button", { name: /In Progress/ });

    fireEvent.click(dest);
    fireEvent.click(dest);
    // Nor by tapping a DIFFERENT destination while the first is in flight.
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(onMove).toHaveBeenCalledTimes(1);

    release(true);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("disables every destination while a move is in flight", () => {
    const onMove = vi.fn(() => new Promise<boolean>(() => {}));
    setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /In Progress/ }));
    expect(screen.getByRole("button", { name: /Done/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeDisabled();
  });

  it("cannot be dismissed mid-write", () => {
    const onMove = vi.fn(() => new Promise<boolean>(() => {}));
    const { onOpenChange } = setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /In Progress/ }));
    onOpenChange.mockClear();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("getting out", () => {
  it("closes on Cancel without moving anything", () => {
    const onMove = vi.fn();
    const { onOpenChange } = setup(onMove);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("has an accessible name and a reachable destination list", () => {
    setup();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/move task/i);
    const dest = screen.getByRole("button", { name: /In Progress/ });
    dest.focus();
    expect(dest).toHaveFocus();
  });
});
